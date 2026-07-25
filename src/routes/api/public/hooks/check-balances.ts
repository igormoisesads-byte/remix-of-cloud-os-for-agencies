import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: every 4h. Sync balance + transactions and alert per funding type:
 *  - Prepaid: warn ≤7 days, critical ≤1.5 days.
 *  - Postpaid: critical on failed charge; warn if next charge is within ~36h.
 */
export const Route = createFileRoute("/api/public/hooks/check-balances")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") || "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
        if (!expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncMetaBillingInternal, classifyFunding, PREPAID_WARN_DAYS, PREPAID_CRITICAL_DAYS } =
          await import("@/lib/billing.functions");
        const { sendPushToUsers } = await import("@/lib/push.server");

        const { data: accounts } = await supabaseAdmin
          .from("ad_accounts")
          .select("id, client_id, account_name, funding_type, low_balance_notified_at, currency")
          .eq("active", true)
          .eq("provider", "meta");

        const results: any[] = [];
        for (const acc of accounts ?? []) {
          try {
            const r = await syncMetaBillingInternal(acc.id);
            const kind = classifyFunding((r as any)?.funding_type ?? acc.funding_type);

            let severity: "critical" | "warning" | null = null;
            let title = "";
            let body = "";

            if (kind === "prepaid") {
              const days = (r as any)?.days_remaining;
              if (days == null) { results.push({ id: acc.id, kind, skipped: "no_days" }); continue; }
              const d = Number(days);
              if (d <= PREPAID_CRITICAL_DAYS) {
                severity = "critical";
                title = `🚨 Saldo crítico — ${acc.account_name ?? "conta"}`;
                body = `Pré-pago cobre só ~${d.toFixed(1)} dia(s). Recarregue agora.`;
              } else if (d <= PREPAID_WARN_DAYS) {
                severity = "warning";
                title = `⚠️ Saldo baixo — ${acc.account_name ?? "conta"}`;
                body = `Pré-pago cobre ~${d.toFixed(1)} dia(s). Programe a recarga.`;
              }
            } else {
              // Postpaid: check failed charge or upcoming billing
              const { data: recentTx } = await supabaseAdmin
                .from("ad_billing_transactions")
                .select("status, billing_end_time")
                .eq("ad_account_id", acc.id)
                .order("billing_end_time", { ascending: false })
                .limit(30);
              const failed = (recentTx ?? []).find((t: any) =>
                /fail|error|declin/i.test(String(t.status ?? "")),
              );
              const now = Date.now();
              const upcoming = (recentTx ?? [])
                .map((t: any) => (t.billing_end_time ? new Date(t.billing_end_time).getTime() : 0))
                .filter((n: number) => n >= now)
                .sort((x: number, y: number) => x - y)[0];
              const hoursToNext = upcoming ? (upcoming - now) / 3_600_000 : null;

              if (failed) {
                severity = "critical";
                title = `🚨 Cobrança falhou — ${acc.account_name ?? "conta"}`;
                body = `Meta reportou falha na última cobrança pós-paga. Verifique o cartão/faturamento.`;
              } else if (hoursToNext != null && hoursToNext <= 36) {
                severity = "warning";
                title = `⚠️ Cobrança amanhã — ${acc.account_name ?? "conta"}`;
                body = `A Meta cobra esta conta em ~${Math.max(1, Math.round(hoursToNext))}h. Garanta saldo no cartão.`;
              }
            }

            if (!severity) { results.push({ id: acc.id, kind }); continue; }

            const last = acc.low_balance_notified_at ? new Date(acc.low_balance_notified_at).getTime() : 0;
            const debounceMs = severity === "critical" ? 6 * 3600_000 : 12 * 3600_000;
            if (Date.now() - last < debounceMs) {
              results.push({ id: acc.id, kind, severity, skipped: "debounce" });
              continue;
            }

            const [{ data: staff }, { data: client }] = await Promise.all([
              supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "gestor"]),
              supabaseAdmin.from("clients").select("id, name").eq("id", acc.client_id).maybeSingle(),
            ]);
            const users = Array.from(new Set((staff ?? []).map((s: any) => s.user_id)));
            const url = client?.id ? `/clientes/${client.id}` : "/hoje";

            await sendPushToUsers(users, { title, body, url, tag: `bal-${acc.id}-${severity}` });

            if (client?.id) {
              const { data: channel } = await supabaseAdmin
                .from("channels")
                .select("id")
                .eq("client_id", client.id)
                .maybeSingle();
              if (channel?.id) {
                await supabaseAdmin.from("messages").insert({
                  channel_id: channel.id,
                  author_id: null,
                  body: `${title}\n${body}`,
                });
              }
            }

            await supabaseAdmin
              .from("ad_accounts")
              .update({ low_balance_notified_at: new Date().toISOString() })
              .eq("id", acc.id);

            results.push({ id: acc.id, kind, severity, notified: users.length });
          } catch (e: any) {
            results.push({ id: acc.id, error: e?.message });
          }
        }

        return new Response(JSON.stringify({ checked: results.length, results }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});

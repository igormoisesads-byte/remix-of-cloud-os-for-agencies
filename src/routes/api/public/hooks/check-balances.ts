import { createFileRoute } from "@tanstack/react-router";

/**
 * Public cron endpoint. Called by pg_cron every 4h.
 * Auth: Supabase anon key in `apikey` header (matches project cron pattern).
 *
 * Steps:
 *  1) sync balance + transactions for every active Meta ad account
 *  2) find accounts crossing below their threshold and send push
 *     notifications + auto-post a message in the client's chat channel.
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
        const { syncMetaBillingInternal } = await import("@/lib/billing.functions");
        const { sendPushToUsers } = await import("@/lib/push.server");

        const { data: accounts } = await supabaseAdmin
          .from("ad_accounts")
          .select("id, client_id, account_name, low_balance_days_threshold, low_balance_notified_at, currency")
          .eq("active", true)
          .eq("provider", "meta");

        const results: any[] = [];
        for (const acc of accounts ?? []) {
          try {
            const r = await syncMetaBillingInternal(acc.id);
            const days = r?.days_remaining;
            const threshold = Number(acc.low_balance_days_threshold ?? 3);
            if (days != null && Number(days) <= threshold) {
              // Debounce: only re-notify once every 12h
              const last = acc.low_balance_notified_at ? new Date(acc.low_balance_notified_at).getTime() : 0;
              if (Date.now() - last < 12 * 60 * 60 * 1000) {
                results.push({ id: acc.id, days, skipped: "debounce" });
                continue;
              }

              // Recipients: admins + gestores
              const [{ data: staff }, { data: client }] = await Promise.all([
                supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "gestor"]),
                supabaseAdmin.from("clients").select("id, name").eq("id", acc.client_id).maybeSingle(),
              ]);
              const users = new Set<string>((staff ?? []).map((s: any) => s.user_id));

              const title = `⚠️ Saldo baixo — ${client?.name ?? "conta de anúncio"}`;
              const body = `Saldo cobre ~${Number(days).toFixed(1)} dia(s) de anúncios. Recarregue a conta.`;
              const url = client?.id ? `/clientes/${client.id}` : "/hoje";

              await sendPushToUsers(Array.from(users), { title, body, url, tag: `low-balance-${acc.id}` });

              // Auto message in the client channel
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
                    body: `🚨 **Saldo crítico**: cobre ~${Number(days).toFixed(1)} dia(s). Recarregue a conta de anúncio "${acc.account_name}".`,
                  });
                }
              }

              await supabaseAdmin
                .from("ad_accounts")
                .update({ low_balance_notified_at: new Date().toISOString() })
                .eq("id", acc.id);

              results.push({ id: acc.id, days, notified: users.size });
            } else {
              results.push({ id: acc.id, days });
            }
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

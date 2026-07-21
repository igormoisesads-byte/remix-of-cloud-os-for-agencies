import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-ads")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: accs, error } = await supabaseAdmin
            .from("ad_accounts")
            .select("id, provider")
            .eq("active", true)
            .eq("provider", "meta");
          if (error) throw error;

          // Inline sync per account (dup of ads.functions logic to avoid client-graph imports)
          const results: any[] = [];
          for (const a of accs ?? []) {
            try {
              const r = await syncOne(a.id);
              results.push({ id: a.id, ...r });
            } catch (e: any) {
              results.push({ id: a.id, error: e?.message ?? String(e) });
            }
          }
          return Response.json({ ok: true, ran: results.length, results });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to trigger sync" }),
    },
  },
});

async function syncOne(adAccountRowId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc, error } = await supabaseAdmin
    .from("ad_accounts").select("*").eq("id", adAccountRowId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc || acc.provider !== "meta" || !acc.access_token) return { skipped: true };

  const raw = String(acc.account_id).trim();
  const accountId = raw.startsWith("act_") ? raw : `act_${raw}`;
  const until = new Date();
  const since = new Date(); since.setDate(since.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL(`https://graph.facebook.com/v20.0/${accountId}/insights`);
  url.searchParams.set("fields", "spend,impressions,clicks,reach,actions,cpm,ctr,cpc");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: fmt(since), until: fmt(until) }));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", acc.access_token);

  const resp = await fetch(url.toString());
  const body: any = await resp.json();
  if (!resp.ok || body.error) {
    const msg = body?.error?.message || `HTTP ${resp.status}`;
    await supabaseAdmin.from("ad_accounts")
      .update({ last_sync_error: msg, last_sync_at: new Date().toISOString() }).eq("id", acc.id);
    throw new Error(msg);
  }

  let upserted = 0;
  for (const r of body.data ?? []) {
    const actions: any[] = r.actions ?? [];
    const pick = (t: string) => Number(actions.find((a) => a.action_type === t)?.value ?? 0);
    const results =
      pick("purchase") || pick("offsite_conversion.fb_pixel_purchase") ||
      pick("lead") || pick("onsite_conversion.lead_grouped") || pick("link_click") || 0;

    const { error: upErr } = await supabaseAdmin.from("ad_insights").upsert({
      ad_account_id: acc.id, date: r.date_start,
      spend: Number(r.spend ?? 0), impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0), reach: Number(r.reach ?? 0), results,
      cpm: r.cpm ? Number(r.cpm) : null, ctr: r.ctr ? Number(r.ctr) : null,
      cpc: r.cpc ? Number(r.cpc) : null, raw: r,
    }, { onConflict: "ad_account_id,date" });
    if (!upErr) upserted++;
  }

  await supabaseAdmin.from("ad_accounts")
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", acc.id);

  return { upserted };
}

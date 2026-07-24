import { createFileRoute } from "@tanstack/react-router";

type SyncMode = "today" | "yesterday" | "last_7" | "last_30" | "backfill";

function parseMode(v: unknown): SyncMode {
  const s = String(v ?? "").toLowerCase();
  if (s === "yesterday" || s === "last_7" || s === "last_30" || s === "backfill") return s;
  return "today";
}

function rangeFor(mode: SyncMode): { since: Date; until: Date } {
  const until = new Date();
  const since = new Date();
  switch (mode) {
    case "today":
      // since = today
      break;
    case "yesterday":
      since.setDate(since.getDate() - 1);
      until.setDate(until.getDate() - 1);
      break;
    case "last_7":
      since.setDate(since.getDate() - 7);
      break;
    case "last_30":
      since.setDate(since.getDate() - 30);
      break;
    case "backfill":
      // Meta allows up to ~37 months; pull 24 months to be safe
      since.setMonth(since.getMonth() - 24);
      break;
  }
  return { since, until };
}

export const Route = createFileRoute("/api/public/hooks/sync-ads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = request.headers.get("apikey") || "";
          const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
          if (!expected || apiKey !== expected) {
            return new Response("Unauthorized", { status: 401 });
          }

          let mode: SyncMode = "today";
          let onlyAccountId: string | null = null;
          try {
            const body = (await request.json().catch(() => ({}))) as any;
            mode = parseMode(body?.mode);
            if (body?.account_id) onlyAccountId = String(body.account_id);
          } catch {}
          // allow ?mode= override
          const u = new URL(request.url);
          if (u.searchParams.get("mode")) mode = parseMode(u.searchParams.get("mode"));
          if (u.searchParams.get("account_id")) onlyAccountId = u.searchParams.get("account_id");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let q = supabaseAdmin
            .from("ad_accounts")
            .select("id, provider")
            .eq("active", true)
            .eq("provider", "meta");
          if (onlyAccountId) q = q.eq("id", onlyAccountId);
          const { data: accs, error } = await q;
          if (error) throw error;

          const results: any[] = [];
          for (const a of accs ?? []) {
            try {
              const r = await syncOne(a.id, mode);
              results.push({ id: a.id, ...r });
            } catch (e: any) {
              results.push({ id: a.id, error: e?.message ?? String(e) });
            }
          }
          return Response.json({ ok: true, mode, ran: results.length, results });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST { mode: today|yesterday|last_7|last_30|backfill }" }),
    },
  },
});

async function syncOne(adAccountRowId: string, mode: SyncMode) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc, error } = await supabaseAdmin
    .from("ad_accounts").select("*").eq("id", adAccountRowId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc || acc.provider !== "meta" || !acc.access_token) return { skipped: true };

  const raw = String(acc.account_id).trim();
  const accountId = raw.startsWith("act_") ? raw : `act_${raw}`;
  const { since, until } = rangeFor(mode);
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

  // Wipe the exact window we're about to rewrite so re-runs never accumulate.
  await Promise.all([
    supabaseAdmin.from("ad_insights").delete()
      .eq("ad_account_id", acc.id).gte("date", fmt(since)).lte("date", fmt(until)),
    supabaseAdmin.from("ad_funnel_whatsapp").delete()
      .eq("ad_account_id", acc.id).gte("date", fmt(since)).lte("date", fmt(until)),
    supabaseAdmin.from("ad_campaign_insights").delete()
      .eq("ad_account_id", acc.id).gte("date", fmt(since)).lte("date", fmt(until)),
  ]);

  let upserted = 0;
  let upsertedWhatsapp = 0;
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

    const conversations = pick("onsite_conversion.messaging_conversation_started_7d");
    const linkClicks = pick("link_click");
    const firstReplies = pick("onsite_conversion.messaging_first_reply");
    if (conversations || linkClicks || firstReplies) {
      const { error: waErr } = await supabaseAdmin.from("ad_funnel_whatsapp").upsert({
        ad_account_id: acc.id,
        date: r.date_start,
        impressions: Number(r.impressions ?? 0),
        link_clicks: linkClicks,
        conversations_started: conversations,
        first_replies: firstReplies,
      }, { onConflict: "ad_account_id,date" });
      if (!waErr) upsertedWhatsapp++;
    }
  }

  const campUrl = new URL(`https://graph.facebook.com/v20.0/${accountId}/insights`);
  campUrl.searchParams.set("fields", "campaign_id,campaign_name,spend,impressions,clicks,reach,actions,cpm,ctr,cpc");
  campUrl.searchParams.set("level", "campaign");
  campUrl.searchParams.set("time_increment", "1");
  campUrl.searchParams.set("time_range", JSON.stringify({ since: fmt(since), until: fmt(until) }));
  campUrl.searchParams.set("limit", "500");
  campUrl.searchParams.set("access_token", acc.access_token);
  const campResp = await fetch(campUrl.toString());
  const campBody: any = await campResp.json();
  let upsertedCampaigns = 0;
  if (campResp.ok && !campBody.error) {
    for (const r of campBody.data ?? []) {
      if (!r.campaign_id) continue;
      const actions: any[] = r.actions ?? [];
      const pick = (t: string) => Number(actions.find((a) => a.action_type === t)?.value ?? 0);
      const results =
        pick("purchase") || pick("offsite_conversion.fb_pixel_purchase") ||
        pick("lead") || pick("onsite_conversion.lead_grouped") || pick("link_click") || 0;
      const { error: campErr } = await supabaseAdmin.from("ad_campaign_insights").upsert({
        ad_account_id: acc.id,
        date: r.date_start,
        campaign_id: String(r.campaign_id),
        campaign_name: r.campaign_name ?? null,
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        reach: Number(r.reach ?? 0),
        results,
        cpm: r.cpm ? Number(r.cpm) : null,
        ctr: r.ctr ? Number(r.ctr) : null,
        cpc: r.cpc ? Number(r.cpc) : null,
        raw: r,
      }, { onConflict: "ad_account_id,date,campaign_id" });
      if (!campErr) upsertedCampaigns++;
    }
  }

  await supabaseAdmin.from("ad_accounts")
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", acc.id);

  return { mode, since: fmt(since), until: fmt(until), upserted, whatsapp: upsertedWhatsapp, campaigns: upsertedCampaigns };
}

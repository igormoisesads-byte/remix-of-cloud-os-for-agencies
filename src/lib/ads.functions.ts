import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Meta Ads sync ---------- */

const META_V = "v20.0";

function pickAction(actions: any[], type: string) {
  return Number((actions ?? []).find((a) => a.action_type === type)?.value ?? 0);
}
function pickResults(actions: any[]) {
  return (
    pickAction(actions, "purchase") ||
    pickAction(actions, "offsite_conversion.fb_pixel_purchase") ||
    pickAction(actions, "lead") ||
    pickAction(actions, "onsite_conversion.lead_grouped") ||
    pickAction(actions, "onsite_conversion.messaging_conversation_started_7d") ||
    pickAction(actions, "link_click") ||
    0
  );
}

async function metaFetch(url: URL) {
  const resp = await fetch(url.toString());
  const body = await resp.json();
  if (!resp.ok || body.error) {
    const msg = body?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`Meta API: ${msg}`);
  }
  return body;
}

async function syncMetaAccountInternal(adAccountRowId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc, error } = await supabaseAdmin
    .from("ad_accounts")
    .select("*")
    .eq("id", adAccountRowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc) throw new Error("Conta não encontrada");
  if (acc.provider !== "meta") throw new Error("Conta não é Meta");
  if (!acc.access_token) throw new Error("Sem access_token configurado");

  const rawId = String(acc.account_id).trim();
  const accountId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
  const token = acc.access_token;

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const timeRange = JSON.stringify({ since: fmt(since), until: fmt(until) });

  let upsertedInsights = 0;
  let upsertedCreatives = 0;
  let upsertedGeo = 0;
  let upsertedWa = 0;

  try {
    // 1) Daily insights (account level)
    const dailyUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/insights`);
    dailyUrl.searchParams.set("fields", "spend,impressions,clicks,reach,actions,cpm,ctr,cpc");
    dailyUrl.searchParams.set("time_increment", "1");
    dailyUrl.searchParams.set("time_range", timeRange);
    dailyUrl.searchParams.set("limit", "500");
    dailyUrl.searchParams.set("access_token", token);
    const daily = await metaFetch(dailyUrl);
    for (const r of daily.data ?? []) {
      const actions = r.actions ?? [];
      const results = pickResults(actions);
      const { error: e } = await supabaseAdmin.from("ad_insights").upsert(
        {
          ad_account_id: acc.id,
          date: r.date_start,
          spend: Number(r.spend ?? 0),
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          reach: Number(r.reach ?? 0),
          results,
          cpm: r.cpm ? Number(r.cpm) : null,
          ctr: r.ctr ? Number(r.ctr) : null,
          cpc: r.cpc ? Number(r.cpc) : null,
          raw: r,
        },
        { onConflict: "ad_account_id,date" }
      );
      if (!e) upsertedInsights++;
    }

    // 2) Daily WhatsApp funnel (using breakdown of actions)
    for (const r of daily.data ?? []) {
      const actions = r.actions ?? [];
      const conv = pickAction(actions, "onsite_conversion.messaging_conversation_started_7d");
      const linkClicks = pickAction(actions, "link_click");
      const firstReplies = pickAction(actions, "onsite_conversion.messaging_first_reply");
      if (conv || linkClicks || firstReplies) {
        const { error: e } = await supabaseAdmin.from("ad_funnel_whatsapp").upsert(
          {
            ad_account_id: acc.id,
            date: r.date_start,
            impressions: Number(r.impressions ?? 0),
            link_clicks: linkClicks,
            conversations_started: conv,
            first_replies: firstReplies,
          },
          { onConflict: "ad_account_id,date" }
        );
        if (!e) upsertedWa++;
      }
    }

    // 3) Country breakdown (aggregated for the whole period)
    const geoUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/insights`);
    geoUrl.searchParams.set("fields", "spend,impressions,clicks,reach,actions");
    geoUrl.searchParams.set("breakdowns", "country");
    geoUrl.searchParams.set("time_range", timeRange);
    geoUrl.searchParams.set("limit", "500");
    geoUrl.searchParams.set("access_token", token);
    try {
      const geo = await metaFetch(geoUrl);
      // Clear previous period rows for this account to avoid stale data
      await supabaseAdmin
        .from("ad_geo")
        .delete()
        .eq("ad_account_id", acc.id)
        .eq("period_start", fmt(since))
        .eq("period_end", fmt(until));
      for (const r of geo.data ?? []) {
        const { error: e } = await supabaseAdmin.from("ad_geo").upsert(
          {
            ad_account_id: acc.id,
            period_start: fmt(since),
            period_end: fmt(until),
            country_code: r.country,
            country_name: null,
            spend: Number(r.spend ?? 0),
            impressions: Number(r.impressions ?? 0),
            clicks: Number(r.clicks ?? 0),
            reach: Number(r.reach ?? 0),
            results: pickResults(r.actions ?? []),
          },
          { onConflict: "ad_account_id,period_start,period_end,country_code" }
        );
        if (!e) upsertedGeo++;
      }
    } catch {
      // ignore geo errors
    }

    // 4) Creatives (ads) with aggregated insights
    try {
      const adsUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/ads`);
      adsUrl.searchParams.set(
        "fields",
        `id,name,status,creative{thumbnail_url,image_url,object_story_spec,body,title,link_url},insights.time_range(${timeRange}){spend,impressions,clicks,reach,actions,ctr,cpc}`
      );
      adsUrl.searchParams.set("limit", "50");
      adsUrl.searchParams.set("access_token", token);
      const ads = await metaFetch(adsUrl);
      for (const ad of ads.data ?? []) {
        const ins = ad.insights?.data?.[0];
        const actions = ins?.actions ?? [];
        const creative = ad.creative ?? {};
        const linkUrl =
          creative.link_url ||
          creative?.object_story_spec?.link_data?.link ||
          creative?.object_story_spec?.video_data?.call_to_action?.value?.link ||
          null;
        const { error: e } = await supabaseAdmin.from("ad_creatives").upsert(
          {
            ad_account_id: acc.id,
            external_id: String(ad.id),
            name: ad.name || creative.title || null,
            thumbnail_url: creative.thumbnail_url || creative.image_url || null,
            preview_url: creative.image_url || null,
            destination_url: linkUrl,
            status: ad.status || null,
            spend: Number(ins?.spend ?? 0),
            impressions: Number(ins?.impressions ?? 0),
            clicks: Number(ins?.clicks ?? 0),
            reach: Number(ins?.reach ?? 0),
            results: pickResults(actions),
            ctr: ins?.ctr ? Number(ins.ctr) : null,
            cpc: ins?.cpc ? Number(ins.cpc) : null,
            last_sync_at: new Date().toISOString(),
            raw: ad,
          },
          { onConflict: "ad_account_id,external_id" }
        );
        if (!e) upsertedCreatives++;
      }
    } catch {
      // ignore creatives errors
    }

    await supabaseAdmin
      .from("ad_accounts")
      .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
      .eq("id", acc.id);

    return { ok: true, insights: upsertedInsights, creatives: upsertedCreatives, geo: upsertedGeo, whatsapp: upsertedWa };
  } catch (e: any) {
    await supabaseAdmin
      .from("ad_accounts")
      .update({ last_sync_error: e.message, last_sync_at: new Date().toISOString() })
      .eq("id", acc.id);
    throw e;
  }
}

export const syncAdAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ad_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: acc, error } = await context.supabase
      .from("ad_accounts")
      .select("id, provider")
      .eq("id", data.ad_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!acc) throw new Error("Conta não encontrada");
    if (acc.provider === "google") throw new Error("Google Ads: integração em breve. Meta Ads já está ativa.");
    return await syncMetaAccountInternal(data.ad_account_id);
  });

export const syncAllAdAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "gestor");
    if (!ok) throw new Error("Apenas admin/gestor.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: accs } = await supabaseAdmin
      .from("ad_accounts")
      .select("id, provider")
      .eq("active", true)
      .eq("provider", "meta");
    const results: any[] = [];
    for (const a of accs ?? []) {
      try {
        const r = await syncMetaAccountInternal(a.id);
        results.push({ id: a.id, ...r });
      } catch (e: any) {
        results.push({ id: a.id, error: e.message });
      }
    }
    return { ran: results.length, results };
  });

/* ---------- Public report ---------- */

export const getPublicReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report } = await supabaseAdmin
      .from("public_reports")
      .select("*")
      .eq("token", data.token)
      .eq("active", true)
      .maybeSingle();
    if (!report) throw new Error("Relatório não encontrado ou expirado.");
    if (report.expires_at && new Date(report.expires_at) < new Date()) {
      throw new Error("Este relatório expirou.");
    }
    const [{ data: client }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("id, name, logo_url, city_uf, type")
        .eq("id", report.client_id)
        .maybeSingle(),
      supabaseAdmin.from("app_settings").select("agency_name, agency_logo_url, agency_primary_color").eq("singleton", true).maybeSingle(),
    ]);
    if (!client) throw new Error("Cliente não encontrado.");
    const { data: accounts } = await supabaseAdmin
      .from("ad_accounts")
      .select("id, provider, account_name, account_id, last_sync_at")
      .eq("client_id", client.id);
    const accountIds = (accounts ?? []).map((a) => a.id);
    const daysBack = 30;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceStr = since.toISOString().slice(0, 10);
    const [{ data: insights }, { data: creatives }, { data: geo }, { data: wa }] = await Promise.all([
      accountIds.length
        ? supabaseAdmin.from("ad_insights").select("*").in("ad_account_id", accountIds).gte("date", sinceStr).order("date")
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabaseAdmin.from("ad_creatives").select("*").in("ad_account_id", accountIds).order("spend", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabaseAdmin.from("ad_geo").select("*").in("ad_account_id", accountIds).order("spend", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabaseAdmin.from("ad_funnel_whatsapp").select("*").in("ad_account_id", accountIds).gte("date", sinceStr).order("date")
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Increment view count (best-effort)
    supabaseAdmin
      .from("public_reports")
      .update({ view_count: (report.view_count ?? 0) + 1 })
      .eq("id", report.id)
      .then(() => {});

    return {
      report: { id: report.id, title: report.title, created_at: report.created_at },
      client,
      agency: settings ?? { agency_name: "CloudOS", agency_logo_url: null, agency_primary_color: null },
      accounts: accounts ?? [],
      insights: insights ?? [],
      creatives: creatives ?? [],
      geo: geo ?? [],
      whatsapp: wa ?? [],
    };
  });

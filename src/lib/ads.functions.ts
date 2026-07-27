import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/* ---------- Meta Ads sync ---------- */

const META_V = "v25.0";

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

type SyncRange =
  | { preset: "last_30d" | "last_90d" | "last_6m" | "last_year" | "maximum" }
  | { since: string; until: string };

function resolveTimeRange(range?: SyncRange) {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const until = new Date();
  if (!range || (range as any).preset === "last_30d") {
    const s = new Date(); s.setDate(s.getDate() - 30);
    return { since: fmt(s), until: fmt(until), preset: null };
  }
  if ("since" in range) return { since: range.since, until: range.until, preset: null };
  const p = range.preset;
  if (p === "maximum") return { since: "2015-01-01", until: fmt(until), preset: "maximum" as const };
  const s = new Date();
  if (p === "last_90d") s.setDate(s.getDate() - 90);
  else if (p === "last_6m") s.setMonth(s.getMonth() - 6);
  else if (p === "last_year") s.setFullYear(s.getFullYear() - 1);
  return { since: fmt(s), until: fmt(until), preset: null };
}

async function syncMetaAccountInternal(adAccountRowId: string, range?: SyncRange) {
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

  const resolved = resolveTimeRange(range);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const since = new Date(resolved.since);
  const until = new Date(resolved.until);
  const timeRange = JSON.stringify({ since: resolved.since, until: resolved.until });


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

    // 3) Country + Region breakdown (aggregated for the whole period)
    // Clear previous period rows for this account to avoid stale data
    await supabaseAdmin
      .from("ad_geo")
      .delete()
      .eq("ad_account_id", acc.id)
      .eq("period_start", fmt(since))
      .eq("period_end", fmt(until));

    const geoUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/insights`);
    geoUrl.searchParams.set("fields", "spend,impressions,clicks,reach,actions");
    geoUrl.searchParams.set("breakdowns", "country");
    geoUrl.searchParams.set("time_range", timeRange);
    geoUrl.searchParams.set("limit", "500");
    geoUrl.searchParams.set("access_token", token);
    try {
      const geo = await metaFetch(geoUrl);
      for (const r of geo.data ?? []) {
        const { error: e } = await supabaseAdmin.from("ad_geo").insert({
          ad_account_id: acc.id,
          period_start: fmt(since),
          period_end: fmt(until),
          country_code: r.country,
          country_name: null,
          region: null,
          region_name: null,
          city: null,
          spend: Number(r.spend ?? 0),
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          reach: Number(r.reach ?? 0),
          results: pickResults(r.actions ?? []),
        });
        if (!e) upsertedGeo++;
      }
    } catch {
      // ignore geo errors
    }

    // 3b) Region breakdown (per state) — Meta returns region names as strings
    const regionUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/insights`);
    regionUrl.searchParams.set("fields", "spend,impressions,clicks,reach,actions");
    // Meta v25: combine country+region so we get the country code alongside each state.
    regionUrl.searchParams.set("breakdowns", "country,region");
    regionUrl.searchParams.set("level", "account");
    regionUrl.searchParams.set("time_range", timeRange);
    regionUrl.searchParams.set("limit", "500");
    regionUrl.searchParams.set("access_token", token);
    try {
      const rg = await metaFetch(regionUrl);
      for (const r of rg.data ?? []) {
        if (!r.region) continue;
        const { error: e } = await supabaseAdmin.from("ad_geo").insert({
          ad_account_id: acc.id,
          period_start: fmt(since),
          period_end: fmt(until),
          country_code: r.country || "BR",
          region: r.region,
          region_name: r.region,
          city: null,
          spend: Number(r.spend ?? 0),
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          reach: Number(r.reach ?? 0),
          results: pickResults(r.actions ?? []),
        });
        if (!e) upsertedGeo++;
      }
    } catch (err: any) {
      // Surface region errors so we can debug when nothing shows up per state.
      console.error("[ads] region breakdown failed:", err?.message || err);
      await supabaseAdmin
        .from("ad_accounts")
        .update({ last_sync_error: `region: ${String(err?.message || err).slice(0, 300)}` })
        .eq("id", acc.id);
    }


    // 4) Creatives (ads) with aggregated insights + campaign info
    try {
      const insightsFields = [
        "spend","impressions","reach","frequency","clicks","ctr","cpc","cpm","cpp",
        "actions","action_values","unique_actions","cost_per_action_type","cost_per_unique_action_type",
        "unique_link_clicks_ctr","cost_per_unique_link_click","unique_outbound_clicks",
        "unique_outbound_clicks_ctr","cost_per_unique_outbound_click","outbound_clicks",
        "video_play_actions","video_3_sec_watched_actions","video_p75_watched_actions","video_p25_watched_actions",
      ].join(",");
      const adsUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/ads`);
      adsUrl.searchParams.set(
        "fields",
        `id,name,status,campaign_id,campaign{id,name},adset_id,adset{id,name},creative{thumbnail_url,image_url,object_story_spec,body,title},insights.time_range(${timeRange}){${insightsFields}}`
      );
      adsUrl.searchParams.set("limit", "100");
      adsUrl.searchParams.set("access_token", token);
      const ads = await metaFetch(adsUrl);
      for (const ad of ads.data ?? []) {
        const ins = ad.insights?.data?.[0];
        const actions = ins?.actions ?? [];
        const actionValues = ins?.action_values ?? [];
        const uniqueActions = ins?.unique_actions ?? [];
        const costPerUnique = ins?.cost_per_unique_action_type ?? [];
        const creative = ad.creative ?? {};
        const linkUrl =
          creative.link_url ||
          creative?.object_story_spec?.link_data?.link ||
          creative?.object_story_spec?.video_data?.call_to_action?.value?.link ||
          null;

        const uniqueLinkClicks = pickAction(uniqueActions, "link_click");
        const landingViews = pickAction(actions, "landing_page_view");
        const costPerLanding = pickAction(costPerUnique, "landing_page_view") || null;
        const initCheckout = pickAction(actions, "initiate_checkout") || pickAction(actions, "offsite_conversion.fb_pixel_initiate_checkout");
        const initCheckoutValue = pickAction(actionValues, "initiate_checkout") || pickAction(actionValues, "offsite_conversion.fb_pixel_initiate_checkout");
        const costPerInit = pickAction(costPerUnique, "initiate_checkout") || null;
        const purchases = pickAction(actions, "purchase") || pickAction(actions, "offsite_conversion.fb_pixel_purchase");
        const purchaseValue = pickAction(actionValues, "purchase") || pickAction(actionValues, "offsite_conversion.fb_pixel_purchase");
        const costPerPurchase = pickAction(costPerUnique, "purchase") || null;
        const spend = Number(ins?.spend ?? 0);
        const roas = spend > 0 ? purchaseValue / spend : null;
        const videoPlays = pickAction(ins?.video_play_actions ?? [], "video_view");
        const video3s = pickAction(ins?.video_3_sec_watched_actions ?? [], "video_view");
        const videoP3s = video3s || videoPlays; // prefer real 3s+ metric
        const videoP75 = pickAction(ins?.video_p75_watched_actions ?? [], "video_view");
        const uniqueOutbound = pickAction(ins?.unique_outbound_clicks ?? [], "outbound_click");
        const uniqueOutboundCtr = ins?.unique_outbound_clicks_ctr?.[0]?.value ?? null;
        const costPerUniqueOutbound = ins?.cost_per_unique_outbound_click?.[0]?.value ?? null;
        const messagingConversations = pickAction(actions, "onsite_conversion.messaging_conversation_started_7d");

        // Espelha thumbnail/imagem no R2 (URLs do Meta expiram em horas).
        // Só refaz o download se o registro atual ainda aponta pra CDN do Meta.
        const { mirrorUrlToR2 } = await import("@/lib/r2-mirror.server");
        const { data: existingCreative } = await supabaseAdmin
          .from("ad_creatives")
          .select("thumbnail_url, preview_url")
          .eq("ad_account_id", acc.id)
          .eq("external_id", String(ad.id))
          .maybeSingle();
        const r2Base = process.env.R2_PUBLIC_URL || "";
        const rawThumb = creative.thumbnail_url || creative.image_url || null;
        const rawPreview = creative.image_url || null;
        const keepThumb = existingCreative?.thumbnail_url && r2Base && existingCreative.thumbnail_url.startsWith(r2Base);
        const keepPreview = existingCreative?.preview_url && r2Base && existingCreative.preview_url.startsWith(r2Base);
        const thumbUrl = keepThumb
          ? existingCreative!.thumbnail_url
          : (await mirrorUrlToR2(rawThumb, `ads/${acc.id}/thumb/${ad.id}.jpg`)) || existingCreative?.thumbnail_url || rawThumb;
        const previewUrl = keepPreview
          ? existingCreative!.preview_url
          : (await mirrorUrlToR2(rawPreview, `ads/${acc.id}/preview/${ad.id}.jpg`)) || existingCreative?.preview_url || rawPreview;

        const { error: e } = await supabaseAdmin.from("ad_creatives").upsert(
          {
            ad_account_id: acc.id,
            external_id: String(ad.id),
            name: ad.name || creative.title || null,
            campaign_id: ad.campaign_id || ad.campaign?.id || null,
            campaign_name: ad.campaign?.name || null,
            adset_id: ad.adset_id || ad.adset?.id || null,
            adset_name: ad.adset?.name || null,
            thumbnail_url: thumbUrl,
            preview_url: previewUrl,
            destination_url: linkUrl,
            status: ad.status || null,

            spend,
            impressions: Number(ins?.impressions ?? 0),
            clicks: Number(ins?.clicks ?? 0),
            reach: Number(ins?.reach ?? 0),
            results: pickResults(actions),
            ctr: ins?.ctr ? Number(ins.ctr) : null,
            cpc: ins?.cpc ? Number(ins.cpc) : null,
            cpm: ins?.cpm ? Number(ins.cpm) : null,
            cpp: ins?.cpp ? Number(ins.cpp) : null,
            frequency: ins?.frequency ? Number(ins.frequency) : null,
            unique_link_clicks: uniqueLinkClicks,
            unique_link_ctr: ins?.unique_link_clicks_ctr ? Number(ins.unique_link_clicks_ctr) : null,
            unique_link_cpc: ins?.cost_per_unique_link_click ? Number(ins.cost_per_unique_link_click) : null,
            unique_outbound_clicks: uniqueOutbound,
            unique_outbound_ctr: uniqueOutboundCtr ? Number(uniqueOutboundCtr) : null,
            unique_outbound_cpc: costPerUniqueOutbound ? Number(costPerUniqueOutbound) : null,
            landing_page_views: landingViews,
            cost_per_landing_page_view: costPerLanding ? Number(costPerLanding) : null,
            initiate_checkout: initCheckout,
            cost_per_initiate_checkout: costPerInit ? Number(costPerInit) : null,
            initiate_checkout_value: initCheckoutValue,
            purchases,
            cost_per_purchase: costPerPurchase ? Number(costPerPurchase) : null,
            purchase_value: purchaseValue,
            roas,
            video_plays: videoPlays,
            video_p3s: videoP3s,
            video_p75: videoP75,
            messaging_conversations_started: messagingConversations,
            last_sync_at: new Date().toISOString(),
            raw: ad,
          },
          { onConflict: "ad_account_id,external_id" }
        );
        if (!e) upsertedCreatives++;
      }
    } catch (err: any) {
      console.error("[ads] creatives failed:", err?.message || err);
      await supabaseAdmin
        .from("ad_accounts")
        .update({ last_sync_error: `creatives: ${String(err?.message || err).slice(0, 300)}` })
        .eq("id", acc.id);
    }

    // 5) Daily insights per campaign
    let upsertedCampaignInsights = 0;
    try {
      const campUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/insights`);
      campUrl.searchParams.set("fields", "campaign_id,campaign_name,spend,impressions,clicks,reach,actions,cpm,ctr,cpc");
      campUrl.searchParams.set("level", "campaign");
      campUrl.searchParams.set("time_increment", "1");
      campUrl.searchParams.set("time_range", timeRange);
      campUrl.searchParams.set("limit", "500");
      campUrl.searchParams.set("access_token", token);
      const camp = await metaFetch(campUrl);
      for (const r of camp.data ?? []) {
        if (!r.campaign_id) continue;
        const { error: e } = await supabaseAdmin.from("ad_campaign_insights").upsert(
          {
            ad_account_id: acc.id,
            date: r.date_start,
            campaign_id: String(r.campaign_id),
            campaign_name: r.campaign_name ?? null,
            spend: Number(r.spend ?? 0),
            impressions: Number(r.impressions ?? 0),
            clicks: Number(r.clicks ?? 0),
            reach: Number(r.reach ?? 0),
            results: pickResults(r.actions ?? []),
            cpm: r.cpm ? Number(r.cpm) : null,
            ctr: r.ctr ? Number(r.ctr) : null,
            cpc: r.cpc ? Number(r.cpc) : null,
            raw: r,
          },
          { onConflict: "ad_account_id,date,campaign_id" }
        );
        if (!e) upsertedCampaignInsights++;
      }
    } catch {
      // ignore campaign insights errors
    }

    // 6) Hourly leads (últimos 30 dias) — para heatmap dia da semana × hora do dia
    let upsertedHourly = 0;
    try {
      const hourlyRange = (() => {
        const untilD = new Date();
        const sinceD = new Date(); sinceD.setDate(sinceD.getDate() - 30);
        const f = (d: Date) => d.toISOString().slice(0, 10);
        return JSON.stringify({ since: f(sinceD), until: f(untilD) });
      })();
      const hUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/insights`);
      hUrl.searchParams.set("fields", "spend,impressions,clicks,actions");
      hUrl.searchParams.set("breakdowns", "hourly_stats_aggregated_by_advertiser_time_zone");
      hUrl.searchParams.set("time_increment", "1");
      hUrl.searchParams.set("time_range", hourlyRange);
      hUrl.searchParams.set("limit", "500");
      hUrl.searchParams.set("access_token", token);
      const hourly = await metaFetch(hUrl);
      // Limpa histórico da conta e regrava (mais simples que reconciliar)
      await supabaseAdmin.from("ad_hourly_leads").delete().eq("ad_account_id", acc.id);
      for (const r of hourly.data ?? []) {
        const range: string = r.hourly_stats_aggregated_by_advertiser_time_zone || "";
        const hh = Number(range.slice(0, 2));
        if (!Number.isFinite(hh)) continue;
        const d = new Date(r.date_start + "T00:00");
        const dow = (d.getDay() + 6) % 7; // 0=Seg .. 6=Dom
        const results = pickResults(r.actions ?? []);
        const { error: e } = await supabaseAdmin.from("ad_hourly_leads").upsert(
          {
            ad_account_id: acc.id,
            date: r.date_start,
            hour: hh,
            dow,
            results,
            spend: Number(r.spend ?? 0),
            impressions: Number(r.impressions ?? 0),
            clicks: Number(r.clicks ?? 0),
          },
          { onConflict: "ad_account_id,date,hour" },
        );
        if (!e) upsertedHourly++;
      }
    } catch {
      // ignore hourly errors — breakdown pode não estar disponível
    }

    await supabaseAdmin
      .from("ad_accounts")
      .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
      .eq("id", acc.id);

    return { ok: true, insights: upsertedInsights, creatives: upsertedCreatives, geo: upsertedGeo, whatsapp: upsertedWa, campaigns: upsertedCampaignInsights, hourly: upsertedHourly };
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
  .inputValidator((d: unknown) =>
    z.object({
      ad_account_id: z.string().uuid(),
      preset: z.enum(["last_30d", "last_90d", "last_6m", "last_year", "maximum"]).optional(),
      since: z.string().optional(),
      until: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: acc, error } = await context.supabase
      .from("ad_accounts")
      .select("id, provider")
      .eq("id", data.ad_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!acc) throw new Error("Conta não encontrada");
    if (acc.provider === "google") throw new Error("Google Ads: integração em breve. Meta Ads já está ativa.");
    const range: SyncRange | undefined =
      data.since && data.until ? { since: data.since, until: data.until }
      : data.preset ? { preset: data.preset }
      : undefined;
    return await syncMetaAccountInternal(data.ad_account_id, range);
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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      throw new Error("Configuração pública do banco indisponível.");
    }

    const supabasePublic = createClient<Database>(supabaseUrl, publishableKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (publishableKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publishableKey}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", publishableKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: payload, error } = await supabasePublic.rpc("get_public_report_payload", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!payload) throw new Error("Relatório não encontrado ou expirado.");
    return payload;
  });

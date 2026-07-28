/**
 * Busca criativos (ads) direto na Meta para um intervalo específico.
 * Usado quando o usuário escolhe um período no relatório: os registros salvos
 * em `ad_creatives` são agregados pela janela do último sync, então não servem
 * para filtrar por período. Aqui pedimos as insights com time_range exato e
 * devolvemos apenas os criativos que realmente rodaram nesse intervalo.
 */

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
  const body: any = await resp.json();
  if (!resp.ok || body.error) {
    throw new Error(`Meta API: ${body?.error?.message || `HTTP ${resp.status}`}`);
  }
  return body;
}

export async function fetchCreativesForPeriod(
  adAccountRowIds: string[],
  since: string,
  until: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: accounts } = await supabaseAdmin
    .from("ad_accounts")
    .select("id, account_id, access_token, provider")
    .in("id", adAccountRowIds);

  const out: any[] = [];

  for (const acc of accounts ?? []) {
    if (acc.provider !== "meta" || !acc.access_token) continue;
    const rawId = String(acc.account_id).trim();
    const accountId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
    const timeRange = JSON.stringify({ since, until });

    // Thumbnails já espelhadas no R2 (evita URLs expiradas do Meta).
    const { data: stored } = await supabaseAdmin
      .from("ad_creatives")
      .select("external_id, thumbnail_url, preview_url")
      .eq("ad_account_id", acc.id);
    const thumbs = new Map((stored ?? []).map((s: any) => [String(s.external_id), s]));

    const insightsFields = [
      "spend","impressions","reach","frequency","clicks","ctr","cpc","cpm","cpp",
      "actions","action_values","unique_actions","cost_per_action_type","cost_per_unique_action_type",
      "unique_link_clicks_ctr","cost_per_unique_link_click","unique_outbound_clicks",
      "unique_outbound_clicks_ctr","cost_per_unique_outbound_click","outbound_clicks",
      "video_play_actions","video_thruplay_watched_actions","video_p75_watched_actions","video_p25_watched_actions",
    ].join(",");

    const adsUrl = new URL(`https://graph.facebook.com/${META_V}/${accountId}/ads`);
    adsUrl.searchParams.set(
      "fields",
      `id,name,status,campaign_id,campaign{id,name},adset_id,adset{id,name},creative{thumbnail_url,image_url,object_story_spec,body,title},insights.time_range(${timeRange}){${insightsFields}}`,
    );
    adsUrl.searchParams.set("thumbnail_width", "600");
    adsUrl.searchParams.set("thumbnail_height", "600");
    adsUrl.searchParams.set("limit", "200");
    adsUrl.searchParams.set("access_token", acc.access_token);

    let ads: any;
    try {
      ads = await metaFetch(adsUrl);
    } catch (e: any) {
      console.error("[ads] creatives period fetch failed:", e?.message || e);
      continue;
    }

    for (const ad of ads.data ?? []) {
      const ins = ad.insights?.data?.[0];
      if (!ins) continue; // não rodou no período selecionado
      const spend = Number(ins.spend ?? 0);
      const impressions = Number(ins.impressions ?? 0);
      if (spend <= 0 && impressions <= 0) continue;

      const actions = ins.actions ?? [];
      const actionValues = ins.action_values ?? [];
      const uniqueActions = ins.unique_actions ?? [];
      const costPerUnique = ins.cost_per_unique_action_type ?? [];
      const creative = ad.creative ?? {};
      const story = creative?.object_story_spec ?? {};
      const storyPicture =
        story?.link_data?.picture || story?.video_data?.image_url || story?.photo_data?.url || null;
      const linkUrl =
        creative.link_url ||
        story?.link_data?.link ||
        story?.video_data?.call_to_action?.value?.link ||
        null;

      const purchases = pickAction(actions, "purchase") || pickAction(actions, "offsite_conversion.fb_pixel_purchase");
      const purchaseValue = pickAction(actionValues, "purchase") || pickAction(actionValues, "offsite_conversion.fb_pixel_purchase");
      const videoPlays = pickAction(ins.video_play_actions ?? [], "video_view");
      const video3s = pickAction(ins.video_thruplay_watched_actions ?? [], "video_view");
      const stored1 = thumbs.get(String(ad.id));

      out.push({
        id: `${acc.id}:${ad.id}`,
        ad_account_id: acc.id,
        external_id: String(ad.id),
        name: ad.name || creative.title || null,
        campaign_id: ad.campaign_id || ad.campaign?.id || null,
        campaign_name: ad.campaign?.name || null,
        adset_id: ad.adset_id || ad.adset?.id || null,
        adset_name: ad.adset?.name || null,
        thumbnail_url: stored1?.thumbnail_url || creative.thumbnail_url || storyPicture || null,
        preview_url: stored1?.preview_url || creative.image_url || storyPicture || creative.thumbnail_url || null,
        destination_url: linkUrl,
        status: ad.status || null,
        period_start: since,
        period_end: until,
        spend,
        impressions,
        clicks: Number(ins.clicks ?? 0),
        reach: Number(ins.reach ?? 0),
        results: pickResults(actions),
        ctr: ins.ctr ? Number(ins.ctr) : null,
        cpc: ins.cpc ? Number(ins.cpc) : null,
        cpm: ins.cpm ? Number(ins.cpm) : null,
        cpp: ins.cpp ? Number(ins.cpp) : null,
        frequency: ins.frequency ? Number(ins.frequency) : null,
        unique_link_clicks: pickAction(uniqueActions, "link_click"),
        unique_link_ctr: ins.unique_link_clicks_ctr ? Number(ins.unique_link_clicks_ctr) : null,
        unique_link_cpc: ins.cost_per_unique_link_click ? Number(ins.cost_per_unique_link_click) : null,
        unique_outbound_clicks: pickAction(ins.unique_outbound_clicks ?? [], "outbound_click"),
        unique_outbound_ctr: ins.unique_outbound_clicks_ctr?.[0]?.value ? Number(ins.unique_outbound_clicks_ctr[0].value) : null,
        unique_outbound_cpc: ins.cost_per_unique_outbound_click?.[0]?.value ? Number(ins.cost_per_unique_outbound_click[0].value) : null,
        landing_page_views: pickAction(actions, "landing_page_view"),
        cost_per_landing_page_view: pickAction(costPerUnique, "landing_page_view") || null,
        initiate_checkout: pickAction(actions, "initiate_checkout") || pickAction(actions, "offsite_conversion.fb_pixel_initiate_checkout"),
        cost_per_initiate_checkout: pickAction(costPerUnique, "initiate_checkout") || null,
        initiate_checkout_value: pickAction(actionValues, "initiate_checkout") || pickAction(actionValues, "offsite_conversion.fb_pixel_initiate_checkout"),
        purchases,
        cost_per_purchase: pickAction(costPerUnique, "purchase") || null,
        purchase_value: purchaseValue,
        roas: spend > 0 ? purchaseValue / spend : null,
        video_plays: videoPlays,
        video_p3s: video3s || videoPlays,
        video_p75: pickAction(ins.video_p75_watched_actions ?? [], "video_view"),
        messaging_conversations_started: pickAction(actions, "onsite_conversion.messaging_conversation_started_7d"),
      });
    }
  }

  return out.sort((a, b) => b.spend - a.spend);
}

/** Valida um token de relatório público e devolve os ad_account ids do cliente. */
export async function accountIdsForPublicToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: report } = await supabaseAdmin
    .from("public_reports")
    .select("client_id, active, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!report || !report.active) return [];
  if (report.expires_at && new Date(report.expires_at) < new Date()) return [];
  const { data: accs } = await supabaseAdmin
    .from("ad_accounts")
    .select("id")
    .eq("client_id", report.client_id);
  return (accs ?? []).map((a: any) => a.id);
}

ALTER TABLE public.public_reports
  ADD COLUMN IF NOT EXISTS default_period text NOT NULL DEFAULT 'current_month';

CREATE OR REPLACE FUNCTION public.get_public_report_payload(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_report public.public_reports%ROWTYPE;
  v_since date := (date_trunc('month', now()) - interval '12 months')::date;
  v_payload jsonb;
BEGIN
  SELECT *
    INTO v_report
    FROM public.public_reports
   WHERE token = _token
     AND active = true
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_report.id,
      'title', v_report.title,
      'default_period', v_report.default_period,
      'created_at', v_report.created_at
    ),
    'client', (
      SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'logo_url', c.logo_url,
        'city_uf', c.city_uf,
        'type', c.type,
        'investimento_mensal', c.investimento_mensal
      )
      FROM public.clients c
      WHERE c.id = v_report.client_id
    ),
    'agency', COALESCE((
      SELECT jsonb_build_object(
        'agency_name', s.agency_name,
        'agency_logo_url', s.agency_logo_url,
        'agency_primary_color', s.agency_primary_color
      )
      FROM public.app_settings s
      WHERE s.singleton = true
      LIMIT 1
    ), jsonb_build_object('agency_name', 'CloudOS', 'agency_logo_url', NULL, 'agency_primary_color', NULL)),
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'provider', a.provider,
        'account_name', a.account_name,
        'account_id', a.account_id,
        'last_sync_at', a.last_sync_at
      ) ORDER BY a.account_name NULLS LAST, a.account_id)
      FROM public.ad_accounts a
      WHERE a.client_id = v_report.client_id
        AND a.active = true
    ), '[]'::jsonb),
    'insights', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'ad_account_id', i.ad_account_id,
        'date', i.date,
        'spend', i.spend,
        'impressions', i.impressions,
        'clicks', i.clicks,
        'reach', i.reach,
        'results', i.results,
        'cpm', i.cpm,
        'ctr', i.ctr,
        'cpc', i.cpc,
        'raw', jsonb_build_object('actions', COALESCE(i.raw->'actions', '[]'::jsonb))
      ) ORDER BY i.date)
      FROM public.ad_insights i
      JOIN public.ad_accounts a ON a.id = i.ad_account_id
      WHERE a.client_id = v_report.client_id
        AND a.active = true
        AND i.date >= v_since
    ), '[]'::jsonb),
    'creatives', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'ad_account_id', c.ad_account_id,
        'external_id', c.external_id,
        'name', c.name,
        'campaign_id', c.campaign_id,
        'campaign_name', c.campaign_name,
        'adset_id', c.adset_id,
        'adset_name', c.adset_name,
        'thumbnail_url', c.thumbnail_url,
        'preview_url', c.preview_url,
        'destination_url', c.destination_url,
        'status', c.status,
        'spend', c.spend,
        'impressions', c.impressions,
        'clicks', c.clicks,
        'reach', c.reach,
        'results', c.results,
        'ctr', c.ctr,
        'cpc', c.cpc,
        'cpm', c.cpm,
        'cpp', c.cpp,
        'frequency', c.frequency,
        'unique_link_clicks', c.unique_link_clicks,
        'unique_link_ctr', c.unique_link_ctr,
        'unique_link_cpc', c.unique_link_cpc,
        'unique_outbound_clicks', c.unique_outbound_clicks,
        'unique_outbound_ctr', c.unique_outbound_ctr,
        'unique_outbound_cpc', c.unique_outbound_cpc,
        'landing_page_views', c.landing_page_views,
        'cost_per_landing_page_view', c.cost_per_landing_page_view,
        'initiate_checkout', c.initiate_checkout,
        'cost_per_initiate_checkout', c.cost_per_initiate_checkout,
        'initiate_checkout_value', c.initiate_checkout_value,
        'purchases', c.purchases,
        'cost_per_purchase', c.cost_per_purchase,
        'purchase_value', c.purchase_value,
        'roas', c.roas,
        'video_plays', c.video_plays,
        'video_p3s', c.video_p3s,
        'video_p75', c.video_p75,
        'messaging_conversations_started', c.messaging_conversations_started,
        'last_sync_at', c.last_sync_at
      ) ORDER BY c.spend DESC)
      FROM (
        SELECT cr.*
        FROM public.ad_creatives cr
        JOIN public.ad_accounts a ON a.id = cr.ad_account_id
        WHERE a.client_id = v_report.client_id
          AND a.active = true
        ORDER BY cr.spend DESC
        LIMIT 100
      ) c
    ), '[]'::jsonb),
    'geo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', g.id,
        'ad_account_id', g.ad_account_id,
        'period_start', g.period_start,
        'period_end', g.period_end,
        'country_code', g.country_code,
        'country_name', g.country_name,
        'region', g.region,
        'region_name', g.region_name,
        'city', g.city,
        'spend', g.spend,
        'impressions', g.impressions,
        'clicks', g.clicks,
        'reach', g.reach,
        'results', g.results
      ) ORDER BY g.spend DESC)
      FROM (
        SELECT geo.*
        FROM public.ad_geo geo
        JOIN public.ad_accounts a ON a.id = geo.ad_account_id
        WHERE a.client_id = v_report.client_id
          AND a.active = true
        ORDER BY geo.spend DESC
        LIMIT 300
      ) g
    ), '[]'::jsonb),
    'whatsapp', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', w.id,
        'ad_account_id', w.ad_account_id,
        'date', w.date,
        'impressions', w.impressions,
        'link_clicks', w.link_clicks,
        'conversations_started', w.conversations_started,
        'first_replies', w.first_replies
      ) ORDER BY w.date)
      FROM public.ad_funnel_whatsapp w
      JOIN public.ad_accounts a ON a.id = w.ad_account_id
      WHERE a.client_id = v_report.client_id
        AND a.active = true
        AND w.date >= v_since
    ), '[]'::jsonb),
    'campaignInsights', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'ad_account_id', ci.ad_account_id,
        'date', ci.date,
        'campaign_id', ci.campaign_id,
        'campaign_name', ci.campaign_name,
        'spend', ci.spend,
        'impressions', ci.impressions,
        'clicks', ci.clicks,
        'reach', ci.reach,
        'results', ci.results,
        'cpm', ci.cpm,
        'ctr', ci.ctr,
        'cpc', ci.cpc
      ) ORDER BY ci.date)
      FROM public.ad_campaign_insights ci
      JOIN public.ad_accounts a ON a.id = ci.ad_account_id
      WHERE a.client_id = v_report.client_id
        AND a.active = true
        AND ci.date >= v_since
    ), '[]'::jsonb),
    'hourly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'ad_account_id', h.ad_account_id,
        'date', h.date,
        'hour', h.hour,
        'dow', h.dow,
        'results', h.results,
        'spend', h.spend,
        'impressions', h.impressions,
        'clicks', h.clicks
      ) ORDER BY h.dow, h.hour)
      FROM public.ad_hourly_leads h
      JOIN public.ad_accounts a ON a.id = h.ad_account_id
      WHERE a.client_id = v_report.client_id
        AND a.active = true
    ), '[]'::jsonb)
  ) INTO v_payload;

  UPDATE public.public_reports
     SET view_count = view_count + 1,
         updated_at = now()
   WHERE id = v_report.id;

  RETURN v_payload;
END;
$function$;
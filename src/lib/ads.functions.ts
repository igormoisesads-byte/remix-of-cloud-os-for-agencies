import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Meta Ads sync ---------- */

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

  // last 30 days
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL(`https://graph.facebook.com/v20.0/${accountId}/insights`);
  url.searchParams.set("fields", "spend,impressions,clicks,reach,actions,cpm,ctr,cpc");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: fmt(since), until: fmt(until) }));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", acc.access_token);

  const resp = await fetch(url.toString());
  const body = await resp.json();
  if (!resp.ok || body.error) {
    const msg = body?.error?.message || `HTTP ${resp.status}`;
    await supabaseAdmin.from("ad_accounts").update({ last_sync_error: msg, last_sync_at: new Date().toISOString() }).eq("id", acc.id);
    throw new Error(`Meta API: ${msg}`);
  }

  const rows: any[] = body.data ?? [];
  let upserted = 0;
  for (const r of rows) {
    // Pick a sensible "results" count: prefer purchases, then leads, then link_clicks
    const actions: any[] = r.actions ?? [];
    const pick = (t: string) => Number(actions.find((a) => a.action_type === t)?.value ?? 0);
    const results =
      pick("purchase") ||
      pick("offsite_conversion.fb_pixel_purchase") ||
      pick("lead") ||
      pick("onsite_conversion.lead_grouped") ||
      pick("link_click") ||
      0;

    const payload = {
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
    };
    const { error: upErr } = await supabaseAdmin
      .from("ad_insights")
      .upsert(payload, { onConflict: "ad_account_id,date" });
    if (!upErr) upserted++;
  }

  await supabaseAdmin
    .from("ad_accounts")
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
    .eq("id", acc.id);

  return { ok: true, days: rows.length, upserted };
}

export const syncAdAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ad_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Ensure caller can see this account (RLS check)
    const { data: acc, error } = await context.supabase
      .from("ad_accounts")
      .select("id, provider")
      .eq("id", data.ad_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!acc) throw new Error("Conta não encontrada");
    if (acc.provider === "google") {
      throw new Error("Google Ads: integração em breve. Meta Ads já está ativa.");
    }
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

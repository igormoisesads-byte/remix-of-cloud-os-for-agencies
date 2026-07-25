import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const META_V = "v20.0";

async function metaGet(url: URL) {
  const r = await fetch(url.toString());
  const b = await r.json();
  if (!r.ok || b?.error) throw new Error(b?.error?.message || `HTTP ${r.status}`);
  return b;
}

function toCents(x: unknown): number {
  const n = Number(x ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Sync account balance + billing transactions from Meta for one ad account.
 * Called from ads sync and from the balance-check cron.
 */
export async function syncMetaBillingInternal(adAccountRowId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc, error } = await supabaseAdmin
    .from("ad_accounts")
    .select("*")
    .eq("id", adAccountRowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!acc) throw new Error("Conta não encontrada");
  if (acc.provider !== "meta") return { skipped: true };
  if (!acc.access_token) return { skipped: true, reason: "no_token" };

  const rawId = String(acc.account_id).trim();
  const accountId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
  const token = acc.access_token as string;

  // 1) Account balance / spend cap / funding
  let balanceCents: number | null = null;
  let amountSpentCents: number | null = null;
  let spendCapCents: number | null = null;
  let currency: string | null = null;
  let fundingType: string | null = null;

  try {
    const u = new URL(`https://graph.facebook.com/${META_V}/${accountId}`);
    u.searchParams.set(
      "fields",
      "balance,amount_spent,spend_cap,currency,funding_source_details,account_status",
    );
    u.searchParams.set("access_token", token);
    const info = await metaGet(u);
    // Meta returns balance/amount_spent/spend_cap in the account's currency,
    // as an integer string in the smallest unit (cents).
    balanceCents = info.balance != null ? Number(info.balance) : null;
    amountSpentCents = info.amount_spent != null ? Number(info.amount_spent) : null;
    spendCapCents = info.spend_cap != null ? Number(info.spend_cap) : null;
    currency = info.currency ?? null;
    fundingType = info.funding_source_details?.type ?? null;
  } catch (e: any) {
    await supabaseAdmin
      .from("ad_accounts")
      .update({ last_sync_error: `balance: ${e.message}`, balance_synced_at: new Date().toISOString() })
      .eq("id", acc.id);
    throw e;
  }

  // 2) Billing transactions (invoices/charges)
  let upsertedTx = 0;
  try {
    const u = new URL(`https://graph.facebook.com/${META_V}/${accountId}/transactions`);
    u.searchParams.set(
      "fields",
      "id,billing_start_time,billing_end_time,charge_type,product_type,status,payment_option,amount,vat,vat_invoice_id",
    );
    u.searchParams.set("limit", "100");
    u.searchParams.set("access_token", token);
    const tx = await metaGet(u);
    for (const t of tx.data ?? []) {
      const amt = t?.amount?.total ?? t?.amount ?? 0;
      const vat = t?.vat?.total ?? t?.vat ?? 0;
      const cur = t?.amount?.currency ?? currency ?? "BRL";
      const amountCents = toCents(amt);
      const vatCents = toCents(vat);
      const { error: e } = await supabaseAdmin.from("ad_billing_transactions").upsert(
        {
          ad_account_id: acc.id,
          transaction_id: String(t.id),
          billing_start_time: t.billing_start_time ?? null,
          billing_end_time: t.billing_end_time ?? null,
          charge_type: t.charge_type ?? null,
          product_type: t.product_type ?? null,
          status: t.status ?? null,
          payment_option: t.payment_option ?? null,
          currency: cur,
          amount_cents: amountCents,
          vat_cents: vatCents,
          net_cents: amountCents - vatCents,
          raw: t,
        },
        { onConflict: "ad_account_id,transaction_id" },
      );
      if (!e) upsertedTx++;
    }
  } catch {
    // transactions endpoint may require ads_management + billing permissions; ignore
  }

  // 3) Compute days remaining
  const taxRate = Number(acc.tax_rate ?? 0.1215);
  const since = new Date(); since.setDate(since.getDate() - 7);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data: ins } = await supabaseAdmin
    .from("ad_insights")
    .select("spend")
    .eq("ad_account_id", acc.id)
    .gte("date", sinceStr);
  const spent7 = (ins ?? []).reduce((s, r: any) => s + Number(r.spend ?? 0), 0);
  const days = Math.max(1, ins?.length ?? 7);
  const avgDailyGross = spent7 / days;
  const avgDailyWithTax = avgDailyGross * (1 + taxRate);

  let daysRemaining: number | null = null;
  if (avgDailyWithTax > 0) {
    if (balanceCents && balanceCents > 0) {
      daysRemaining = balanceCents / 100 / avgDailyWithTax;
    } else if (spendCapCents && amountSpentCents != null && spendCapCents > amountSpentCents) {
      daysRemaining = (spendCapCents - amountSpentCents) / 100 / avgDailyWithTax;
    }
  }

  await supabaseAdmin
    .from("ad_accounts")
    .update({
      balance_cents: balanceCents,
      amount_spent_cents: amountSpentCents,
      spend_cap_cents: spendCapCents,
      currency,
      funding_type: fundingType,
      balance_synced_at: new Date().toISOString(),
      last_low_balance_days: daysRemaining,
    })
    .eq("id", acc.id);

  return {
    ok: true,
    balance_cents: balanceCents,
    amount_spent_cents: amountSpentCents,
    spend_cap_cents: spendCapCents,
    currency,
    tax_rate: taxRate,
    avg_daily_gross: avgDailyGross,
    avg_daily_with_tax: avgDailyWithTax,
    days_remaining: daysRemaining,
    transactions: upsertedTx,
  };
}

export const syncBillingForAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ad_account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => syncMetaBillingInternal(data.ad_account_id));

export const listClientBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: accounts } = await context.supabase
      .from("ad_accounts")
      .select("id, provider, account_name, account_id, currency, balance_cents, amount_spent_cents, spend_cap_cents, funding_type, tax_rate, low_balance_days_threshold, balance_synced_at, last_low_balance_days")
      .eq("client_id", data.client_id);
    const ids = (accounts ?? []).map((a) => a.id);
    const { data: tx } = ids.length
      ? await context.supabase
          .from("ad_billing_transactions")
          .select("*")
          .in("ad_account_id", ids)
          .order("billing_end_time", { ascending: false })
          .limit(50)
      : { data: [] as any[] };
    return { accounts: accounts ?? [], transactions: tx ?? [] };
  });

export const PREPAID_WARN_DAYS = 7;
export const PREPAID_CRITICAL_DAYS = 1.5;

export function classifyFunding(fundingType?: string | null): "prepaid" | "postpaid" {
  const t = String(fundingType ?? "").toUpperCase();
  if (!t) return "postpaid";
  if (t.includes("PREPAID") || t.includes("FUNDS") || t.includes("BOLETO") || t.includes("PIX")) return "prepaid";
  return "postpaid";
}

export const listLowBalanceAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: accounts } = await context.supabase
      .from("ad_accounts")
      .select("id, account_name, currency, funding_type, balance_cents, amount_spent_cents, spend_cap_cents, tax_rate, last_low_balance_days, low_balance_days_threshold, balance_synced_at, clients(id, name, logo_url)")
      .eq("active", true)
      .eq("provider", "meta");

    const ids = (accounts ?? []).map((a: any) => a.id);
    const { data: tx } = ids.length
      ? await context.supabase
          .from("ad_billing_transactions")
          .select("ad_account_id, status, billing_end_time, amount_cents, currency, payment_option")
          .in("ad_account_id", ids)
          .order("billing_end_time", { ascending: false })
          .limit(500)
      : { data: [] as any[] };

    const txByAcc = new Map<string, any[]>();
    for (const t of tx ?? []) {
      const arr = txByAcc.get(t.ad_account_id) ?? [];
      arr.push(t);
      txByAcc.set(t.ad_account_id, arr);
    }

    const now = Date.now();
    const rows = (accounts ?? []).map((a: any) => {
      const kind = classifyFunding(a.funding_type);
      const list = txByAcc.get(a.id) ?? [];
      if (kind === "prepaid") {
        const d = a.last_low_balance_days != null ? Number(a.last_low_balance_days) : null;
        if (d == null) return null;
        let severity: "critical" | "warning" | null = null;
        if (d <= PREPAID_CRITICAL_DAYS) severity = "critical";
        else if (d <= PREPAID_WARN_DAYS) severity = "warning";
        if (!severity) return null;
        return { ...a, kind, severity, days_remaining: d };
      }
      const failed = list.find((t: any) => /fail|error|declin/i.test(String(t.status ?? "")));
      const upcoming = list
        .map((t: any) => (t.billing_end_time ? new Date(t.billing_end_time).getTime() : 0))
        .filter((n: number) => n >= now)
        .sort((x: number, y: number) => x - y)[0];
      const hoursToNext = upcoming ? (upcoming - now) / 3_600_000 : null;
      let severity: "critical" | "warning" | null = null;
      let reason: string | null = null;
      if (failed) { severity = "critical"; reason = "payment_failed"; }
      else if (hoursToNext != null && hoursToNext <= 36) { severity = "warning"; reason = "charge_tomorrow"; }
      if (!severity) return null;
      return {
        ...a,
        kind,
        severity,
        reason,
        next_charge_at: upcoming ? new Date(upcoming).toISOString() : null,
        last_failed_tx: failed ?? null,
      };
    }).filter(Boolean) as any[];

    rows.sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1));
    return rows;
  });

export const updateAccountBillingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ad_account_id: z.string().uuid(),
      tax_rate: z.number().min(0).max(1).optional(),
      low_balance_days_threshold: z.number().int().min(1).max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { tax_rate?: number; low_balance_days_threshold?: number } = {};
    if (data.tax_rate != null) patch.tax_rate = data.tax_rate;
    if (data.low_balance_days_threshold != null) patch.low_balance_days_threshold = data.low_balance_days_threshold;
    const { error } = await context.supabase.from("ad_accounts").update(patch).eq("id", data.ad_account_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

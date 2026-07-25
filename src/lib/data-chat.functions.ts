import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type Input = {
  clientId: string;
  messages: ChatMsg[];
  period_start?: string | null;
  period_end?: string | null;
};

const MODEL = "gpt-5.4-nano";

export const chatWithClientData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
    const { supabase } = context;

    const end = data.period_end || new Date().toISOString().slice(0, 10);
    const startDefault = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const start = data.period_start || startDefault;

    const { data: client } = await supabase
      .from("clients")
      .select("id,name,type,platform,city_uf,investimento_mensal,contract_start,contract_end")
      .eq("id", data.clientId).maybeSingle();
    if (!client) throw new Error("Cliente não encontrado");

    const accountIds =
      ((await supabase.from("ad_accounts").select("id").eq("client_id", data.clientId)).data ?? [])
        .map((a: any) => a.id);

    const [{ data: insights }, { data: creatives }, { data: geo }, { data: wa }, { data: campaigns }, { data: sales }] = await Promise.all([
      accountIds.length
        ? supabase.from("ad_insights").select("date,spend,impressions,clicks,reach,results")
            .in("ad_account_id", accountIds).gte("date", start).lte("date", end).order("date")
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabase.from("ad_creatives").select("name,campaign_name,spend,clicks,impressions,results,ctr,cpc")
            .in("ad_account_id", accountIds).order("spend", { ascending: false }).limit(15)
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabase.from("ad_geo").select("country_code,spend,clicks,results")
            .in("ad_account_id", accountIds).order("spend", { ascending: false }).limit(15)
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabase.from("ad_funnel_whatsapp").select("date,impressions,link_clicks,conversations_started,first_replies")
            .in("ad_account_id", accountIds).gte("date", start).lte("date", end)
        : Promise.resolve({ data: [] as any[] }),
      accountIds.length
        ? supabase.from("ad_campaign_insights").select("date,campaign_name,spend,impressions,clicks,results")
            .in("ad_account_id", accountIds).gte("date", start).lte("date", end)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("client_sales").select("ref_date,weekday,hour,leads,agendamentos,vendas,faturamento")
        .eq("client_id", data.clientId).gte("ref_date", start).lte("ref_date", end),
    ]);

    const totals = (insights ?? []).reduce((a: any, r: any) => ({
      spend: a.spend + Number(r.spend || 0),
      impressions: a.impressions + Number(r.impressions || 0),
      clicks: a.clicks + Number(r.clicks || 0),
      reach: a.reach + Number(r.reach || 0),
      results: a.results + Number(r.results || 0),
    }), { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 });

    const salesTotals = (sales ?? []).reduce((a: any, r: any) => ({
      leads: a.leads + Number(r.leads || 0),
      agendamentos: a.agendamentos + Number(r.agendamentos || 0),
      vendas: a.vendas + Number(r.vendas || 0),
      faturamento: a.faturamento + Number(r.faturamento || 0),
    }), { leads: 0, agendamentos: 0, vendas: 0, faturamento: 0 });

    const context_str = JSON.stringify({
      cliente: { nome: client.name, tipo: client.type, cidade: client.city_uf },
      periodo: { start, end },
      totais_midia: totals,
      totais_vendas: salesTotals,
      top_campanhas: (campaigns ?? []).slice(0, 8),
      top_criativos: (creatives ?? []).slice(0, 8),
      top_paises: geo,
      whatsapp_diario: wa,
      vendas_diario: sales,
    }, null, 2);

    const system = `Você é o CloudOS AI — um especialista em tráfego pago que conversa com o gestor sobre os dados REAIS de um cliente.
Responda em pt-BR, direto, objetivo, com bullet points quando útil. Use números com R$ e separador de milhar.
Se não houver dado suficiente, diga isso claramente e sugira o que sincronizar/registrar. Nunca invente números.

DADOS DO CLIENTE:
${context_str}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Aguarde alguns instantes.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`Falha na IA (${resp.status}): ${t.slice(0, 200)}`);
    }
    const json: any = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    return { content };
  });

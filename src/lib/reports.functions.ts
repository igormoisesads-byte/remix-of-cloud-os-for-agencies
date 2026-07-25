import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  clientId: string;
  kind: "semanal" | "mensal" | "total";
  period_start?: string | null;
  period_end?: string | null;
  extra?: string | null;
};

const MODEL = "gpt-4o-mini";

export const generateAiReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

    const { supabase } = context;

    // Client info
    const { data: client, error: cErr } = await supabase
      .from("clients")
      .select("id,name,type,platform,site,city_uf,niche_id,investimento_mensal,contract_start")
      .eq("id", data.clientId)
      .maybeSingle();
    if (cErr || !client) throw new Error("Cliente não encontrado");

    // Ad insights in window (default last 30d)
    const end = data.period_end || new Date().toISOString().slice(0, 10);
    const startDefault = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const start = data.period_start || startDefault;

    const { data: insights } = await supabase
      .from("ad_insights")
      .select("date, spend, impressions, clicks, reach, conversions, provider")
      .gte("date", start)
      .lte("date", end)
      .in("ad_account_id",
        ((await supabase.from("ad_accounts").select("id").eq("client_id", data.clientId)).data ?? []).map((a: any) => a.id),
      )
      .order("date");

    const totals = (insights ?? []).reduce(
      (acc: any, r: any) => ({
        spend: acc.spend + Number(r.spend || 0),
        impressions: acc.impressions + Number(r.impressions || 0),
        clicks: acc.clicks + Number(r.clicks || 0),
        reach: acc.reach + Number(r.reach || 0),
        conversions: acc.conversions + Number(r.conversions || 0),
      }),
      { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 },
    );

    const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks ? totals.spend / totals.clicks : 0;
    const cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0;
    const cpa = totals.conversions ? totals.spend / totals.conversions : 0;

    const dataSummary = {
      cliente: client.name,
      tipo_cliente: client.type,
      plataforma: client.platform,
      cidade: client.city_uf,
      periodo: { start, end, dias: (insights ?? []).length },
      totais: totals,
      metricas: { ctr, cpc, cpm, cpa },
      diario: (insights ?? []).slice(-14),
    };

    const focus = client.type === "local"
      ? "cliente LOCAL: foco em WhatsApp, ligações, tráfego para site e presença regional"
      : "cliente ONLINE: foco em conversões, leads, ROAS e escala";

    const prompt = `Você é um analista de tráfego pago sênior. Gere um RELATÓRIO ${data.kind.toUpperCase()} em markdown, direto ao ponto, para apresentar ao cliente.

Contexto do cliente (${focus}):
${JSON.stringify(dataSummary, null, 2)}
${data.extra ? `\nObservações extras do gestor:\n${data.extra}` : ""}

Estruture assim, em markdown:

# Relatório ${data.kind} — ${client.name}
**Período:** ${start} a ${end}

## Resumo executivo
2-3 parágrafos com o que aconteceu e o principal insight.

## Números do período
Tabela markdown com: Investimento, Impressões, Alcance, Cliques, CTR, CPC, CPM, Conversões, CPA.

## Análise de performance
O que os números indicam. Comparações internas (evolução dia a dia se relevante). Pontos fortes e gargalos.

## Recomendações para o próximo ciclo
Lista de 3 a 6 ações concretas, priorizadas.

## Próximos passos
Compromissos claros da agência com o cliente.

Regras: use pt-BR, valores em R$ com separador de milhar, nunca invente números fora dos fornecidos, se não houver dados de anúncios diga claramente "sem dados de anúncios sincronizados no período" e recomende conectar/sincronizar a conta.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Você gera relatórios de mídia paga claros, honestos e acionáveis." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha na IA (${resp.status}): ${text.slice(0, 200)}`);
    }

    const json: any = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("A IA retornou vazio.");

    const title = `Relatório ${data.kind} — ${start} a ${end}`;
    const { data: saved, error: sErr } = await supabase
      .from("client_reports")
      .insert({
        client_id: data.clientId,
        kind: data.kind,
        title,
        period_start: start,
        period_end: end,
        ai_content: content,
        ai_model: MODEL,
        ai_generated_at: new Date().toISOString(),
        created_by: context.userId,
      })
      .select()
      .single();
    if (sErr) throw new Error(sErr.message);

    return saved;
  });

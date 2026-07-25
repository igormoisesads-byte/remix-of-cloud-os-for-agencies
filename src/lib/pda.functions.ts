import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  pdaId: string;
  horizonte?: "proxima_semana" | "proximo_mes" | "proximo_trimestre";
  contextoExtra?: string | null;
};

const MODEL = "gpt-5.4-nano";

export const generatePdaPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
    const { supabase } = context;

    const { data: pda, error } = await supabase
      .from("pdas")
      .select("id,title,description,priority,due_date,client_id,clients(name,type,platform,investimento_mensal)")
      .eq("id", data.pdaId)
      .maybeSingle();
    if (error || !pda) throw new Error("PDA não encontrado");

    const client: any = (pda as any).clients ?? {};
    const horizonte = data.horizonte ?? "proximo_mes";
    const horizonteLabel = { proxima_semana: "próxima semana", proximo_mes: "próximo mês", proximo_trimestre: "próximo trimestre" }[horizonte];

    // últimas insights do cliente
    const { data: accounts } = await supabase.from("ad_accounts").select("id").eq("client_id", pda.client_id);
    const ids = (accounts ?? []).map((a: any) => a.id);
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: insights } = ids.length
      ? await supabase.from("ad_insights").select("date,spend,clicks,impressions,conversions").in("ad_account_id", ids).gte("date", since).order("date")
      : { data: [] };
    const totals = (insights ?? []).reduce(
      (a: any, r: any) => ({
        spend: a.spend + Number(r.spend || 0),
        clicks: a.clicks + Number(r.clicks || 0),
        impressions: a.impressions + Number(r.impressions || 0),
        conversions: a.conversions + Number(r.conversions || 0),
      }),
      { spend: 0, clicks: 0, impressions: 0, conversions: 0 },
    );

    const prompt = `Você é um consultor sênior de tráfego pago e Customer Success. Monte um PLANO DE AÇÃO detalhado para o ${horizonteLabel}, para resolver este PDA:

Cliente: ${client.name} (${client.type ?? "?"} · ${client.platform ?? "?"})
Investimento mensal: R$ ${Number(client.investimento_mensal ?? 0).toLocaleString("pt-BR")}
Últimos 30 dias: ${JSON.stringify(totals)}

Título do PDA: ${pda.title}
Descrição: ${pda.description ?? "-"}
Prioridade: ${pda.priority}
${pda.due_date ? `Prazo: ${pda.due_date}` : ""}
${data.contextoExtra ? `\nContexto adicional do gestor:\n${data.contextoExtra}` : ""}

Retorne APENAS um JSON válido no formato:
{
  "resumo": "1 parágrafo do diagnóstico e da meta principal",
  "meta": "meta mensurável e datada",
  "steps": [
    { "title": "...", "description": "detalhamento tático em 1-3 frases", "prazo_dias": 3, "responsavel_sugerido": "Gestor|CS|Performance|Head" }
  ]
}

Regras:
- Entre 4 e 8 steps sequenciais.
- Descreva ações concretas (o que fazer, onde, como medir).
- Use pt-BR.
- Nada além do JSON.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Você devolve exclusivamente JSON válido, sem cercas de código." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) throw new Error("Limite de uso da IA atingido.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
      throw new Error(`IA falhou (${resp.status}): ${t.slice(0, 200)}`);
    }
    const json: any = await resp.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { throw new Error("Resposta da IA não é JSON válido"); }

    const steps: any[] = Array.isArray(parsed?.steps) ? parsed.steps : [];
    if (!steps.length) throw new Error("IA não retornou passos");

    const today = new Date();
    const rows = steps.map((s, i) => {
      const prazo = Number(s.prazo_dias) || (i + 1) * 3;
      const due = new Date(today.getTime() + prazo * 86400000).toISOString().slice(0, 10);
      return {
        pda_id: pda.id,
        position: i,
        title: String(s.title ?? `Passo ${i + 1}`).slice(0, 200),
        description: [s.description, s.responsavel_sugerido ? `Sugerido: ${s.responsavel_sugerido}` : null].filter(Boolean).join("\n\n"),
        due_date: due,
        status: "aberto",
        created_by: context.userId,
      };
    });

    const { error: insErr } = await supabase.from("pda_action_steps").insert(rows);
    if (insErr) throw new Error(insErr.message);

    // grava resumo/meta no próprio PDA
    await supabase.from("pdas").update({
      description: `${pda.description ? pda.description + "\n\n---\n\n" : ""}**Meta IA:** ${parsed.meta ?? "-"}\n\n${parsed.resumo ?? ""}`,
    }).eq("id", pda.id);

    return { steps: rows.length, meta: parsed.meta, resumo: parsed.resumo };
  });

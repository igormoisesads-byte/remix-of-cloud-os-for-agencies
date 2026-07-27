export type ClientFocus = "local" | "perpetuo";

export interface CreativeMetricsInput {
  impressions?: number | null;
  video_p3s?: number | null;
  video_p75?: number | null;
  landing_page_views?: number | null;
  unique_link_clicks?: number | null;
  unique_outbound_clicks?: number | null;
  initiate_checkout?: number | null;
  purchases?: number | null;
  messaging_conversations_started?: number | null;
}

export interface ScoredMetric {
  key: "playrate_hook" | "retencao_hook" | "conversao_body" | "retencao_75_body" | "medidor_cta";
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
  status: "good" | "ok" | "bad" | "empty";
  hint: string;
}

const n = (x: unknown) => (typeof x === "number" ? x : Number(x ?? 0)) || 0;

function rate(num: number, den: number): number | null {
  if (!den) return null;
  return (num / den) * 100;
}

// Health thresholds per Cloud OS playbook
const THRESHOLDS: Record<ScoredMetric["key"], { good: number; ok: number }> = {
  playrate_hook: { good: 25, ok: 15 },
  retencao_hook: { good: 15, ok: 8 },
  conversao_body: { good: 8, ok: 4 },
  retencao_75_body: { good: 40, ok: 20 },
  medidor_cta: { good: 25, ok: 10 },
};

function statusFor(key: ScoredMetric["key"], value: number | null): ScoredMetric["status"] {
  if (value == null) return "empty";
  const t = THRESHOLDS[key];
  if (value >= t.good) return "good";
  if (value >= t.ok) return "ok";
  return "bad";
}

export function scoreCreative(input: CreativeMetricsInput, focus: ClientFocus): ScoredMetric[] {
  const impressions = n(input.impressions);
  const p3s = n(input.video_p3s);
  const p75 = n(input.video_p75);
  const lpv = n(input.landing_page_views);
  const linkClicks = n(input.unique_link_clicks);
  const outbound = n(input.unique_outbound_clicks);
  const init = n(input.initiate_checkout);
  const purchases = n(input.purchases);
  const messages = n(input.messaging_conversations_started);

  const playrate = rate(p3s, impressions);
  const retencaoHook = rate(p75, p3s);

  const conversaoBodyNum = focus === "perpetuo" ? lpv : linkClicks;
  const conversaoBody = rate(conversaoBodyNum, p3s);

  const retencao75Num = focus === "perpetuo" ? init : outbound;
  const retencao75Den = focus === "perpetuo" ? lpv : linkClicks;
  const retencao75 = rate(retencao75Num, retencao75Den);

  const ctaNum = focus === "perpetuo" ? purchases : messages;
  const ctaDen = focus === "perpetuo" ? init : outbound;
  const medidorCta = rate(ctaNum, ctaDen);

  const out: ScoredMetric[] = [
    {
      key: "playrate_hook",
      label: "Hook Rate (Gancho)",
      value: playrate,
      numerator: p3s,
      denominator: impressions,
      status: statusFor("playrate_hook", playrate),
      hint: "Vídeo 3s ÷ impressões — o ideal é acima de 15% a 20%.",
    },
    {
      key: "retencao_hook",
      label: "Body Hold Rate (Retenção do Vídeo)",
      value: retencaoHook,
      numerator: p75,
      denominator: p3s,
      status: statusFor("retencao_hook", retencaoHook),
      hint: "Vídeo 75% ÷ vídeo 3s — quantos passaram do gancho e viram quase tudo.",
    },
    {
      key: "conversao_body",
      label: "Conversão do Corpo",
      value: conversaoBody,
      numerator: conversaoBodyNum,
      denominator: p3s,
      status: statusFor("conversao_body", conversaoBody),
      hint: focus === "perpetuo"
        ? "Landing views ÷ vídeo 3s — o meio do vídeo gerou clique e a página carregou."
        : "Cliques no link únicos ÷ vídeo 3s — o argumento gerou desejo de clique.",
    },
    {
      key: "retencao_75_body",
      label: focus === "perpetuo" ? "Qualidade do Clique" : "Qualidade do Clique (Outbound CTR)",
      value: retencao75,
      numerator: retencao75Num,
      denominator: retencao75Den,
      status: statusFor("retencao_75_body", retencao75),
      hint: focus === "perpetuo"
        ? "Checkouts iniciados ÷ Landing views — convenceu a abrir o checkout."
        : "Cliques de saída únicos ÷ cliques no link únicos — intenção real de sair da rede.",
    },
    {
      key: "medidor_cta",
      label: "Medidor do CTA",
      value: medidorCta,
      numerator: ctaNum,
      denominator: ctaDen,
      status: statusFor("medidor_cta", medidorCta),
      hint: focus === "perpetuo"
        ? "Compras ÷ Checkouts iniciados — fechamento da oferta."
        : "Conversas iniciadas ÷ Cliques de saída únicos — conversão do script/página.",
    },
  ];
  return out;
}

export function aggregateScores(list: CreativeMetricsInput[], focus: ClientFocus): ScoredMetric[] {
  const agg: CreativeMetricsInput = list.reduce<CreativeMetricsInput>((a, c) => ({
    impressions: n(a.impressions) + n(c.impressions),
    video_p3s: n(a.video_p3s) + n(c.video_p3s),
    video_p75: n(a.video_p75) + n(c.video_p75),
    landing_page_views: n(a.landing_page_views) + n(c.landing_page_views),
    unique_link_clicks: n(a.unique_link_clicks) + n(c.unique_link_clicks),
    unique_outbound_clicks: n(a.unique_outbound_clicks) + n(c.unique_outbound_clicks),
    initiate_checkout: n(a.initiate_checkout) + n(c.initiate_checkout),
    purchases: n(a.purchases) + n(c.purchases),
    messaging_conversations_started: n(a.messaging_conversations_started) + n(c.messaging_conversations_started),
  }), {});
  return scoreCreative(agg, focus);
}

export function focusFromClientType(type?: string | null): ClientFocus {
  const t = (type ?? "").toLowerCase();
  if (t.includes("local")) return "local";
  return "perpetuo";
}

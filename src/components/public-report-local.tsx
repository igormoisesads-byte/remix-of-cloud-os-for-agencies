import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, MousePointerClick, Eye, Users, Target, TrendingUp, MapPin, Calendar } from "lucide-react";
import { CreativeThumb } from "@/components/creative-thumb";
import { CreativeDetailDialog } from "@/components/creative-detail-dialog";


/**
 * Template PÚBLICO fixo para NEGÓCIO LOCAL.
 * Foco: WhatsApp / conversas / leads regionais.
 * Sem tabs — layout linear, pronto para o cliente ler direto.
 */

type Props = {
  insights: any[];
  creatives: any[];
  geo: any[];
  whatsapp: any[];
  campaignInsights?: any[];
  client: { name: string; investimento_mensal?: number | null };
};

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const INT = (v: number) => Number(v || 0).toLocaleString("pt-BR");
const PCT = (v: number) => `${(v || 0).toFixed(1)}%`;
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PublicReportLocal({ insights, creatives, geo, whatsapp, client }: Props) {
  const totals = useMemo(() => {
    const t = insights.reduce(
      (a, r) => ({
        spend: a.spend + Number(r.spend || 0),
        impressions: a.impressions + Number(r.impressions || 0),
        clicks: a.clicks + Number(r.clicks || 0),
        reach: a.reach + Number(r.reach || 0),
      }),
      { spend: 0, impressions: 0, clicks: 0, reach: 0 },
    );
    const conversas = whatsapp.reduce((a, r) => a + Number(r.messaging_conversations_started || 0), 0);
    const novosContatos = whatsapp.reduce((a, r) => a + Number(r.new_contacts || 0), 0);
    const ctr = t.impressions ? (t.clicks / t.impressions) * 100 : 0;
    const cpc = t.clicks ? t.spend / t.clicks : 0;
    const cpm = t.impressions ? (t.spend / t.impressions) * 1000 : 0;
    const custoConversa = conversas ? t.spend / conversas : 0;
    return { ...t, conversas, novosContatos, ctr, cpc, cpm, custoConversa };
  }, [insights, whatsapp]);

  const meta = Number(client.investimento_mensal || 0);
  const pctMeta = meta ? (totals.spend / meta) * 100 : 0;

  // Melhor dia da semana
  const bestDay = useMemo(() => {
    const buckets = Array(7).fill(0).map(() => ({ spend: 0, results: 0 }));
    for (const r of insights) {
      const d = new Date((r.date as string) + "T00:00").getDay();
      buckets[d].spend += Number(r.spend || 0);
      buckets[d].results += Number(r.conversions || 0);
    }
    return buckets;
  }, [insights]);

  // Regiões (top 5)
  const regions = useMemo(() => {
    const m = new Map<string, { region: string; spend: number; results: number }>();
    for (const g of geo) {
      const key = `${g.region || "—"} · ${g.country || ""}`;
      const cur = m.get(key) ?? { region: key, spend: 0, results: 0 };
      cur.spend += Number(g.spend || 0);
      cur.results += Number(g.results || g.conversions || 0);
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.spend - a.spend).slice(0, 5);
  }, [geo]);

  const totalRegionSpend = regions.reduce((a, r) => a + r.spend, 0) || 1;

  // Top 3 criativos por gasto
  const topCreatives = useMemo(
    () => [...creatives].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0)).slice(0, 3),
    [creatives],
  );
  const [selectedCreative, setSelectedCreative] = useState<any | null>(null);


  // Funil: Impressões → Cliques → Conversas → Novos contatos
  const funnel = [
    { label: "Impressões", value: totals.impressions, color: "#3b82f6", icon: Eye },
    { label: "Cliques no anúncio", value: totals.clicks, color: "#8b5cf6", icon: MousePointerClick },
    { label: "Conversas iniciadas", value: totals.conversas, color: "#10b981", icon: MessageCircle },
    { label: "Novos contatos", value: totals.novosContatos, color: "#059669", icon: Users },
  ];

  if (totals.impressions === 0 && totals.spend === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Ainda não há dados sincronizados para exibir. As métricas aparecerão aqui em breve.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs de topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiHero icon={<Target className="h-4 w-4" />} label="Investido no período" value={BRL(totals.spend)} accent="primary" />
        <KpiHero icon={<MessageCircle className="h-4 w-4" />} label="Conversas iniciadas" value={INT(totals.conversas)} accent="emerald" />
        <KpiHero icon={<TrendingUp className="h-4 w-4" />} label="Custo por conversa" value={totals.conversas ? BRL(totals.custoConversa) : "—"} accent="violet" />
        <KpiHero icon={<Users className="h-4 w-4" />} label="Alcance único" value={INT(totals.reach)} accent="primary" />
      </div>

      {/* Investimento vs meta */}
      {meta > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Investimento vs meta do mês</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
              <div>
                <div className="text-2xl font-bold tabular-nums">{BRL(totals.spend)}</div>
                <div className="text-xs text-muted-foreground">Meta: {BRL(meta)} · {PCT(pctMeta)} usado</div>
              </div>
              <div className="text-sm text-muted-foreground">Restante: <span className="font-semibold text-foreground">{BRL(Math.max(0, meta - totals.spend))}</span></div>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, pctMeta)}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funil WhatsApp */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-600" /> Funil de conversas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {funnel.map((s, i) => {
              const w = 100 - i * 15;
              const prev = i > 0 ? funnel[i - 1].value : 0;
              const conv = prev ? (s.value / prev) * 100 : 0;
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div
                    className="text-white rounded-md px-4 py-3 flex items-center justify-between shadow-sm transition-all"
                    style={{ width: `${w}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}dd)` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="text-xs sm:text-sm font-medium truncate">{s.label}</span>
                    </div>
                    <span className="text-sm sm:text-base font-bold tabular-nums ml-2">{INT(s.value)}</span>
                  </div>
                  {i > 0 && (
                    <div className="text-xs sm:text-sm font-semibold text-emerald-600 tabular-nums w-14 text-right">
                      {conv.toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2 col: Regiões + Melhor dia */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> De onde vêm seus leads</CardTitle>
          </CardHeader>
          <CardContent>
            {regions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Sem dados de região no período.</div>
            ) : (
              <div className="space-y-2.5">
                {regions.map((r, i) => (
                  <div key={r.region}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="truncate font-medium">{i + 1}. {r.region}</span>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">{BRL(r.spend)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(r.spend / totalRegionSpend) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Melhor dia da semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {bestDay.map((d, i) => {
                const max = Math.max(...bestDay.map(x => x.spend)) || 1;
                const intensity = d.spend / max;
                return (
                  <div key={i} className="text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">{DAYS_PT[i]}</div>
                    <div
                      className="rounded-md py-3 text-xs font-semibold tabular-nums"
                      style={{
                        background: `color-mix(in oklch, hsl(var(--primary)) ${Math.round(intensity * 100)}%, hsl(var(--muted)))`,
                        color: intensity > 0.5 ? "white" : "hsl(var(--foreground))",
                      }}
                    >
                      {d.spend > 0 ? BRL(d.spend).replace("R$", "").trim() : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Intensidade proporcional ao investimento diário no período.</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de veiculação */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Métricas de veiculação</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MiniStat label="Impressões" value={INT(totals.impressions)} />
            <MiniStat label="Cliques" value={INT(totals.clicks)} />
            <MiniStat label="CTR" value={PCT(totals.ctr)} />
            <MiniStat label="CPC" value={totals.clicks ? BRL(totals.cpc) : "—"} />
            <MiniStat label="CPM" value={totals.impressions ? BRL(totals.cpm) : "—"} />
          </div>
        </CardContent>
      </Card>

      {/* Top criativos */}
      {topCreatives.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Anúncios com maior investimento</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {topCreatives.map((c, i) => (
                <div
                  key={c.id || i}
                  className="rounded-lg border overflow-hidden bg-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedCreative(c)}
                >
                  <div className="w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    <CreativeThumb src={(c as any).preview_url || c.thumbnail_url} fallbackSrc={c.thumbnail_url} alt={c.name || "Criativo"} eager />
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="text-sm font-medium truncate">{c.name || "Sem nome"}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Investido</span>
                      <span className="font-semibold text-foreground tabular-nums">{BRL(Number(c.spend || 0))}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Impressões</span>
                      <span className="tabular-nums">{INT(Number(c.impressions || 0))}</span>
                    </div>
                    <div className="text-[10px] text-primary pt-1">Ver métricas completas</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CreativeDetailDialog creative={selectedCreative} focus="local" onOpenChange={(o) => !o && setSelectedCreative(null)} />
    </div>

  );
}

function KpiHero({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: "primary" | "emerald" | "violet" }) {
  const color = accent === "primary" ? "text-primary" : accent === "emerald" ? "text-emerald-600" : "text-violet-600";
  const bg = accent === "primary" ? "bg-primary/10" : accent === "emerald" ? "bg-emerald-500/10" : "bg-violet-500/10";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${bg} ${color}`}>{icon}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      </div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums truncate ${color}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-0.5 truncate">{value}</div>
    </div>
  );
}

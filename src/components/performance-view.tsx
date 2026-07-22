import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import { BarChart3, Globe2, MessageCircle, Image as ImageIcon, ExternalLink, MousePointerClick } from "lucide-react";

export type PerfData = {
  insights: any[];
  creatives: any[];
  geo: any[];
  whatsapp: any[];
  accounts?: any[];
};

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function fmtInt(v: number | null | undefined) {
  return Number(v ?? 0).toLocaleString("pt-BR");
}
function countryFlag(code?: string) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}
const REGION = new Intl.DisplayNames(["pt-BR"], { type: "region" });

export function PerformanceView({ data }: { data: PerfData }) {
  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 };
    for (const r of data.insights) {
      t.spend += Number(r.spend); t.impressions += Number(r.impressions);
      t.clicks += Number(r.clicks); t.reach += Number(r.reach); t.results += Number(r.results);
    }
    return t;
  }, [data.insights]);

  const chartData = useMemo(() => {
    const byDate: Record<string, any> = {};
    for (const r of data.insights) {
      const d = r.date;
      if (!byDate[d]) byDate[d] = { date: d, spend: 0, results: 0, clicks: 0, impressions: 0 };
      byDate[d].spend += Number(r.spend);
      byDate[d].results += Number(r.results);
      byDate[d].clicks += Number(r.clicks);
      byDate[d].impressions += Number(r.impressions);
    }
    return Object.values(byDate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((r: any) => ({ ...r, label: new Date(r.date + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) }));
  }, [data.insights]);

  const waTotals = useMemo(() => {
    const t = { impressions: 0, link_clicks: 0, conversations_started: 0, first_replies: 0 };
    for (const r of data.whatsapp) {
      t.impressions += Number(r.impressions);
      t.link_clicks += Number(r.link_clicks);
      t.conversations_started += Number(r.conversations_started);
      t.first_replies += Number(r.first_replies);
    }
    return t;
  }, [data.whatsapp]);

  const waSeries = useMemo(() => {
    return data.whatsapp.map((r) => ({
      label: new Date(r.date + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      conversas: Number(r.conversations_started),
      cliques: Number(r.link_clicks),
    }));
  }, [data.whatsapp]);

  const geoTop = useMemo(() => {
    const total = data.geo.reduce((s, g) => s + Number(g.spend), 0) || 1;
    return [...data.geo]
      .sort((a, b) => Number(b.spend) - Number(a.spend))
      .slice(0, 10)
      .map((g) => ({
        code: g.country_code,
        name: (() => { try { return REGION.of(g.country_code) || g.country_code; } catch { return g.country_code; } })(),
        spend: Number(g.spend),
        results: Number(g.results),
        clicks: Number(g.clicks),
        pct: (Number(g.spend) / total) * 100,
      }));
  }, [data.geo]);

  const links = useMemo(() => {
    const map = new Map<string, { url: string; clicks: number; spend: number; results: number; count: number }>();
    for (const c of data.creatives) {
      if (!c.destination_url) continue;
      const cur = map.get(c.destination_url) ?? { url: c.destination_url, clicks: 0, spend: 0, results: 0, count: 0 };
      cur.clicks += Number(c.clicks);
      cur.spend += Number(c.spend);
      cur.results += Number(c.results);
      cur.count += 1;
      map.set(c.destination_url, cur);
    }
    return [...map.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  }, [data.creatives]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Investimento" value={fmtBRL(totals.spend)} />
        <Kpi label="Impressões" value={fmtInt(totals.impressions)} />
        <Kpi label="Cliques" value={fmtInt(totals.clicks)} />
        <Kpi label="Alcance" value={fmtInt(totals.reach)} />
        <Kpi label="Resultados" value={fmtInt(totals.results)} />
      </div>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao"><BarChart3 className="h-3.5 w-3.5" />Visão</TabsTrigger>
          <TabsTrigger value="criativos"><ImageIcon className="h-3.5 w-3.5" />Criativos</TabsTrigger>
          <TabsTrigger value="geo"><Globe2 className="h-3.5 w-3.5" />Geografia</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="h-3.5 w-3.5" />Funil WhatsApp</TabsTrigger>
          <TabsTrigger value="links"><MousePointerClick className="h-3.5 w-3.5" />Links</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <EmptyMsg />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis yAxisId="l" fontSize={11} />
                      <YAxis yAxisId="r" orientation="right" fontSize={11} />
                      <Tooltip formatter={(v: any, k: string) => (k === "spend" ? fmtBRL(Number(v)) : fmtInt(Number(v)))} />
                      <Legend />
                      <Area yAxisId="l" type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#gSpend)" name="Investimento" />
                      <Area yAxisId="r" type="monotone" dataKey="results" stroke="#10b981" fill="url(#gRes)" name="Resultados" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="criativos">
          <Card>
            <CardHeader><CardTitle className="text-base">Top criativos por investimento</CardTitle></CardHeader>
            <CardContent>
              {data.creatives.length === 0 ? <EmptyMsg /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.creatives.slice(0, 12).map((c) => (
                    <div key={c.id} className="rounded-md border overflow-hidden bg-card">
                      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt={c.name || ""} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="text-sm font-medium truncate" title={c.name || ""}>{c.name || "Sem nome"}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <MiniStat k="Gasto" v={fmtBRL(c.spend)} />
                          <MiniStat k="Cliques" v={fmtInt(c.clicks)} />
                          <MiniStat k="Result." v={fmtInt(c.results)} />
                        </div>
                        {c.destination_url && (
                          <a href={c.destination_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 truncate">
                            <ExternalLink className="h-3 w-3" /> {c.destination_url}
                          </a>
                        )}
                        {c.status && <Badge variant="outline" className="text-[10px]">{c.status}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geo">
          <Card>
            <CardHeader><CardTitle className="text-base">Distribuição geográfica</CardTitle></CardHeader>
            <CardContent>
              {geoTop.length === 0 ? <EmptyMsg /> : (
                <div className="space-y-2">
                  {geoTop.map((g) => (
                    <div key={g.code} className="flex items-center gap-3">
                      <div className="w-8 text-lg">{countryFlag(g.code)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{g.name}</span>
                          <span className="text-muted-foreground text-xs">{fmtBRL(g.spend)} · {fmtInt(g.results)} result.</span>
                        </div>
                        <div className="h-1.5 mt-1 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.max(4, g.pct)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader><CardTitle className="text-base">Funil WhatsApp</CardTitle></CardHeader>
            <CardContent>
              {waTotals.impressions === 0 && waTotals.conversations_started === 0 ? <EmptyMsg text="Nenhuma conversa de WhatsApp registrada. Se sua campanha é de mensagens, aguarde a próxima sincronização." /> : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <FunnelStep label="Impressões" value={waTotals.impressions} total={waTotals.impressions} />
                    <FunnelStep label="Cliques no anúncio" value={waTotals.link_clicks} total={waTotals.impressions} />
                    <FunnelStep label="Conversas iniciadas" value={waTotals.conversations_started} total={waTotals.impressions} highlight />
                    <FunnelStep label="Primeiras respostas" value={waTotals.first_replies} total={waTotals.impressions} />
                  </div>
                  {waSeries.length > 0 && (
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <BarChart data={waSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="cliques" fill="hsl(var(--primary))" name="Cliques" />
                          <Bar dataKey="conversas" fill="#25D366" name="Conversas WhatsApp" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardHeader><CardTitle className="text-base">Links de destino mais clicados</CardTitle></CardHeader>
            <CardContent>
              {links.length === 0 ? <EmptyMsg /> : (
                <div className="space-y-2">
                  {links.map((l) => (
                    <div key={l.url} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-primary truncate flex items-center gap-1">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{l.url}</span>
                        </a>
                        <div className="text-xs text-muted-foreground mt-0.5">{l.count} criativo(s)</div>
                      </div>
                      <div className="flex gap-4 text-xs shrink-0">
                        <div><div className="text-muted-foreground">Cliques</div><div className="font-medium text-right">{fmtInt(l.clicks)}</div></div>
                        <div><div className="text-muted-foreground">Gasto</div><div className="font-medium text-right">{fmtBRL(l.spend)}</div></div>
                        <div><div className="text-muted-foreground">Result.</div><div className="font-medium text-right">{fmtInt(l.results)}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded bg-muted/40 p-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
function FunnelStep({ label, value, total, highlight }: { label: string; value: number; total: number; highlight?: boolean }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className={`rounded-md border p-3 ${highlight ? "border-primary bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{fmtInt(value)}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{pct.toFixed(1)}% das impressões</div>
    </div>
  );
}
function EmptyMsg({ text = "Sem dados no período. Sincronize a conta para ver métricas." }: { text?: string }) {
  return <div className="text-sm text-muted-foreground text-center py-8">{text}</div>;
}

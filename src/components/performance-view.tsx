import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend, LineChart, Line,
} from "recharts";
import {
  BarChart3, Globe2, MessageCircle, Image as ImageIcon, ExternalLink, MousePointerClick,
  TrendingUp, TrendingDown, Eye, MousePointer, Users, Target, DollarSign, Zap, Filter, X,
} from "lucide-react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

export type PerfData = {
  insights: any[];
  creatives: any[];
  geo: any[];
  whatsapp: any[];
  accounts?: any[];
  campaignInsights?: any[];
};

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO numeric (as used in world-atlas) → ISO alpha-2 (as Meta returns)
const NUM_TO_ISO2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","020":"AD","024":"AO","032":"AR","036":"AU","040":"AT","044":"BS","048":"BH",
  "050":"BD","051":"AM","052":"BB","056":"BE","060":"BM","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR",
  "084":"BZ","090":"SB","096":"BN","100":"BG","104":"MM","108":"BI","112":"BY","116":"KH","120":"CM","124":"CA",
  "132":"CV","140":"CF","144":"LK","148":"TD","152":"CL","156":"CN","158":"TW","170":"CO","174":"KM","178":"CG",
  "180":"CD","188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ","204":"BJ","208":"DK","214":"DO","218":"EC",
  "222":"SV","226":"GQ","231":"ET","232":"ER","233":"EE","242":"FJ","246":"FI","250":"FR","262":"DJ","266":"GA",
  "268":"GE","270":"GM","275":"PS","276":"DE","288":"GH","300":"GR","320":"GT","324":"GN","328":"GY","332":"HT",
  "340":"HN","348":"HU","352":"IS","356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE","376":"IL","380":"IT",
  "384":"CI","388":"JM","392":"JP","398":"KZ","400":"JO","404":"KE","408":"KP","410":"KR","414":"KW","417":"KG",
  "418":"LA","422":"LB","426":"LS","428":"LV","430":"LR","434":"LY","440":"LT","442":"LU","450":"MG","454":"MW",
  "458":"MY","466":"ML","478":"MR","480":"MU","484":"MX","496":"MN","498":"MD","499":"ME","504":"MA","508":"MZ",
  "512":"OM","516":"NA","524":"NP","528":"NL","540":"NC","548":"VU","554":"NZ","558":"NI","562":"NE","566":"NG",
  "578":"NO","586":"PK","591":"PA","598":"PG","600":"PY","604":"PE","608":"PH","616":"PL","620":"PT","624":"GW",
  "626":"TL","630":"PR","634":"QA","642":"RO","643":"RU","646":"RW","682":"SA","686":"SN","688":"RS","694":"SL",
  "702":"SG","703":"SK","704":"VN","705":"SI","706":"SO","710":"ZA","716":"ZW","724":"ES","728":"SS","729":"SD",
  "740":"SR","748":"SZ","752":"SE","756":"CH","760":"SY","762":"TJ","764":"TH","768":"TG","780":"TT","784":"AE",
  "788":"TN","792":"TR","795":"TM","800":"UG","804":"UA","807":"MK","818":"EG","826":"GB","834":"TZ","840":"US",
  "854":"BF","858":"UY","860":"UZ","862":"VE","882":"WS","887":"YE","894":"ZM",
};

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function fmtInt(v: number | null | undefined) {
  return Number(v ?? 0).toLocaleString("pt-BR");
}
function fmtPct(v: number | null | undefined) {
  return `${Number(v ?? 0).toFixed(2)}%`;
}
function countryFlag(code?: string) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}
const REGION = new Intl.DisplayNames(["pt-BR"], { type: "region" });
function regionName(code: string) {
  try { return REGION.of(code) || code; } catch { return code; }
}

export function PerformanceView({ data }: { data: PerfData }) {
  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 };
    for (const r of data.insights) {
      t.spend += Number(r.spend); t.impressions += Number(r.impressions);
      t.clicks += Number(r.clicks); t.reach += Number(r.reach); t.results += Number(r.results);
    }
    return t;
  }, [data.insights]);

  const derived = useMemo(() => {
    const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks ? totals.spend / totals.clicks : 0;
    const cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0;
    const cpa = totals.results ? totals.spend / totals.results : 0;
    const freq = totals.reach ? totals.impressions / totals.reach : 0;
    return { ctr, cpc, cpm, cpa, freq };
  }, [totals]);

  // Compare last 15 days vs previous 15 days
  const trend = useMemo(() => {
    const sorted = [...data.insights].sort((a, b) => a.date.localeCompare(b.date));
    const half = Math.floor(sorted.length / 2);
    const prev = sorted.slice(0, half);
    const curr = sorted.slice(half);
    const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + Number(r[k] || 0), 0);
    const calc = (k: string) => {
      const p = sum(prev, k), c = sum(curr, k);
      if (!p) return 0;
      return ((c - p) / p) * 100;
    };
    return { spend: calc("spend"), results: calc("results"), clicks: calc("clicks"), impressions: calc("impressions") };
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
      .map((r: any) => ({
        ...r,
        label: new Date(r.date + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        cpa: r.results ? r.spend / r.results : 0,
        ctr: r.impressions ? (r.clicks / r.impressions) * 100 : 0,
      }));
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

  const geoData = useMemo(() => {
    const total = data.geo.reduce((s, g) => s + Number(g.spend), 0) || 1;
    return [...data.geo]
      .sort((a, b) => Number(b.spend) - Number(a.spend))
      .map((g) => ({
        code: g.country_code,
        name: regionName(g.country_code),
        spend: Number(g.spend),
        results: Number(g.results),
        clicks: Number(g.clicks),
        impressions: Number(g.impressions),
        reach: Number(g.reach),
        pct: (Number(g.spend) / total) * 100,
      }));
  }, [data.geo]);

  const geoByCode = useMemo(() => {
    const m: Record<string, typeof geoData[number]> = {};
    for (const g of geoData) m[g.code] = g;
    return m;
  }, [geoData]);

  const maxSpend = useMemo(() => geoData.reduce((m, g) => Math.max(m, g.spend), 0) || 1, [geoData]);

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
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Investimento" value={fmtBRL(totals.spend)} trend={trend.spend} accent="primary" />
        <Kpi icon={<Target className="h-4 w-4" />} label="Resultados" value={fmtInt(totals.results)} trend={trend.results} accent="emerald" />
        <Kpi icon={<Zap className="h-4 w-4" />} label="CPA" value={fmtBRL(derived.cpa)} accent="violet" />
        <Kpi icon={<MousePointer className="h-4 w-4" />} label="Cliques" value={fmtInt(totals.clicks)} trend={trend.clicks} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="CTR" value={fmtPct(derived.ctr)} />
        <Kpi icon={<Eye className="h-4 w-4" />} label="Impressões" value={fmtInt(totals.impressions)} trend={trend.impressions} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Alcance" value={fmtInt(totals.reach)} />
        <Kpi icon={<BarChart3 className="h-4 w-4" />} label="CPM" value={fmtBRL(derived.cpm)} />
        <Kpi icon={<MousePointerClick className="h-4 w-4" />} label="CPC" value={fmtBRL(derived.cpc)} />
        <Kpi icon={<Users className="h-4 w-4" />} label="Frequência" value={derived.freq.toFixed(2)} />
      </div>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao"><BarChart3 className="h-3.5 w-3.5" />Visão</TabsTrigger>
          <TabsTrigger value="criativos"><ImageIcon className="h-3.5 w-3.5" />Criativos</TabsTrigger>
          <TabsTrigger value="geo"><Globe2 className="h-3.5 w-3.5" />Geografia</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="h-3.5 w-3.5" />Funil WhatsApp</TabsTrigger>
          <TabsTrigger value="links"><MousePointerClick className="h-3.5 w-3.5" />Links</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Investimento × Resultados</CardTitle></CardHeader>
              <CardContent>
                {chartData.length === 0 ? <EmptyMsg /> : (
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
                        <Tooltip formatter={(v: any, k: string) => (k === "Investimento" ? fmtBRL(Number(v)) : fmtInt(Number(v)))} />
                        <Legend />
                        <Area yAxisId="l" type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#gSpend)" name="Investimento" />
                        <Area yAxisId="r" type="monotone" dataKey="results" stroke="#10b981" fill="url(#gRes)" name="Resultados" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">CPA × CTR</CardTitle></CardHeader>
              <CardContent>
                {chartData.length === 0 ? <EmptyMsg /> : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis yAxisId="l" fontSize={11} />
                        <YAxis yAxisId="r" orientation="right" fontSize={11} />
                        <Tooltip formatter={(v: any, k: string) => (k === "CPA" ? fmtBRL(Number(v)) : fmtPct(Number(v)))} />
                        <Legend />
                        <Line yAxisId="l" type="monotone" dataKey="cpa" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CPA" />
                        <Line yAxisId="r" type="monotone" dataKey="ctr" stroke="#f59e0b" strokeWidth={2} dot={false} name="CTR" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Impressões × Cliques (diário)</CardTitle></CardHeader>
            <CardContent>
              {chartData.length === 0 ? <EmptyMsg /> : (
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis yAxisId="l" fontSize={11} />
                      <YAxis yAxisId="r" orientation="right" fontSize={11} />
                      <Tooltip formatter={(v: any) => fmtInt(Number(v))} />
                      <Legend />
                      <Bar yAxisId="l" dataKey="impressions" fill="hsl(var(--primary))" name="Impressões" opacity={0.85} />
                      <Bar yAxisId="r" dataKey="clicks" fill="#f59e0b" name="Cliques" />
                    </BarChart>
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
          <WorldMapPanel geoData={geoData} geoByCode={geoByCode} maxSpend={maxSpend} />
        </TabsContent>

        <TabsContent value="whatsapp">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Funil de conversas</CardTitle></CardHeader>
              <CardContent>
                {waTotals.impressions === 0 && waTotals.conversations_started === 0 ? (
                  <EmptyMsg text="Nenhuma conversa de WhatsApp registrada. Se sua campanha é de mensagens, aguarde a próxima sincronização." />
                ) : (
                  <VerticalFunnel
                    steps={[
                      { label: "Impressões", value: waTotals.impressions, color: "#3b82f6" },
                      { label: "Cliques no anúncio", value: waTotals.link_clicks, color: "#6366f1" },
                      { label: "Conversas iniciadas", value: waTotals.conversations_started, color: "#25D366" },
                      { label: "Primeiras respostas", value: waTotals.first_replies, color: "#059669" },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
              <CardContent>
                {waSeries.length === 0 ? <EmptyMsg /> : (
                  <div className="h-72 w-full">
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
              </CardContent>
            </Card>
          </div>
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

/* ---------- Sub components ---------- */

function Kpi({
  icon, label, value, trend, accent,
}: { icon?: React.ReactNode; label: string; value: string; trend?: number; accent?: "primary" | "emerald" | "violet" }) {
  const accentBg =
    accent === "primary" ? "bg-primary/10 text-primary"
    : accent === "emerald" ? "bg-emerald-500/10 text-emerald-600"
    : accent === "violet" ? "bg-violet-500/10 text-violet-600"
    : "bg-muted text-muted-foreground";
  const showTrend = typeof trend === "number" && Number.isFinite(trend) && trend !== 0;
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="rounded-lg border p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        {icon && <div className={`h-6 w-6 rounded flex items-center justify-center ${accentBg}`}>{icon}</div>}
      </div>
      <div className="text-lg font-semibold mt-1 tabular-nums">{value}</div>
      {showTrend && (
        <div className={`text-[11px] mt-0.5 flex items-center gap-0.5 ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend!).toFixed(1)}% vs. período anterior
        </div>
      )}
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

function EmptyMsg({ text = "Sem dados no período. Sincronize a conta para ver métricas." }: { text?: string }) {
  return <div className="text-sm text-muted-foreground text-center py-8">{text}</div>;
}

/* Vertical funnel */
function VerticalFunnel({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="space-y-2 py-2">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const conv = i === 0 ? 100 : steps[0].value ? (s.value / steps[0].value) * 100 : 0;
        const stepConv = i === 0 ? null : steps[i - 1].value ? (s.value / steps[i - 1].value) * 100 : 0;
        return (
          <div key={s.label} className="flex flex-col items-center">
            <div
              className="relative flex items-center justify-center text-white font-semibold text-sm shadow-sm transition-all"
              style={{
                width: `${Math.max(30, pct)}%`,
                minWidth: 160,
                background: s.color,
                clipPath: "polygon(6% 0, 94% 0, 88% 100%, 12% 100%)",
                padding: "18px 24px",
              }}
            >
              <div className="text-center leading-tight">
                <div className="text-[11px] opacity-90 font-normal">{s.label}</div>
                <div className="text-xl tabular-nums">{fmtInt(s.value)}</div>
                <div className="text-[10px] opacity-90 font-normal">{conv.toFixed(1)}% do topo</div>
              </div>
            </div>
            {stepConv !== null && (
              <div className="text-[10px] text-muted-foreground py-1">↓ {stepConv.toFixed(1)}% de conversão</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* World map panel */
function WorldMapPanel({
  geoData, geoByCode, maxSpend,
}: {
  geoData: { code: string; name: string; spend: number; results: number; clicks: number; impressions: number; reach: number; pct: number }[];
  geoByCode: Record<string, any>;
  maxSpend: number;
}) {
  const [selected, setSelected] = useState<string | null>(geoData[0]?.code ?? null);
  const sel = selected ? geoByCode[selected] : null;

  function fillFor(code?: string) {
    if (!code) return "hsl(var(--muted))";
    const g = geoByCode[code];
    if (!g) return "hsl(var(--muted))";
    const intensity = Math.min(1, Math.sqrt(g.spend / maxSpend));
    // primary at variable opacity
    return `color-mix(in oklch, hsl(var(--primary)) ${20 + intensity * 80}%, transparent)`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Mapa-múndi de investimento</CardTitle>
          <div className="text-xs text-muted-foreground">Clique num país para detalhar</div>
        </CardHeader>
        <CardContent>
          {geoData.length === 0 ? (
            <EmptyMsg />
          ) : (
            <div className="w-full aspect-[2/1] bg-muted/30 rounded-md overflow-hidden border">
              <ComposableMap projectionConfig={{ scale: 140 }} style={{ width: "100%", height: "100%" }}>
                <ZoomableGroup>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }: any) =>
                      geographies.map((geo: any) => {
                        const iso2 = NUM_TO_ISO2[geo.id];
                        const isSel = iso2 && iso2 === selected;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => iso2 && setSelected(iso2)}
                            style={{
                              default: {
                                fill: fillFor(iso2),
                                stroke: "hsl(var(--border))",
                                strokeWidth: 0.4,
                                outline: "none",
                              },
                              hover: {
                                fill: iso2 && geoByCode[iso2] ? "hsl(var(--primary))" : "hsl(var(--muted))",
                                cursor: iso2 && geoByCode[iso2] ? "pointer" : "default",
                                outline: "none",
                              },
                              pressed: { fill: "hsl(var(--primary))", outline: "none" },
                            }}
                            stroke={isSel ? "hsl(var(--primary))" : undefined}
                            strokeWidth={isSel ? 1.2 : undefined}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            </div>
          )}
          <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
            <span>Menor gasto</span>
            <div className="flex-1 h-2 rounded" style={{ background: "linear-gradient(90deg, color-mix(in oklch, hsl(var(--primary)) 20%, transparent), hsl(var(--primary)))" }} />
            <span>Maior gasto</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
        <CardContent>
          {sel ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl">{countryFlag(sel.code)}</div>
                <div>
                  <div className="font-semibold">{sel.name}</div>
                  <div className="text-xs text-muted-foreground">{sel.pct.toFixed(1)}% do investimento total</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <MiniStat k="Investimento" v={fmtBRL(sel.spend)} />
                <MiniStat k="Resultados" v={fmtInt(sel.results)} />
                <MiniStat k="Cliques" v={fmtInt(sel.clicks)} />
                <MiniStat k="Impressões" v={fmtInt(sel.impressions)} />
                <MiniStat k="Alcance" v={fmtInt(sel.reach)} />
                <MiniStat k="CPA" v={sel.results ? fmtBRL(sel.spend / sel.results) : "—"} />
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Selecione um país no mapa.</div>
          )}

          <div className="mt-5">
            <div className="text-xs font-medium text-muted-foreground mb-2">Ranking</div>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {geoData.slice(0, 20).map((g) => (
                <button
                  key={g.code}
                  onClick={() => setSelected(g.code)}
                  className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors ${selected === g.code ? "bg-muted" : ""}`}
                >
                  <span className="text-base">{countryFlag(g.code)}</span>
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-muted-foreground tabular-nums">{fmtBRL(g.spend)}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend, ComposedChart, Line,
} from "recharts";
import {
  BarChart3, Globe2, MessageCircle, Image as ImageIcon, ExternalLink, MousePointerClick,
  TrendingUp, TrendingDown, Eye, MousePointer, Users, Target, DollarSign, Zap, Filter, X,
  Calendar as CalendarIcon, ArrowUpDown,
} from "lucide-react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";

export type PerfData = {
  insights: any[];
  creatives: any[];
  geo: any[];
  whatsapp: any[];
  accounts?: any[];
  campaignInsights?: any[];
  hourly?: any[];
  sales?: { vendas: number; faturamento: number; custo_produto?: number };
  clientType?: string | null;
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
  // ---------- Filters ----------
  const accountsList = data.accounts ?? [];
  const [accountId, setAccountId] = useState<string>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [creativeId, setCreativeId] = useState<string>("all");
  const [period, setPeriod] = useState<string>("current_month"); // presets: current_month|7|15|30|90|365|current_week|all|custom
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [campaignSort, setCampaignSort] = useState<"spend" | "cpl" | "results" | "ctr">("cpl");

  // Options for campaigns come from campaignInsights + creatives (union)
  const campaignOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data.campaignInsights ?? []) {
      if (c.campaign_id) m.set(String(c.campaign_id), c.campaign_name || String(c.campaign_id));
    }
    for (const c of data.creatives ?? []) {
      if (c.campaign_id && !m.has(String(c.campaign_id))) m.set(String(c.campaign_id), c.campaign_name || String(c.campaign_id));
    }
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.campaignInsights, data.creatives]);

  // Filter helpers
  const inPeriod = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00");
    if (period === "all") return true;
    if (period === "custom") {
      if (customRange.from && d < customRange.from) return false;
      if (customRange.to && d > customRange.to) return false;
      return true;
    }
    if (period === "current_week") {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const start = new Date(now); start.setDate(now.getDate() - now.getDay()); // sunday
      return d >= start && d <= now;
    }
    if (period === "current_month") {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= start && d <= now;
    }
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = (now.getTime() - d.getTime()) / 86400000;
    return diff <= Number(period);
  };
  const inAccount = (row: any) => accountId === "all" || row.ad_account_id === accountId;

  // ---------- Filtered creatives ----------
  const filteredCreatives = useMemo(() => {
    return (data.creatives ?? []).filter((c) => {
      if (!inAccount(c)) return false;
      if (campaignId !== "all" && String(c.campaign_id ?? "") !== campaignId) return false;
      if (creativeId !== "all" && String(c.id) !== creativeId) return false;
      return true;
    });
  }, [data.creatives, accountId, campaignId, creativeId]);

  // Creative options depend on account/campaign selection
  const creativeOptions = useMemo(() => {
    return (data.creatives ?? [])
      .filter((c) => inAccount(c) && (campaignId === "all" || String(c.campaign_id ?? "") === campaignId))
      .map((c) => ({ id: String(c.id), name: c.name || "(sem nome)" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.creatives, accountId, campaignId]);

  // ---------- Daily series (source depends on filters) ----------
  // Use campaign-level daily insights when campaignId filter is active;
  // when a specific creative is selected, we can't get daily (creatives are aggregated),
  // so we synthesize a single-bucket series with the creative's totals.
  const dailyRows = useMemo(() => {
    if (creativeId !== "all") {
      // Single aggregated row → fake into a series showing totals as a single point
      const c = filteredCreatives[0];
      if (!c) return [] as any[];
      const today = new Date().toISOString().slice(0, 10);
      return [{
        date: today,
        spend: Number(c.spend ?? 0),
        impressions: Number(c.impressions ?? 0),
        clicks: Number(c.clicks ?? 0),
        reach: Number(c.reach ?? 0),
        results: Number(c.results ?? 0),
      }];
    }
    if (campaignId !== "all") {
      return (data.campaignInsights ?? []).filter((r) => inAccount(r) && String(r.campaign_id) === campaignId && inPeriod(r.date));
    }
    // No campaign/creative filter → account-level daily insights (aggregate all campaigns for the account)
    return (data.insights ?? []).filter((r) => inAccount(r) && inPeriod(r.date));
  }, [data.insights, data.campaignInsights, accountId, campaignId, creativeId, period, filteredCreatives]);

  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, reach: 0, results: 0 };
    for (const r of dailyRows) {
      t.spend += Number(r.spend); t.impressions += Number(r.impressions);
      t.clicks += Number(r.clicks); t.reach += Number(r.reach); t.results += Number(r.results);
    }
    return t;
  }, [dailyRows]);

  const derived = useMemo(() => {
    const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks ? totals.spend / totals.clicks : 0;
    const cpm = totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0;
    const cpa = totals.results ? totals.spend / totals.results : 0;
    const freq = totals.reach ? totals.impressions / totals.reach : 0;
    const salesTot = data.sales?.vendas ?? 0;
    const revenue = data.sales?.faturamento ?? 0;
    const cost = data.sales?.custo_produto ?? 0;
    const cpv = salesTot ? totals.spend / salesTot : 0;
    const roas = totals.spend ? revenue / totals.spend : 0;
    const lucro = revenue - totals.spend - cost;
    return { ctr, cpc, cpm, cpa, freq, cpv, roas, lucro, hasSales: salesTot > 0 };
  }, [totals, data.sales]);


  const trend = useMemo(() => {
    const sorted = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date));
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
  }, [dailyRows]);

  // Viewport width to decide chart bucket size (daily/weekly/monthly)
  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const chartData = useMemo(() => {
    // First aggregate daily
    const byDate: Record<string, any> = {};
    for (const r of dailyRows) {
      const d = r.date;
      if (!byDate[d]) byDate[d] = { date: d, spend: 0, results: 0, clicks: 0, impressions: 0 };
      byDate[d].spend += Number(r.spend);
      byDate[d].results += Number(r.results);
      byDate[d].clicks += Number(r.clicks);
      byDate[d].impressions += Number(r.impressions);
    }
    const daily = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date)) as any[];
    const n = daily.length;

    // Choose bucket by (viewport, number of points)
    const isMobile = vw < 640;
    const isTablet = vw >= 640 && vw < 1024;
    const maxPoints = isMobile ? 14 : isTablet ? 30 : 45;
    const monthlyThreshold = isMobile ? 90 : 180;
    let bucket: "day" | "week" | "month" = "day";
    if (n > monthlyThreshold) bucket = "month";
    else if (n > maxPoints) bucket = "week";

    const bucketKey = (dStr: string) => {
      const d = new Date(dStr + "T00:00");
      if (bucket === "month") {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      if (bucket === "week") {
        // ISO week start (monday)
        const day = d.getDay(); // 0=sun
        const diff = day === 0 ? -6 : 1 - day;
        const start = new Date(d); start.setDate(d.getDate() + diff);
        return start.toISOString().slice(0, 10);
      }
      return dStr;
    };
    const bucketLabel = (key: string) => {
      if (bucket === "month") {
        const [y, m] = key.split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      }
      if (bucket === "week") {
        const start = new Date(key + "T00:00");
        return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
      }
      return new Date(key + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    };

    const buckets: Record<string, any> = {};
    for (const r of daily) {
      const k = bucketKey(r.date);
      if (!buckets[k]) buckets[k] = { key: k, spend: 0, results: 0, clicks: 0, impressions: 0 };
      buckets[k].spend += r.spend;
      buckets[k].results += r.results;
      buckets[k].clicks += r.clicks;
      buckets[k].impressions += r.impressions;
    }
    return Object.values(buckets)
      .sort((a: any, b: any) => a.key.localeCompare(b.key))
      .map((r: any) => ({
        ...r,
        label: bucketLabel(r.key),
        cpa: r.results ? r.spend / r.results : 0,
        ctr: r.impressions ? (r.clicks / r.impressions) * 100 : 0,
      }));
  }, [dailyRows, vw]);


  // Top-campaign breakdown (aggregated for current filters, ignoring campaign filter itself so user can compare)
  const campaignBreakdown = useMemo(() => {
    const src = (data.campaignInsights ?? []).filter((r) => inAccount(r) && inPeriod(r.date));
    const m = new Map<string, { id: string; name: string; spend: number; results: number; clicks: number; impressions: number }>();
    for (const r of src) {
      const id = String(r.campaign_id);
      const cur = m.get(id) ?? { id, name: r.campaign_name || id, spend: 0, results: 0, clicks: 0, impressions: 0 };
      cur.spend += Number(r.spend); cur.results += Number(r.results); cur.clicks += Number(r.clicks); cur.impressions += Number(r.impressions);
      m.set(id, cur);
    }
    return [...m.values()].sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [data.campaignInsights, accountId, period]);

  const waTotals = useMemo(() => {
    const t = { impressions: 0, link_clicks: 0, conversations_started: 0, first_replies: 0 };
    for (const r of (data.whatsapp ?? []).filter((r) => inAccount(r) && inPeriod(r.date))) {
      t.impressions += Number(r.impressions);
      t.link_clicks += Number(r.link_clicks);
      t.conversations_started += Number(r.conversations_started);
      t.first_replies += Number(r.first_replies);
    }
    return t;
  }, [data.whatsapp, accountId, period]);

  // Extra WhatsApp/IG metrics extracted from insights raw actions
  const waExtras = useMemo(() => {
    const pick = (actions: any[], keys: string[]) => {
      let sum = 0;
      for (const a of actions ?? []) {
        if (keys.includes(a.action_type)) sum += Number(a.value ?? 0);
      }
      return sum;
    };
    const NEW_KEYS = [
      "onsite_conversion.new_messaging_conversation",
      "onsite_conversion.messaging_user_depth_2_message_send",
      "new_messaging_conversation",
    ];
    const RET_KEYS = [
      "onsite_conversion.returning_messaging_conversation",
      "returning_messaging_conversation",
      "onsite_conversion.messaging_user_depth_5_message_send",
    ];
    const IG_KEYS = [
      "onsite_conversion.profile_visit",
      "ig_profile_visit",
      "profile_visit",
      "onsite_conversion.view_content",
    ];
    let newContacts = 0, retContacts = 0, igVisits = 0;
    for (const r of (data.insights ?? []).filter((r: any) => inAccount(r) && inPeriod(r.date))) {
      const actions = r?.raw?.actions ?? [];
      newContacts += pick(actions, NEW_KEYS);
      retContacts += pick(actions, RET_KEYS);
      igVisits += pick(actions, IG_KEYS);
    }
    return { newContacts, retContacts, igVisits };
  }, [data.insights, accountId, period]);

  const waSeries = useMemo(() => {
    return (data.whatsapp ?? [])
      .filter((r) => inAccount(r) && inPeriod(r.date))
      .map((r) => ({
        label: new Date(r.date + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        conversas: Number(r.conversations_started),
        cliques: Number(r.link_clicks),
      }));
  }, [data.whatsapp, accountId, period]);

  // Previous period delta for WhatsApp (same length as current period)
  const waPrevTotals = useMemo(() => {
    const t = { impressions: 0, link_clicks: 0, conversations_started: 0, first_replies: 0 };
    if (period === "all" || period === "custom" || period === "current_week" || period === "current_month") return t;
    const days = Number(period);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const prevStart = new Date(now); prevStart.setDate(now.getDate() - days * 2);
    const prevEnd = new Date(now); prevEnd.setDate(now.getDate() - days);
    for (const r of (data.whatsapp ?? []).filter((r) => inAccount(r))) {
      const d = new Date(r.date + "T00:00");
      if (d >= prevStart && d < prevEnd) {
        t.impressions += Number(r.impressions);
        t.link_clicks += Number(r.link_clicks);
        t.conversations_started += Number(r.conversations_started);
        t.first_replies += Number(r.first_replies);
      }
    }
    return t;
  }, [data.whatsapp, accountId, period]);

  const resultsLabel = data.clientType === "local"
    ? "Conversas iniciadas"
    : (data.clientType === "perpetuo" || data.clientType === "lancamento" || data.clientType === "autoria")
    ? "Compras / leads"
    : "Resultados";

  const geoData = useMemo(() => {
    // Country-level only (no region) — deduplica agregando por country_code
    const src = (data.geo ?? []).filter((r) => inAccount(r) && !r.region);
    const map = new Map<string, { spend: number; results: number; clicks: number; impressions: number; reach: number }>();
    for (const g of src) {
      const code = String(g.country_code || "").toUpperCase();
      if (!code) continue;
      const cur = map.get(code) ?? { spend: 0, results: 0, clicks: 0, impressions: 0, reach: 0 };
      cur.spend += Number(g.spend); cur.results += Number(g.results);
      cur.clicks += Number(g.clicks); cur.impressions += Number(g.impressions);
      cur.reach += Number(g.reach);
      map.set(code, cur);
    }
    const total = [...map.values()].reduce((s, g) => s + g.spend, 0) || 1;
    return [...map.entries()]
      .map(([code, g]) => ({ code, name: regionName(code), ...g, pct: (g.spend / total) * 100 }))
      .sort((a, b) => b.spend - a.spend);
  }, [data.geo, accountId]);

  const regionData = useMemo(() => {
    const src = (data.geo ?? []).filter((r) => inAccount(r) && r.region);
    const total = src.reduce((s, g) => s + Number(g.spend), 0) || 1;
    return [...src]
      .sort((a, b) => Number(b.spend) - Number(a.spend))
      .map((g) => ({
        region: g.region_name || g.region,
        country: g.country_code,
        spend: Number(g.spend),
        results: Number(g.results),
        clicks: Number(g.clicks),
        impressions: Number(g.impressions),
        reach: Number(g.reach),
        pct: (Number(g.spend) / total) * 100,
      }));
  }, [data.geo, accountId]);

  const geoByCode = useMemo(() => {
    const m: Record<string, typeof geoData[number]> = {};
    for (const g of geoData) m[g.code] = g;
    return m;
  }, [geoData]);

  const maxSpend = useMemo(() => geoData.reduce((m, g) => Math.max(m, g.spend), 0) || 1, [geoData]);

  const links = useMemo(() => {
    const map = new Map<string, { url: string; clicks: number; spend: number; results: number; count: number }>();
    for (const c of filteredCreatives) {
      if (!c.destination_url) continue;
      const cur = map.get(c.destination_url) ?? { url: c.destination_url, clicks: 0, spend: 0, results: 0, count: 0 };
      cur.clicks += Number(c.clicks);
      cur.spend += Number(c.spend);
      cur.results += Number(c.results);
      cur.count += 1;
      map.set(c.destination_url, cur);
    }
    return [...map.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  }, [filteredCreatives]);

  const hasFilters = accountId !== "all" || campaignId !== "all" || creativeId !== "all" || period !== "30";
  function clearFilters() {
    setAccountId("all"); setCampaignId("all"); setCreativeId("all"); setPeriod("30");
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 rounded-lg border bg-card p-2">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground pl-1 shrink-0">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <Filter className="h-4 w-4 text-muted-foreground sm:hidden shrink-0 ml-1" />
        {accountsList.length > 1 && (
          <Select value={accountId} onValueChange={(v) => { setAccountId(v); setCampaignId("all"); setCreativeId("all"); }}>
            <SelectTrigger className="h-8 flex-1 min-w-0 sm:flex-none sm:w-[180px]"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accountsList.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.account_name || a.account_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setCreativeId("all"); }}>
          <SelectTrigger className="h-8 flex-1 min-w-0 sm:flex-none sm:w-[220px]"><SelectValue placeholder="Campanha" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaignOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={creativeId} onValueChange={setCreativeId}>
          <SelectTrigger className="h-8 flex-1 min-w-0 sm:flex-none sm:w-[220px]"><SelectValue placeholder="Anúncio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anúncios</SelectItem>
            {creativeOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={clearFilters} title="Limpar filtros">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="ml-auto shrink-0">
          <PeriodPicker period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} />
        </div>
      </div>


      {/* KPI Grid — for local (WhatsApp) clients use conversations from waTotals to avoid mixing action types */}
      {(() => {
        const isLocal = data.clientType === "local";
        const resultsValue = isLocal ? waTotals.conversations_started : totals.results;
        const prevResults = isLocal ? waPrevTotals.conversations_started : 0;
        const trendResults = isLocal
          ? (prevResults ? ((resultsValue - prevResults) / prevResults) * 100 : 0)
          : trend.results;
        const costLabel = isLocal ? "Custo por mensagem" : "Custo por resultado";
        const costHint = isLocal ? "Investimento ÷ conversas iniciadas" : "Investimento ÷ resultados";
        const costValue = resultsValue ? totals.spend / resultsValue : 0;
        const cpNew = waExtras.newContacts ? totals.spend / waExtras.newContacts : 0;
        const cpRet = waExtras.retContacts ? totals.spend / waExtras.retContacts : 0;
        return (
          <div className="space-y-3">
            {/* Linha 1: Investimento, Conversas iniciadas, Custo por mensagem, Cliques, CTR */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
              <Kpi icon={<DollarSign className="h-4 w-4" />} label="Investimento" hint="Total gasto no período" value={fmtBRL(totals.spend)} trend={trend.spend} accent="primary" />
              {isLocal ? (
                <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Conversas iniciadas" hint="Conversas de WhatsApp iniciadas — resultado principal" value={fmtInt(resultsValue)} trend={trendResults} accent="emerald" />
              ) : (
                <Kpi icon={<Target className="h-4 w-4" />} label={resultsLabel} hint="Compras, leads ou conversões que a campanha otimiza" value={fmtInt(resultsValue)} trend={trendResults} accent="emerald" />
              )}
              <Kpi icon={<Zap className="h-4 w-4" />} label={costLabel} hint={costHint} value={fmtBRL(costValue)} accent="violet" />
              <Kpi icon={<MousePointer className="h-4 w-4" />} label="Cliques" hint="Cliques no anúncio" value={fmtInt(totals.clicks)} trend={trend.clicks} />
              <Kpi icon={<TrendingUp className="h-4 w-4" />} label="CTR" hint="Cliques ÷ impressões" value={fmtPct(derived.ctr)} />
            </div>

            {/* Linha 2: Impressões, Alcance, CPM, CPC, Frequência */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
              <Kpi icon={<Eye className="h-4 w-4" />} label="Impressões" hint="Vezes que o anúncio foi exibido" value={fmtInt(totals.impressions)} trend={trend.impressions} />
              <Kpi icon={<Users className="h-4 w-4" />} label="Alcance" hint="Pessoas únicas alcançadas" value={fmtInt(totals.reach)} />
              <Kpi icon={<BarChart3 className="h-4 w-4" />} label="CPM" hint="Custo por mil impressões" value={fmtBRL(derived.cpm)} />
              <Kpi icon={<MousePointerClick className="h-4 w-4" />} label="CPC" hint="Custo por clique" value={fmtBRL(derived.cpc)} />
              <Kpi icon={<Users className="h-4 w-4" />} label="Frequência" hint="Média de vezes por pessoa" value={derived.freq.toFixed(2)} />
            </div>

            {/* Linha 3 (local/WhatsApp): Novos contatos, custo, retornam, custo, IG */}
            {isLocal && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
                <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Novos contatos" hint="Novos contatos por mensagem" value={fmtInt(waExtras.newContacts)} accent="emerald" />
                <Kpi icon={<Zap className="h-4 w-4" />} label="Custo por novo contato" hint="Investimento ÷ novos contatos" value={fmtBRL(cpNew)} accent="violet" />
                <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Contatos que retornam" hint="Contatos por mensagem recorrentes" value={fmtInt(waExtras.retContacts)} />
                <Kpi icon={<Zap className="h-4 w-4" />} label="Custo por contato que retorna" hint="Investimento ÷ contatos que retornam" value={fmtBRL(cpRet)} accent="violet" />
                <Kpi icon={<Eye className="h-4 w-4" />} label="Visitas ao perfil Instagram" hint="Visitas ao perfil do Instagram vindas do anúncio" value={fmtInt(waExtras.igVisits)} />
              </div>
            )}
          </div>
        );
      })()}

      {derived.hasSales && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Target className="h-4 w-4" />} label="Vendas" value={fmtInt(data.sales?.vendas ?? 0)} accent="emerald" />
          <Kpi icon={<Zap className="h-4 w-4" />} label="CPV (custo por venda)" value={fmtBRL(derived.cpv)} accent="violet" />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="ROAS" value={`${derived.roas.toFixed(2)}x`} accent="primary" />
          <Kpi icon={<DollarSign className="h-4 w-4" />} label="Lucro estimado" value={fmtBRL(derived.lucro)} accent={derived.lucro >= 0 ? "emerald" : undefined} />
        </div>
      )}



      <Tabs defaultValue="visao">
        <TabsList className="mx-auto flex w-fit">
          <TabsTrigger value="visao"><BarChart3 className="h-3.5 w-3.5" />Visão</TabsTrigger>
          <TabsTrigger value="criativos"><ImageIcon className="h-3.5 w-3.5" />Criativos</TabsTrigger>
          <TabsTrigger value="geo"><Globe2 className="h-3.5 w-3.5" />Geografia</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="h-3.5 w-3.5" />Funil</TabsTrigger>
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
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis yAxisId="l" fontSize={11} />
                        <YAxis yAxisId="r" orientation="right" fontSize={11} />
                        <Tooltip formatter={(v: any, k: string) => (k === "Investimento" ? fmtBRL(Number(v)) : fmtInt(Number(v)))} />
                        <Legend />
                        <Area yAxisId="l" type="monotone" dataKey="spend" stroke="var(--primary)" fill="url(#gSpend)" name="Investimento" />
                        <Area yAxisId="r" type="monotone" dataKey="results" stroke="#10b981" fill="url(#gRes)" name="Resultados" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Melhores campanhas</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Ordenadas por {campaignSort === "cpl" ? "menor CPL" : campaignSort === "spend" ? "maior gasto" : campaignSort === "results" ? "mais resultados" : "maior CTR"}</p>
                </div>
                <Select value={campaignSort} onValueChange={(v: any) => setCampaignSort(v)}>
                  <SelectTrigger className="h-8 w-[160px]"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpl">Menor CPL</SelectItem>
                    <SelectItem value="results">Mais resultados</SelectItem>
                    <SelectItem value="spend">Maior gasto</SelectItem>
                    <SelectItem value="ctr">Maior CTR</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {campaignBreakdown.length === 0 ? <EmptyMsg /> : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {[...campaignBreakdown].sort((a, b) => {
                      if (campaignSort === "spend") return b.spend - a.spend;
                      if (campaignSort === "results") return b.results - a.results;
                      if (campaignSort === "ctr") {
                        const ca = a.impressions ? a.clicks / a.impressions : 0;
                        const cb = b.impressions ? b.clicks / b.impressions : 0;
                        return cb - ca;
                      }
                      // CPL asc, mas coloca campanhas sem resultado no fim
                      const ca = a.results ? a.spend / a.results : Infinity;
                      const cb = b.results ? b.spend / b.results : Infinity;
                      return ca - cb;
                    }).slice(0, 8).map((c, i) => {
                      const cpl = c.results ? c.spend / c.results : 0;
                      const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
                      return (
                        <button key={c.id} onClick={() => setCampaignId(campaignId === c.id ? "all" : c.id)}
                          className={cn("w-full text-left rounded-md border p-2.5 hover:bg-accent transition", campaignId === c.id && "border-primary bg-primary/5")}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</div>
                            <div className="text-sm font-medium truncate flex-1">{c.name}</div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-muted-foreground">CPL</div>
                              <div className="text-sm font-bold text-emerald-600 tabular-nums">{c.results ? fmtBRL(cpl) : "—"}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div><span className="text-muted-foreground">Gasto:</span> <b>{fmtBRL(c.spend)}</b></div>
                            <div><span className="text-muted-foreground">Result:</span> <b>{fmtInt(c.results)}</b></div>
                            <div><span className="text-muted-foreground">CTR:</span> <b>{fmtPct(ctr)}</b></div>
                          </div>
                        </button>
                      );
                    })}
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
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis yAxisId="l" fontSize={11} />
                      <YAxis yAxisId="r" orientation="right" fontSize={11} />
                      <Tooltip formatter={(v: any) => fmtInt(Number(v))} />
                      <Legend />
                      <Bar yAxisId="l" dataKey="impressions" fill="var(--primary)" name="Impressões" opacity={0.85} />
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
              {filteredCreatives.length === 0 ? <EmptyMsg /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCreatives.slice(0, 24).map((c) => (
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
                        {c.campaign_name && <div className="text-[10px] text-muted-foreground truncate" title={c.campaign_name}>📁 {c.campaign_name}</div>}
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
                        <div className="flex items-center gap-1 flex-wrap">
                          {c.status && <Badge variant="outline" className="text-[10px]">{c.status}</Badge>}
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 ml-auto" onClick={() => setCreativeId(String(c.id))}>
                            Filtrar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geo" className="space-y-4">
          <WorldMapPanel geoData={geoData} geoByCode={geoByCode} maxSpend={maxSpend} />
          <RegionRanking regions={regionData} />
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          {/* WhatsApp KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <WaKpi label="Conversas iniciadas" hint="Novas conversas de WhatsApp no período" value={waTotals.conversations_started} prev={waPrevTotals.conversations_started} accent="emerald" />
            <WaKpi label="Primeiras respostas" hint="Clientes que responderam à sua mensagem" value={waTotals.first_replies} prev={waPrevTotals.first_replies} accent="primary" />
            <WaKpi label="Cliques no anúncio" hint="Cliques que abriram o WhatsApp" value={waTotals.link_clicks} prev={waPrevTotals.link_clicks} />
            <WaKpi label="Impressões" hint="Vezes que o anúncio foi exibido" value={waTotals.impressions} prev={waPrevTotals.impressions} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil de conversas</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Percurso da pessoa até iniciar a conversa no WhatsApp.</p>
            </CardHeader>
            <CardContent>
              {waTotals.impressions === 0 && waTotals.conversations_started === 0 ? (
                <EmptyMsg text="Nenhuma conversa de WhatsApp registrada. Se sua campanha é de mensagens, aguarde a próxima sincronização." />
              ) : (
                <VerticalFunnel
                  steps={[
                    { label: "Impressões", value: waTotals.impressions, color: "#3b82f6" },
                    { label: "Cliques no anúncio", value: waTotals.link_clicks, color: "#6366f1" },
                    { label: "Conversas iniciadas", value: waTotals.conversations_started, color: "#25D366" },
                    { label: "Novos contatos", value: waExtras.newContacts, color: "#059669" },
                  ]}
                />
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

/* ---------- Sub components ---------- */

function Kpi({
  icon, label, value, trend, accent, hint,
}: { icon?: React.ReactNode; label: string; value: string; trend?: number; accent?: "primary" | "emerald" | "violet"; hint?: string }) {
  const accentBg =
    accent === "primary" ? "bg-primary/10 text-primary"
    : accent === "emerald" ? "bg-emerald-500/10 text-emerald-600"
    : accent === "violet" ? "bg-violet-500/10 text-violet-600"
    : "bg-muted text-muted-foreground";
  const showTrend = typeof trend === "number" && Number.isFinite(trend) && trend !== 0;
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="rounded-lg border p-3 bg-card hover:shadow-sm transition-shadow min-w-0" title={hint}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground truncate min-w-0 flex-1">{label}</div>
        {icon && <div className={`h-6 w-6 shrink-0 rounded flex items-center justify-center ${accentBg}`}>{icon}</div>}
      </div>
      <div className="text-base sm:text-lg font-semibold mt-1 tabular-nums truncate">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{hint}</div>}
      {showTrend && (
        <div className={`text-[11px] mt-0.5 flex items-center gap-0.5 truncate ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
          {trendUp ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
          <span className="truncate">{Math.abs(trend!).toFixed(1)}% vs. período anterior</span>
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

/* Vertical funnel — largura decresce gradualmente (100% → 50%) independente do valor */
function VerticalFunnel({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const n = steps.length;
  const startW = 100;
  const endW = 50;
  const widthAt = (i: number) => (n <= 1 ? startW : startW - ((startW - endW) * i) / (n - 1));
  return (
    <div className="flex gap-4 py-2">
      {/* Funil (trapézios) */}
      <div className="flex-1 flex flex-col items-center gap-0">
        {steps.map((s, i) => {
          const top = widthAt(i);
          const bottom = widthAt(i + 1 < n ? i + 1 : i);
          const isLast = i === n - 1;
          return (
            <div key={s.label} className="w-full flex flex-col items-center">
              <div
                className="relative w-full flex items-center justify-center text-white font-medium shadow-sm"
                style={{
                  height: 72,
                  clipPath: isLast
                    ? `polygon(${(100 - top) / 2}% 0%, ${100 - (100 - top) / 2}% 0%, ${100 - (100 - top) / 2}% 100%, ${(100 - top) / 2}% 100%)`
                    : `polygon(${(100 - top) / 2}% 0%, ${100 - (100 - top) / 2}% 0%, ${100 - (100 - bottom) / 2}% 100%, ${(100 - bottom) / 2}% 100%)`,
                  background: `linear-gradient(180deg, ${s.color}, ${s.color}cc)`,
                }}
              >
                <div className="text-center px-2">
                  <div className="text-xs opacity-90 leading-tight">{s.label}</div>
                  <div className="text-lg font-bold tabular-nums leading-tight">{fmtInt(s.value)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coluna de conversão etapa a etapa */}
      <div className="w-40 flex flex-col justify-around py-2">
        {steps.map((s, i) => {
          if (i === 0) {
            return (
              <div key={s.label} className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Topo</div>
                <div className="text-sm font-semibold text-muted-foreground">100%</div>
              </div>
            );
          }
          const prev = steps[i - 1].value;
          const conv = prev ? (s.value / prev) * 100 : 0;
          const dropoff = 100 - conv;
          return (
            <div key={s.label} className="text-right border-l-2 border-emerald-500/40 pl-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {steps[i - 1].label.split(" ")[0]} → {s.label.split(" ")[0]}
              </div>
              <div className="text-lg font-bold text-emerald-600 tabular-nums">{conv.toFixed(1)}%</div>
              <div className="text-[10px] text-rose-500">↓ {dropoff.toFixed(1)}% caiu</div>
            </div>
          );
        })}
      </div>
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
  const [center, setCenter] = useState<[number, number]>([0, 20]);
  const [zoom, setZoom] = useState<number>(1);
  const sel = selected ? geoByCode[selected] : null;

  function focusOn(iso2: string, feature?: any) {
    setSelected(iso2);
    if (feature) {
      try {
        const c = geoCentroid(feature) as [number, number];
        if (c && isFinite(c[0]) && isFinite(c[1])) {
          setCenter(c);
          setZoom(4);
        }
      } catch { /* ignore */ }
    }
  }
  function resetView() {
    setCenter([0, 20]); setZoom(1);
  }

  function fillFor(code?: string) {
    if (!code) return "var(--muted)";
    const g = geoByCode[code];
    if (!g) return "var(--muted)";
    const intensity = Math.min(1, Math.sqrt(g.spend / maxSpend));
    return `color-mix(in oklch, var(--primary) ${20 + intensity * 80}%, transparent)`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Mapa-múndi de investimento</CardTitle>
          <div className="flex items-center gap-2">
            {zoom > 1 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetView}>Ver mundo</Button>}
            <div className="text-xs text-muted-foreground">Clique num país para focar</div>
          </div>
        </CardHeader>
        <CardContent>
          {geoData.length === 0 ? (
            <EmptyMsg />
          ) : (
            <div className="w-full aspect-[2/1] bg-muted/30 rounded-md overflow-hidden border">
              <ComposableMap projectionConfig={{ scale: 140 }} style={{ width: "100%", height: "100%" }}>
                <ZoomableGroup center={center} zoom={zoom} onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates as any); setZoom(z); }}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }: any) =>
                      geographies.map((geo: any) => {
                        const iso2 = NUM_TO_ISO2[geo.id];
                        const isSel = iso2 && iso2 === selected;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => iso2 && focusOn(iso2, geo)}
                            style={{
                              default: {
                                fill: isSel ? "var(--primary)" : fillFor(iso2),
                                stroke: isSel ? "var(--primary)" : "var(--border)",
                                strokeWidth: isSel ? 1.2 : 0.4,
                                outline: "none",
                              },
                              hover: {
                                fill: iso2 && geoByCode[iso2] ? "var(--primary)" : "var(--muted)",
                                cursor: iso2 && geoByCode[iso2] ? "pointer" : "default",
                                outline: "none",
                              },
                              pressed: { fill: "var(--primary)", outline: "none" },
                            }}
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
            <div className="flex-1 h-2 rounded" style={{ background: "linear-gradient(90deg, color-mix(in oklch, var(--primary) 20%, transparent), var(--primary))" }} />
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

/* ---------- Heatmap dia da semana × hora do dia ---------- */
const DOW_LBL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
function HourDayHeatmap({ hourly }: { hourly: any[] }) {
  const { grid, max, total, bestDay, bestHour, bestCell } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const perDow = Array(7).fill(0);
    const perHour = Array(24).fill(0);
    let max = 0, total = 0;
    let bestCell = { d: -1, h: -1, val: 0 };
    for (const r of hourly ?? []) {
      const d = Number(r.dow), h = Number(r.hour);
      if (!(d >= 0 && d <= 6) || !(h >= 0 && h <= 23)) continue;
      const v = Number(r.results ?? 0);
      g[d][h] += v;
      perDow[d] += v;
      perHour[h] += v;
      total += v;
      if (g[d][h] > max) max = g[d][h];
      if (g[d][h] > bestCell.val) bestCell = { d, h, val: g[d][h] };
    }
    const bd = perDow.indexOf(Math.max(...perDow));
    const bh = perHour.indexOf(Math.max(...perHour));
    return {
      grid: g,
      max: Math.max(1, max),
      total,
      bestDay: perDow[bd] ? { label: DOW_LBL[bd], val: perDow[bd] } : null,
      bestHour: perHour[bh] ? { label: `${String(bh).padStart(2, "0")}h`, val: perHour[bh] } : null,
      bestCell: bestCell.val > 0 ? bestCell : null,
    };
  }, [hourly]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapa de calor · melhor dia e horário para leads</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {total === 0
            ? "Sem dados horários ainda. Sincronize a conta para popular o heatmap por hora."
            : (
              <>
                {bestDay && <>Melhor dia: <b>{bestDay.label}</b> ({fmtInt(bestDay.val)} leads) · </>}
                {bestHour && <>melhor horário: <b>{bestHour.label}</b> ({fmtInt(bestHour.val)} leads)</>}
                {bestCell && (
                  <> · pico: <b>{DOW_LBL[bestCell.d]} {String(bestCell.h).padStart(2, "0")}h</b> ({fmtInt(bestCell.val)})</>
                )}
              </>
            )}
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[560px]">
            {/* header hours */}
            <div className="flex gap-[2px] pl-8 mb-1">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground tabular-nums">
                  {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                </div>
              ))}
            </div>
            {DOW_LBL.map((lbl, d) => (
              <div key={lbl} className="flex items-center gap-[2px] mb-[2px]">
                <div className="w-8 text-[10px] text-muted-foreground shrink-0">{lbl}</div>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = grid[d][h];
                  // escala logarítmica para destacar melhor valores baixos
                  const intensity = v > 0 && max > 0 ? Math.log(v + 1) / Math.log(max + 1) : 0;
                  const bg = v === 0
                    ? "#eef2f7"
                    : `rgb(${Math.round(219 - intensity * 182)}, ${Math.round(234 - intensity * 135)}, ${Math.round(254 - intensity * 19)})`;
                  return (
                    <div
                      key={h}
                      className="flex-1 aspect-square rounded-[3px] border border-border/40"
                      style={{ backgroundColor: bg, minWidth: 8 }}
                      title={`${lbl} · ${String(h).padStart(2, "0")}h — ${v} leads`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>Menos</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div
              key={v}
              className="h-3 w-3 rounded-sm border border-border/40"
              style={{
                backgroundColor: v === 0
                  ? "#eef2f7"
                  : `rgb(${Math.round(219 - v * 182)}, ${Math.round(234 - v * 135)}, ${Math.round(254 - v * 19)})`,
              }}
            />
          ))}
          <span>Mais</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* WhatsApp KPI card with comparison badge */
function WaKpi({ label, value, prev, hint, accent }: { label: string; value: number; prev: number; hint?: string; accent?: "primary" | "emerald" }) {
  const delta = prev ? ((value - prev) / prev) * 100 : 0;
  const showDelta = prev > 0 && Number.isFinite(delta) && Math.abs(delta) > 0.5;
  const up = delta >= 0;
  const accentBg = accent === "emerald" ? "bg-emerald-500/10 text-emerald-600" : accent === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className={`h-6 w-6 rounded flex items-center justify-center ${accentBg}`}>
          <MessageCircle className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-semibold mt-1 tabular-nums">{fmtInt(value)}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
      {showDelta ? (
        <div className={`text-[11px] mt-1 flex items-center gap-1 ${up ? "text-emerald-600" : "text-rose-600"}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? "+" : ""}{delta.toFixed(1)}% vs. período anterior ({fmtInt(prev)})
        </div>
      ) : prev > 0 ? (
        <div className="text-[11px] mt-1 text-muted-foreground">Estável vs. período anterior</div>
      ) : null}
    </div>
  );
}

/* Region (state) ranking */
function RegionRanking({ regions }: { regions: { region: string; country: string; spend: number; results: number; clicks: number; impressions: number; reach: number; pct: number }[] }) {
  if (!regions.length) return null;
  const max = regions[0]?.spend || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ranking por estado / região</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Distribuição do investimento pelas regiões onde seu anúncio foi entregue.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {regions.slice(0, 30).map((g, i) => {
            const cpa = g.results ? g.spend / g.results : 0;
            return (
              <div key={g.region + i} className="rounded-md border p-3 hover:bg-accent/40 transition">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</div>
                    <div className="text-sm font-medium truncate">{g.region}</div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{g.country}</span>
                  </div>
                  <div className="text-sm font-semibold tabular-nums shrink-0">{fmtBRL(g.spend)}</div>
                </div>
                <div className="h-1.5 bg-muted rounded overflow-hidden mb-2">
                  <div className="h-full bg-primary" style={{ width: `${(g.spend / max) * 100}%` }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                  <div><span className="text-foreground font-medium">{fmtInt(g.results)}</span> result.</div>
                  <div>CPR <span className="text-foreground font-medium">{g.results ? fmtBRL(cpa) : "—"}</span></div>
                  <div><span className="text-foreground font-medium">{fmtInt(g.clicks)}</span> cliques</div>
                  <div><span className="text-foreground font-medium">{g.pct.toFixed(1)}%</span> do total</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* Period picker: presets + range calendar in one popover */
const PERIOD_PRESETS: { value: string; label: string }[] = [
  { value: "current_week", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "15", label: "Últimos 15 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 3 meses" },
  { value: "365", label: "Último ano" },
  { value: "all", label: "Todo o período" },
];
function periodLabel(period: string, customRange: { from?: Date; to?: Date }) {
  if (period === "custom") {
    const f = customRange.from?.toLocaleDateString("pt-BR");
    const t = customRange.to?.toLocaleDateString("pt-BR");
    return f && t ? `${f} → ${t}` : "Personalizado";
  }
  return PERIOD_PRESETS.find((p) => p.value === period)?.label ?? "Período";
}
function presetToRange(period: string): { from?: Date; to?: Date } {
  if (period === "all") return {};
  const to = new Date(); to.setHours(0, 0, 0, 0);
  if (period === "current_week") return { from: to, to };
  const n = Number(period);
  if (!Number.isFinite(n)) return {};
  const from = new Date(to); from.setDate(from.getDate() - (n - 1));
  return { from, to };
}
function PeriodPicker({
  period, setPeriod, customRange, setCustomRange,
}: {
  period: string;
  setPeriod: (v: string) => void;
  customRange: { from?: Date; to?: Date };
  setCustomRange: (r: { from?: Date; to?: Date }) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedRange = period === "custom" ? customRange : presetToRange(period);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          {periodLabel(period, customRange)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="border-r p-1.5 w-[150px] space-y-0.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pt-1 pb-1">Período</div>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setCustomRange({}); }}
                className={cn(
                  "w-full text-left text-xs rounded px-2 py-1.5 transition-colors",
                  period === p.value ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="p-1">
            <Calendar
              mode="range"
              selected={selectedRange as any}
              defaultMonth={selectedRange.from ?? new Date()}
              onSelect={(r: any) => { setPeriod("custom"); setCustomRange(r || {}); }}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

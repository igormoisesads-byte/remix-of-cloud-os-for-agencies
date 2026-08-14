import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ChevronLeft, Plus, Check, LayoutGrid, BarChart3, LineChart, Search, Repeat, HeartPulse,
  AlertTriangle, Star, FileText, Calendar, Video, ImageIcon, Key, ListChecks, ClipboardList,
  Eye, EyeOff, ExternalLink, RefreshCw, Trash2, Facebook, Sparkles, Loader2, Share2, Copy, DollarSign, Film,
} from "lucide-react";

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncAdAccount } from "@/lib/ads.functions";
import { generateAiReport } from "@/lib/reports.functions";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
const ReactMarkdown = lazy(() => import("react-markdown"));
const PerformanceView = lazy(() => import("@/components/performance-view").then((m) => ({ default: m.PerformanceView })));
const ClientSales = lazy(() => import("@/components/client-sales").then((m) => ({ default: m.ClientSales })));
const AiDataChat = lazy(() => import("@/components/ai-data-chat").then((m) => ({ default: m.AiDataChat })));
const CreativesView = lazy(() => import("@/components/creatives-view").then((m) => ({ default: m.CreativesView })));

import { uploadToR2 } from "@/lib/upload-r2";
import { updateDueDateFn } from "@/lib/monthly-fees.functions";
import { Pencil, Upload } from "lucide-react";


const clientQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, niches(name), perf:profiles!clients_performance_user_id_fkey(full_name), cs:profiles!clients_cs_user_id_fkey(full_name)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Cliente — CloudOS" },
      { name: "description", content: "Detalhes, performance, onboarding e auditoria do cliente no CloudOS." },
      { property: "og:title", content: "Cliente — CloudOS" },
      { property: "og:description", content: "Acompanhe visão geral, tarefas, relatórios e histórico do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClienteDetail,
});

const TYPE_LABEL: Record<string, string> = { local: "Local", perpetuo: "Perpétuo", lancamento: "Lançamento", autoria: "Autoria", desenvolvimento: "Desenvolvimento" };

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "—";
}

type Section =
  | "visao" | "performance" | "criativos" | "vendas" | "projecoes" | "seo" | "rotinas" | "health"
  | "pdas" | "nps" | "relatorios" | "reunioes" | "onboarding" | "moodboards"
  | "acesso" | "auditoria";

const NAV: { key: Section; label: string; icon: any }[] = [
  { key: "visao", label: "Visão Geral", icon: LayoutGrid },
  { key: "performance", label: "Performance", icon: BarChart3 },
  { key: "criativos", label: "Criativos", icon: Film },
  { key: "vendas", label: "Vendas", icon: DollarSign },
  { key: "onboarding", label: "Onboarding", icon: ListChecks },
  { key: "projecoes", label: "Projeções", icon: LineChart },
  { key: "seo", label: "SEO", icon: Search },
  { key: "rotinas", label: "Rotinas", icon: Repeat },
  { key: "health", label: "Health Score", icon: HeartPulse },
  { key: "pdas", label: "PDAs", icon: AlertTriangle },
  { key: "nps", label: "NPS", icon: Star },
  { key: "relatorios", label: "Relatórios", icon: FileText },
  { key: "reunioes", label: "Reuniões", icon: Video },
  { key: "moodboards", label: "Moodboards", icon: ImageIcon },
  { key: "acesso", label: "Acesso", icon: Key },
  { key: "auditoria", label: "Auditoria", icon: ClipboardList },
];


function ClienteDetail() {
  const { id } = Route.useParams();
  const [section, setSection] = useState<Section>("visao");

  const client = useQuery(clientQueryOptions(id));

  if (client.isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-4">
        <div className="h-8 w-64 rounded-md bg-muted animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (client.error) {
    return (
      <div className="p-8 max-w-xl space-y-3">
        <h1 className="text-xl font-semibold">Não foi possível abrir o cliente</h1>
        <p className="text-sm text-muted-foreground">A navegação abriu, mas os dados do cliente não carregaram. Tente novamente.</p>
        <Button onClick={() => client.refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  if (!client.data) return <div className="p-8">Cliente não encontrado</div>;
  const c = client.data;

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-3.5rem)] md:overflow-hidden">
      {/* Sub-sidebar do cliente */}
      <div className="md:w-56 md:shrink-0 border-b md:border-b-0 md:border-r bg-card md:overflow-y-auto">
        <div className="p-3 border-b">
          <Link to="/clientes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <div className="mt-2 flex items-center gap-2">
            {c.logo_url ? (
              <img src={c.logo_url} alt={c.name} className="h-8 w-8 rounded-full object-cover ring-1 ring-border shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {c.name?.slice(0, 1)?.toUpperCase() || "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold truncate text-sm">{c.name}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{TYPE_LABEL[c.type]}</div>
            </div>
          </div>
        </div>
        <nav className="flex md:block gap-1 md:gap-0 p-2 md:space-y-0.5 overflow-x-auto md:overflow-visible">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = section === n.key;
            return (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`shrink-0 md:shrink w-auto md:w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" /> {n.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 md:overflow-y-auto min-w-0">
        <div className="border-b px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2 bg-card/40">
          {c.logo_url && (
            <img src={c.logo_url} alt={c.name} className="h-9 w-9 rounded-lg object-cover ring-1 ring-border" />
          )}
          <h1 className="text-lg sm:text-xl font-bold tracking-tight break-words min-w-0">{c.name}</h1>
          <Badge variant="outline">{TYPE_LABEL[c.type]}</Badge>
          <Badge>{c.status}</Badge>
          {c.niches?.name && <Badge variant="secondary">{c.niches.name}</Badge>}
          <div className="w-full sm:w-auto sm:ml-auto text-xs text-muted-foreground truncate">
            {[c.site, c.city_uf].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>}>
          {section === "visao" && <VisaoGeral c={c} />}
          {section === "performance" && <Performance clientId={id} clientType={c.type} />}
          {section === "criativos" && <CreativesView clientId={id} clientType={c.type} />}
          {section === "vendas" && <ClientSales clientId={id} />}
          </Suspense>


          {section === "projecoes" && <Projecoes c={c} />}
          {section === "seo" && <Placeholder title="SEO" text="Em breve: rastreio de posições e páginas do cliente." />}
          {section === "rotinas" && <Rotinas clientId={id} />}
          {section === "health" && <HealthScoreView clientId={id} />}
          {section === "pdas" && <Pdas clientId={id} />}
          {section === "nps" && <Nps clientId={id} />}
          {section === "relatorios" && <Relatorios clientId={id} />}
          {section === "reunioes" && <Reunioes clientId={id} />}
          {section === "onboarding" && <Onboarding clientId={id} />}
          {section === "moodboards" && <Moodboards clientId={id} />}
          {section === "acesso" && <Acessos clientId={id} />}
          {section === "auditoria" && <Auditoria clientId={id} />}
        </div>
      </div>
    </div>
  );
}


/* ============ VISÃO GERAL ============ */
function VisaoGeral({ c }: { c: any }) {
  const healthQ = useQuery({
    queryKey: ["health-last", c.id],
    queryFn: async () => (await supabase.from("health_scores").select("score,recorded_at").eq("client_id", c.id).order("recorded_at", { ascending: false }).limit(1)).data?.[0] ?? null,
  });
  const pdasQ = useQuery({
    queryKey: ["pdas-open", c.id],
    queryFn: async () => (await supabase.from("pdas").select("id").eq("client_id", c.id).neq("status", "resolvido")).data?.length ?? 0,
  });
  const npsQ = useQuery({
    queryKey: ["nps-last", c.id],
    queryFn: async () => (await supabase.from("nps_responses").select("score,created_at").eq("client_id", c.id).order("created_at", { ascending: false }).limit(1)).data?.[0] ?? null,
  });
  const onbQ = useQuery({
    queryKey: ["onb-summary", c.id],
    queryFn: async () => (await supabase.from("onboarding_tasks").select("done").eq("client_id", c.id)).data ?? [],
  });
  const doneCount = (onbQ.data ?? []).filter((t: any) => t.done).length;
  const totalCount = (onbQ.data ?? []).length;

  // Investimento do mês atual (soma de spend em ad_insights via ad_accounts do cliente)
  const spendQ = useQuery({
    queryKey: ["mtd-spend", c.id],
    queryFn: async () => {
      const { data: accs } = await supabase.from("ad_accounts").select("id").eq("client_id", c.id);
      const ids = (accs ?? []).map((a: any) => a.id);
      if (!ids.length) return 0;
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const { data: rows } = await supabase.from("ad_insights").select("spend").in("ad_account_id", ids).gte("date", first);
      return (rows ?? []).reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
    },
  });

  const expected = Number(c.investimento_mensal ?? 0);
  const actual = Number(spendQ.data ?? 0);
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedPace = expected * (day / daysInMonth);
  const paceDiff = expectedPace ? ((actual - expectedPace) / expectedPace) * 100 : 0;
  let paceLabel = "Sem meta definida";
  let paceTone: "muted" | "emerald" | "amber" | "rose" = "muted";
  if (expected > 0) {
    if (Math.abs(paceDiff) <= 10) { paceLabel = "Dentro do esperado"; paceTone = "emerald"; }
    else if (paceDiff > 10) { paceLabel = `Acima do esperado (+${paceDiff.toFixed(0)}%)`; paceTone = "amber"; }
    else { paceLabel = `Abaixo do esperado (${paceDiff.toFixed(0)}%)`; paceTone = "rose"; }
  }
  const paceClass =
    paceTone === "emerald" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
    : paceTone === "amber" ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
    : paceTone === "rose" ? "text-rose-600 bg-rose-500/10 border-rose-500/20"
    : "text-muted-foreground bg-muted border-border";
  const pctOfExpected = expected ? Math.min(100, (actual / expected) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Visão geral do cliente</div>
        <EditClientDialog client={c} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Dados Cadastrais</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-x-6 gap-y-2">
          <Field k="Tipo" v={TYPE_LABEL[c.type]} />
          <Field k="Início" v={fmtDate(c.contract_start)} />
          <Field k="Nicho" v={c.niches?.name || c.niche || "—"} />
          <Field k="Fim contrato" v={fmtDate(c.contract_end)} />
          <Field k="Plataforma" v={c.platform || "—"} />
          <Field k="Aniversário marca" v={fmtDate(c.brand_anniversary)} />
          <Field k="Site" v={c.site || "—"} />
          <Field k="Cidade/UF" v={c.city_uf || "—"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Responsáveis & Local</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-x-6 gap-y-2">
          <Field k="Performance" v={c.perf?.full_name || "—"} />
          <Field k="Endereço" v={c.address || "—"} />
          <Field k="CS" v={c.cs?.full_name || "—"} />
          <Field k="Mensalidade" v={c.monthly_fee_amount ? `${fmtBRL(Number(c.monthly_fee_amount))} / dia ${c.monthly_fee_day ?? "—"}` : "—"} />
          <Field k="Investimento mensal" v={expected > 0 ? fmtBRL(expected) : "—"} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Investimento do mês
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gasto até hoje</div>
              <div className="text-2xl font-semibold tabular-nums">{fmtBRL(actual)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Esperado: <b className="text-foreground">{expected > 0 ? fmtBRL(expected) : "—"}</b>
                {expected > 0 && <> · Ritmo esperado (dia {day}/{daysInMonth}): <b className="text-foreground">{fmtBRL(expectedPace)}</b></>}
              </div>
            </div>
            <span className={`text-xs font-medium rounded-full border px-2.5 py-1 ${paceClass}`}>{paceLabel}</span>
          </div>
          {expected > 0 && (
            <div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${paceTone === "rose" ? "bg-rose-500" : paceTone === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pctOfExpected}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground flex justify-between">
                <span>{((actual / expected) * 100).toFixed(0)}% da meta</span>
                <span>Restante: {fmtBRL(Math.max(0, expected - actual))}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <StatCard title="Health Score" icon={HeartPulse} value={healthQ.data ? `${healthQ.data.score}%` : "Sem registros"} sub={healthQ.data ? `atualizado ${fmtDate(healthQ.data.recorded_at)}` : ""} />
      <StatCard title="PDAs" icon={AlertTriangle} value={`${pdasQ.data ?? 0} pendentes`} />
      <StatCard title="NPS" icon={Star} value={npsQ.data ? String(npsQ.data.score) : "Sem registros"} sub={npsQ.data ? fmtDate(npsQ.data.created_at) : ""} />
      <StatCard title="Onboarding" icon={ListChecks} value={totalCount ? `${doneCount}/${totalCount}` : "Não iniciado"} sub={totalCount ? `${Math.round((doneCount / totalCount) * 100)}% concluído` : ""} />
      </div>
    </div>
  );
}

function EditClientDialog({ client }: { client: any }) {
  const qc = useQueryClient();
  const updateDueDate = useServerFn(updateDueDateFn);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: client.name || "",
    site: client.site || "",
    city_uf: client.city_uf || "",
    address: client.address || "",
    platform: client.platform || "",
    instagram: client.instagram || "",
    brand_anniversary: client.brand_anniversary || "",
    contract_start: client.contract_start || "",
    contract_end: client.contract_end || "",
    monthly_fee_amount: client.monthly_fee_amount ?? "",
    monthly_fee_day: client.monthly_fee_day ?? "",
    investimento_mensal: client.investimento_mensal ?? "",
    logo_url: client.logo_url || "",
    notes: client.notes || "",
  });

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    setUploading(true);
    try {
      const url = await uploadToR2(file, { folder: `clients/${client.id}`, filename: file.name });
      setForm((f) => ({ ...f, logo_url: url }));
      toast.success("Logo carregada.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      // 1. If due day changed, update it and future fees
      const newDay = form.monthly_fee_day === "" ? null : Number(form.monthly_fee_day);
      if (newDay !== null && newDay !== client.monthly_fee_day) {
        await updateDueDate({ data: { clientId: client.id, newDay } });
      }

      // 2. Update remaining fields
      const payload: any = {
        ...form,
        monthly_fee_amount: form.monthly_fee_amount === "" ? null : Number(form.monthly_fee_amount),
        monthly_fee_day: newDay,
        investimento_mensal: form.investimento_mensal === "" ? null : Number(form.investimento_mensal),
        brand_anniversary: form.brand_anniversary || null,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        logo_url: form.logo_url || null,
      };
      const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
      if (error) throw error;

      toast.success("Cliente atualizado.");
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Logo do cliente</Label>
            <div className="mt-2 flex items-center gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="h-16 w-16 rounded-lg object-cover ring-1 ring-border" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">Sem logo</div>
              )}
              <div className="flex gap-2">
                <input id="client-logo-upload" type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label htmlFor="client-logo-upload" className="cursor-pointer inline-flex items-center gap-2">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Enviando..." : form.logo_url ? "Trocar" : "Enviar"}
                  </label>
                </Button>
                {form.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}>Remover</Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Aparece no relatório público e no perfil do cliente.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Site</Label><Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} /></div>
            <div><Label>Cidade/UF</Label><Input value={form.city_uf} onChange={(e) => setForm({ ...form, city_uf: e.target.value })} /></div>
            <div><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Plataforma</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
            <div><Label>Instagram</Label><Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></div>
            <div><Label>Aniversário da marca</Label><Input type="date" value={form.brand_anniversary} onChange={(e) => setForm({ ...form, brand_anniversary: e.target.value })} /></div>
            <div><Label>Início do contrato</Label><Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} /></div>
            <div><Label>Fim do contrato</Label><Input type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} /></div>
            <div><Label>Mensalidade (R$)</Label><Input type="number" step="0.01" value={form.monthly_fee_amount} onChange={(e) => setForm({ ...form, monthly_fee_amount: e.target.value })} /></div>
            <div><Label>Dia do vencimento</Label><Input type="number" min="1" max="31" value={form.monthly_fee_day} onChange={(e) => setForm({ ...form, monthly_fee_day: e.target.value })} /></div>
            <div><Label>Investimento mensal (R$)</Label><Input type="number" step="0.01" value={form.investimento_mensal} onChange={(e) => setForm({ ...form, investimento_mensal: e.target.value })} /></div>
          </div>

          <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
function StatCard({ title, icon: Icon, value, sub }: { title: string; icon: any; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /> {title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div>{sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}</CardContent>
    </Card>
  );
}

/* ============ PERFORMANCE (Meta Ads / Google Ads) ============ */
function Performance({ clientId, clientType }: { clientId: string; clientType: string }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("gestor");
  const syncFn = useServerFn(syncAdAccount);
  const [days, setDays] = useState<string>("30");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncDialog, setSyncDialog] = useState<{ id: string; open: boolean }>({ id: "", open: false });
  const [syncPreset, setSyncPreset] = useState<"last_30d" | "last_90d" | "last_6m" | "last_year" | "maximum">("last_30d");

  const daysNum = days === "all" ? 3650 : Number(days);

  const accounts = useQuery({
    queryKey: ["ad_accounts", clientId],
    queryFn: async () => (await supabase.from("ad_accounts").select("*").eq("client_id", clientId).order("created_at")).data ?? [],
  });
  const accountIds = (accounts.data ?? []).map((a: any) => a.id);

  const insights = useQuery({
    queryKey: ["ad_insights", clientId, daysNum, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - daysNum);
      const { data } = await supabase.from("ad_insights").select("*")
        .in("ad_account_id", accountIds).gte("date", since.toISOString().slice(0, 10)).order("date");
      return data ?? [];
    },
  });
  const creatives = useQuery({
    queryKey: ["ad_creatives", clientId, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => (await supabase.from("ad_creatives").select("*").in("ad_account_id", accountIds).order("spend", { ascending: false })).data ?? [],
  });
  const geo = useQuery({
    queryKey: ["ad_geo", clientId, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => (await supabase.from("ad_geo").select("*").in("ad_account_id", accountIds)).data ?? [],
  });
  const wa = useQuery({
    queryKey: ["ad_wa", clientId, daysNum, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - daysNum);
      const { data } = await supabase.from("ad_funnel_whatsapp").select("*")
        .in("ad_account_id", accountIds).gte("date", since.toISOString().slice(0, 10)).order("date");
      return data ?? [];
    },
  });
  const campaignInsights = useQuery({
    queryKey: ["ad_campaign_insights", clientId, daysNum, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - daysNum);
      const { data } = await supabase.from("ad_campaign_insights").select("*")
        .in("ad_account_id", accountIds).gte("date", since.toISOString().slice(0, 10)).order("date");
      return data ?? [];
    },
  });
  const hourly = useQuery({
    queryKey: ["ad_hourly_leads", clientId, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => (await supabase.from("ad_hourly_leads").select("*").in("ad_account_id", accountIds)).data ?? [],
  });

  // Vendas do período (agregado, para CPV/ROAS/Lucro)
  const salesAgg = useQuery({
    queryKey: ["client_sales_agg", clientId, daysNum],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - daysNum);
      const { data } = await supabase.from("client_sales").select("leads, agendamentos, vendas, faturamento")
        .eq("client_id", clientId).gte("ref_date", since.toISOString().slice(0, 10));
      const t = (data ?? []).reduce((a: any, r: any) => ({
        leads: a.leads + Number(r.leads || 0),
        agendamentos: a.agendamentos + Number(r.agendamentos || 0),
        vendas: a.vendas + Number(r.vendas || 0),
        faturamento: a.faturamento + Number(r.faturamento || 0),
      }), { leads: 0, agendamentos: 0, vendas: 0, faturamento: 0 });
      return t;

    },
  });

  async function sync(accId: string, opts?: { preset?: string; first?: boolean }) {
    setSyncing(accId);
    try {
      const payload: any = { ad_account_id: accId };
      if (opts?.preset) payload.preset = opts.preset;
      const r: any = await syncFn({ data: payload });
      toast.success(`Sincronizado: ${r.insights || 0} dias, ${r.creatives || 0} criativos, ${r.geo || 0} regiões`);
      qc.invalidateQueries({ queryKey: ["ad_accounts", clientId] });
      qc.invalidateQueries({ queryKey: ["ad_insights", clientId] });
      qc.invalidateQueries({ queryKey: ["ad_creatives", clientId] });
      qc.invalidateQueries({ queryKey: ["ad_geo", clientId] });
      qc.invalidateQueries({ queryKey: ["ad_wa", clientId] });
      qc.invalidateQueries({ queryKey: ["ad_campaign_insights", clientId] });
    } catch (e: any) { toast.error(e.message); } finally { setSyncing(null); }
  }
  function openSync(acc: any) {
    setSyncPreset(acc.last_sync_at ? "last_30d" : "maximum");
    setSyncDialog({ id: acc.id, open: true });
  }
  async function confirmSync() {
    const id = syncDialog.id;
    setSyncDialog({ id: "", open: false });
    await sync(id, { preset: syncPreset });
  }
  async function remove(id: string) {
    if (!confirm("Remover esta conta de anúncio? O histórico salvo também será apagado.")) return;
    const { error } = await supabase.from("ad_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ad_accounts", clientId] });
  }


  const focusHint = clientType === "local"
    ? "Foco recomendado para cliente local: campanhas de mensagem (WhatsApp) e tráfego pro site."
    : "Configure objetivos (conversões, leads) na plataforma para relatórios precisos.";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Performance de mídia</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">{focusHint} Atualização automática a cada 4h.</div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="180">Últimos 6 meses</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
            {canManage && <SharePublicLinkDialog clientId={clientId} />}
            {canManage && <ConnectAdAccountDialog clientId={clientId} onSaved={() => qc.invalidateQueries({ queryKey: ["ad_accounts", clientId] })} />}
          </div>
        </CardHeader>
        <CardContent>
          {(accounts.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm">
              <BarChart3 className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <div className="font-medium">Nenhuma conta conectada</div>
              <div className="text-muted-foreground mt-1">
                {canManage ? "Conecte uma conta do Meta Ads para começar." : "Peça a um admin/gestor para conectar as contas."}
              </div>
            </div>
          ) : (
            <>
              <div>
                <PerformanceView data={{
                  insights: insights.data ?? [],
                  creatives: creatives.data ?? [],
                  geo: geo.data ?? [],
                  whatsapp: wa.data ?? [],
                  campaignInsights: campaignInsights.data ?? [],
                  accounts: accounts.data ?? [],
                  sales: salesAgg.data,
                  hourly: hourly.data ?? [],
                  clientType,
                }} />
                <AiDataChat clientId={clientId} period={{}} />
              </div>
              <div className="mt-4 space-y-2">
                {(accounts.data ?? []).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center ${a.provider === "meta" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {a.provider === "meta" ? <Facebook className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{a.account_name || a.account_id} <Badge variant="outline" className="ml-1">{a.provider === "meta" ? "Meta Ads" : "Google Ads"}</Badge></div>
                        <div className="text-xs text-muted-foreground">
                          {a.last_sync_at ? `Última sync: ${new Date(a.last_sync_at).toLocaleString("pt-BR")}` : "Nunca sincronizado"}
                          {a.last_sync_error && <span className="text-destructive"> · {a.last_sync_error}</span>}
                        </div>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" disabled={syncing === a.id} onClick={() => openSync(a)}>
                          <RefreshCw className={`h-3.5 w-3.5 ${syncing === a.id ? "animate-spin" : ""}`} />
                          Sincronizar
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

        </CardContent>
      </Card>

      <Dialog open={syncDialog.open} onOpenChange={(o) => setSyncDialog({ id: syncDialog.id, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sincronizar Meta Ads</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha o período que deve ser puxado do Meta. Serão importadas contas, campanhas, conjuntos e anúncios.
            </p>
            <Select value={syncPreset} onValueChange={(v: any) => setSyncPreset(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
                <SelectItem value="last_90d">Últimos 90 dias</SelectItem>
                <SelectItem value="last_6m">Últimos 6 meses</SelectItem>
                <SelectItem value="last_year">Último ano</SelectItem>
                <SelectItem value="maximum">Toda a conta (histórico completo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Dica: na primeira sincronização, escolha "Toda a conta" para trazer o histórico completo. Nas próximas, "Últimos 30 dias" já basta para manter os dados atualizados.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialog({ id: "", open: false })}>Cancelar</Button>
            <Button onClick={confirmSync}>Sincronizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


const SHARE_PERIODS = [
  { value: "current_month", label: "Mês atual" },
  { value: "current_week", label: "Semana atual" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "15", label: "Últimos 15 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Último ano" },
  { value: "all", label: "Todo o período" },
];

function SharePublicLinkDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Relatório de performance");
  const [defaultPeriod, setDefaultPeriod] = useState("current_month");
  const [existing, setExisting] = useState<any[]>([]);

  async function refresh() {
    const { data } = await supabase.from("public_reports").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setExisting(data ?? []);
  }
  async function create() {
    setBusy(true);
    const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
    const { error } = await supabase.from("public_reports").insert({ client_id: clientId, token, title, default_period: defaultPeriod } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Link público criado.");
    refresh();
  }
  async function toggle(r: any) {
    await supabase.from("public_reports").update({ active: !r.active }).eq("id", r.id);
    refresh();
  }
  async function changePeriod(r: any, value: string) {
    setExisting((prev) => prev.map((x) => (x.id === r.id ? { ...x, default_period: value } : x)));
    const { error } = await supabase.from("public_reports").update({ default_period: value } as any).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Visualização padrão atualizada.");
  }
  async function copyLink(token: string) {
    const url = `${window.location.origin}/p/relatorio/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) refresh(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Share2 className="h-4 w-4" />Link público</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Compartilhar com o cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Crie um link para o cliente ver o dashboard em tempo real, sem login.</div>
          <div className="space-y-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do relatório" />
            <div className="flex gap-2">
              <Select value={defaultPeriod} onValueChange={setDefaultPeriod}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Visualização padrão" /></SelectTrigger>
                <SelectContent>
                  {SHARE_PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={create} disabled={busy}><Plus className="h-4 w-4" />Criar</Button>
            </div>
            <div className="text-[11px] text-muted-foreground">O cliente abre o relatório já nesse período (ele ainda pode trocar).</div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {existing.map((r) => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/p/relatorio/${r.token}`;
              return (
                <div key={r.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">{r.title || "Sem título"}</div>
                    <Badge variant={r.active ? "default" : "outline"}>{r.active ? "Ativo" : "Desativado"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={url} className="h-8 text-xs" />
                    <Button size="icon" variant="ghost" onClick={() => copyLink(r.token)}><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => window.open(url, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground shrink-0">Visualização</span>
                    <Select value={r.default_period || "current_month"} onValueChange={(v) => changePeriod(r, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHARE_PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{r.view_count} visualizações</span>
                    <button className="underline" onClick={() => toggle(r)}>{r.active ? "Desativar" : "Reativar"}</button>
                  </div>
                </div>
              );
            })}
            {existing.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Nenhum link criado ainda.</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



function ConnectAdAccountDialog({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ provider: "meta", account_id: "", account_name: "", access_token: "", currency: "BRL" });
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  async function submit() {
    if (!form.account_id.trim() || !form.access_token.trim()) {
      return toast.error("Informe ID da conta e token de acesso.");
    }
    setBusy(true);
    const { error } = await supabase.from("ad_accounts").insert({
      client_id: clientId,
      provider: form.provider,
      account_id: form.account_id.trim(),
      account_name: form.account_name.trim() || null,
      access_token: form.access_token.trim(),
      currency: form.currency,
      created_by: user?.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta conectada. Clique em Sincronizar para importar os dados.");
    setOpen(false);
    setForm({ provider: "meta", account_id: "", account_name: "", access_token: "", currency: "BRL" });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> Conectar conta</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Conectar conta de anúncio</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta Ads (Facebook / Instagram)</SelectItem>
                <SelectItem value="google">Google Ads (em breve)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ID da conta {form.provider === "meta" ? "(ex: 1234567890 ou act_1234567890)" : "(customer id)"}</Label>
            <Input value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Apelido da conta (opcional)</Label>
            <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Access Token {form.provider === "meta" ? "(long-lived, com escopo ads_read)" : ""}</Label>
            <Textarea rows={3} value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} />
            <div className="text-xs text-muted-foreground">
              {form.provider === "meta"
                ? "Gere em business.facebook.com → Configurações → Usuários do sistema → Gerar token. Escopo: ads_read (e ads_management se for necessário)."
                : "Google Ads exige OAuth + developer token; integração automatizada em breve."}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Conectar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Projecoes({ c }: { c: any }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Projeções com IA</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border border-dashed p-6 text-center">
          <LineChart className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <div className="font-medium">Projeções baseadas em histórico</div>
          <div className="text-muted-foreground mt-1">Após conectar Meta/Google, a IA vai analisar gastos e resultados de {c.name} para projetar cenários dos próximos meses.</div>
        </div>
      </CardContent>
    </Card>
  );
}
function Placeholder({ title, text }: { title: string; text: string }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{text}</CardContent></Card>;
}

/* ============ ROTINAS ============ */
function Rotinas({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["routines", clientId],
    queryFn: async () => (await supabase.from("client_routines").select("*, profiles(full_name)").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", frequency: "semanal", day_of_week: "1", day_of_month: "1", description: "" });

  async function submit() {
    if (!form.title.trim() || !user) return;
    const { error } = await supabase.from("client_routines").insert({
      client_id: clientId, title: form.title, description: form.description || null,
      frequency: form.frequency,
      day_of_week: form.frequency !== "mensal" ? Number(form.day_of_week) : null,
      day_of_month: form.frequency === "mensal" ? Number(form.day_of_month) : null,
      created_by: user.id, assignee_id: user.id,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ title: "", frequency: "semanal", day_of_week: "1", day_of_month: "1", description: "" });
    qc.invalidateQueries({ queryKey: ["routines", clientId] });
    toast.success("Rotina criada");
  }
  async function generateNow(r: any) {
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      title: r.title, description: r.description, client_id: clientId, assignee_id: r.assignee_id || user.id,
      created_by: user.id, kind: "rotina", status: "todo", priority: "media",
    });
    if (error) return toast.error(error.message);
    await supabase.from("client_routines").update({ last_generated: new Date().toISOString().slice(0, 10) }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["routines", clientId] });
    toast.success("Tarefa gerada em Operações");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-base">Rotinas</CardTitle><div className="text-xs text-muted-foreground mt-1">Ações recorrentes que viram tarefas em Operações.</div></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Rotina</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova rotina</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency !== "mensal" ? (
                  <div className="space-y-2">
                    <Label>Dia da semana</Label>
                    <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((d,i)=><SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2"><Label>Dia do mês</Label><Input type="number" min="1" max="28" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} /></div>
                )}
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem rotinas.</p>}
        <div className="space-y-2">
          {(q.data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 p-3 border rounded-md">
              <div className="flex-1">
                <div className="font-medium text-sm">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.frequency} · {r.profiles?.full_name || "sem responsável"}{r.last_generated ? ` · última gerada em ${fmtDate(r.last_generated)}` : ""}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => generateNow(r)}>Gerar tarefa agora</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ HEALTH SCORE ============ */
function HealthScoreView({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["health", clientId],
    queryFn: async () => (await supabase.from("health_scores").select("*, profiles(full_name)").eq("client_id", clientId).order("recorded_at", { ascending: false })).data ?? [],
  });
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  async function add() {
    if (!score || !user) return;
    const n = Math.min(100, Math.max(0, Number(score)));
    const { error } = await supabase.from("health_scores").insert({ client_id: clientId, score: n, notes: notes || null, recorded_by: user.id });
    if (error) return toast.error(error.message);
    setScore(""); setNotes(""); qc.invalidateQueries({ queryKey: ["health", clientId] });
  }
  const last = q.data?.[0];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="text-base">Health atual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-5xl font-bold">{last ? `${last.score}%` : "—"}</div>
          <Progress value={last?.score ?? 0} />
          <div className="text-xs text-muted-foreground">{last ? `Atualizado em ${fmtDate(last.recorded_at)}` : "Sem registros"}</div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Registrar novo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2"><Label>Score (0-100)</Label><Input type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} /></div>
            <div className="space-y-2 col-span-3"><Label>Notas</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <Button onClick={add} size="sm">Salvar</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Score</TableHead><TableHead>Notas</TableHead><TableHead>Registrado por</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>}
              {(q.data ?? []).map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.recorded_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><Badge>{h.score}%</Badge></TableCell>
                  <TableCell className="text-sm">{h.notes || "—"}</TableCell>
                  <TableCell className="text-sm">{h.profiles?.full_name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ PDAs ============ */
function Pdas({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["pdas", clientId],
    queryFn: async () => (await supabase.from("pdas").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "media", due_date: "" });
  async function submit() {
    if (!form.title.trim() || !user) return;
    const { error } = await supabase.from("pdas").insert({ ...form, due_date: form.due_date || null, client_id: clientId, created_by: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ title: "", description: "", priority: "media", due_date: "" });
    qc.invalidateQueries({ queryKey: ["pdas", clientId] });
  }
  async function setStatus(id: string, status: string) {
    await supabase.from("pdas").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pdas", clientId] });
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">PDAs — Pontos de Atenção</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> PDA</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo PDA</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem PDAs.</p>}
        <div className="space-y-2">
          {(q.data ?? []).map((p: any) => (
            <div key={p.id} className="p-3 border rounded-md flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.title}</span>
                  <Badge variant={p.priority === "alta" ? "destructive" : "outline"}>{p.priority}</Badge>
                  <Badge variant={p.status === "resolvido" ? "default" : "secondary"}>{p.status}</Badge>
                </div>
                {p.description && <div className="text-xs text-muted-foreground mt-1">{p.description}</div>}
                {p.due_date && <div className="text-xs mt-1">Prazo: {fmtDate(p.due_date)}</div>}
              </div>
              <Select value={p.status} onValueChange={(v) => setStatus(p.id, v)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="aberto">Aberto</SelectItem><SelectItem value="em_andamento">Em andamento</SelectItem><SelectItem value="resolvido">Resolvido</SelectItem></SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ NPS ============ */
function Nps({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["nps", clientId],
    queryFn: async () => (await supabase.from("nps_responses").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ score: "", comment: "", respondent: "", period: new Date().toISOString().slice(0, 7) });
  async function add() {
    if (!form.score || !user) return;
    const { error } = await supabase.from("nps_responses").insert({ ...form, score: Number(form.score), client_id: clientId, created_by: user.id });
    if (error) return toast.error(error.message);
    setForm({ score: "", comment: "", respondent: "", period: form.period });
    qc.invalidateQueries({ queryKey: ["nps", clientId] });
  }
  const avg = useMemo(() => {
    const arr = q.data ?? [];
    if (arr.length === 0) return null;
    return (arr.reduce((s: number, r: any) => s + r.score, 0) / arr.length).toFixed(1);
  }, [q.data]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader><CardTitle className="text-base">Média</CardTitle></CardHeader><CardContent><div className="text-4xl font-bold">{avg ?? "—"}</div><div className="text-xs text-muted-foreground mt-1">{q.data?.length ?? 0} respostas</div></CardContent></Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Nova resposta</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2"><Label>Nota (0-10)</Label><Input type="number" min="0" max="10" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></div>
            <div className="space-y-2"><Label>Período</Label><Input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Respondente</Label><Input value={form.respondent} onChange={(e) => setForm({ ...form, respondent: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Comentário</Label><Textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
          <Button size="sm" onClick={add}>Salvar</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Período</TableHead><TableHead>Nota</TableHead><TableHead>Respondente</TableHead><TableHead>Comentário</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem respostas</TableCell></TableRow>}
              {(q.data ?? []).map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell>{fmtDate(n.created_at)}</TableCell>
                  <TableCell>{n.period || "—"}</TableCell>
                  <TableCell><Badge variant={n.score >= 9 ? "default" : n.score >= 7 ? "secondary" : "destructive"}>{n.score}</Badge></TableCell>
                  <TableCell className="text-sm">{n.respondent || "—"}</TableCell>
                  <TableCell className="text-sm">{n.comment || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ RELATÓRIOS ============ */
function Relatorios({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const genFn = useServerFn(generateAiReport);
  const q = useQuery({
    queryKey: ["reports", clientId],
    queryFn: async () => (await supabase.from("client_reports").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "mensal", period_start: "", period_end: "", url: "", notes: "" });
  async function submit() {
    if (!form.title.trim() || !user) return;
    const { error } = await supabase.from("client_reports").insert({ ...form, period_start: form.period_start || null, period_end: form.period_end || null, url: form.url || null, notes: form.notes || null, client_id: clientId, created_by: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ title: "", kind: "mensal", period_start: "", period_end: "", url: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["reports", clientId] });
  }

  const [aiOpen, setAiOpen] = useState(false);
  const [aiForm, setAiForm] = useState({
    kind: "mensal" as "semanal" | "mensal" | "total",
    period_start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    extra: "",
  });
  const [aiBusy, setAiBusy] = useState(false);
  async function genAi() {
    setAiBusy(true);
    try {
      await genFn({ data: { clientId, ...aiForm } });
      toast.success("Relatório gerado com IA");
      setAiOpen(false);
      qc.invalidateQueries({ queryKey: ["reports", clientId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar");
    } finally {
      setAiBusy(false);
    }
  }

  const [viewing, setViewing] = useState<any | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Relatórios</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Semanais, mensais e totais — gerados por IA (GPT-5.4-nano) com base nos dados de anúncios.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default"><Sparkles className="h-4 w-4" /> Gerar com IA</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Relatório com IA</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={aiForm.kind} onValueChange={(v: any) => setAiForm({ ...aiForm, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="total">Total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Início</Label><Input type="date" value={aiForm.period_start} onChange={(e) => setAiForm({ ...aiForm, period_start: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Fim</Label><Input type="date" value={aiForm.period_end} onChange={(e) => setAiForm({ ...aiForm, period_end: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Observações do gestor (opcional)</Label>
                  <Textarea rows={3} placeholder="Contexto extra: campanhas ativas, promoções, mudanças recentes…" value={aiForm.extra} onChange={(e) => setAiForm({ ...aiForm, extra: e.target.value })} />
                </div>
                <p className="text-xs text-muted-foreground">A IA usa dados sincronizados de Meta/Google Ads no período. Se não houver dados, ela vai avisar no relatório.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiBusy}>Cancelar</Button>
                <Button onClick={genAi} disabled={aiBusy}>
                  {aiBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Sparkles className="h-4 w-4" /> Gerar</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Manual</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo relatório</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="semanal">Semanal</SelectItem><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="total">Total</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>URL (Drive/PDF)</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
                <div className="space-y-2"><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem relatórios. Gere o primeiro com IA.</TableCell></TableRow>}
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{r.kind}</Badge>
                    {r.ai_content && <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> IA</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</TableCell>
                <TableCell className="text-right">
                  {r.ai_content ? (
                    <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>Ver</Button>
                  ) : r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-primary text-sm inline-flex items-center gap-1">Abrir <ExternalLink className="h-3 w-3" /></a>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {viewing && (
        <Dialog open onOpenChange={(v) => !v && setViewing(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> {viewing.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Gerado por {viewing.ai_model} · {fmtDate(viewing.ai_generated_at)}</p>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando…</div>}>
                <ReactMarkdown>{viewing.ai_content}</ReactMarkdown>
              </Suspense>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(viewing.ai_content); toast.success("Copiado"); }}>Copiar markdown</Button>
              <Button onClick={() => setViewing(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/* ============ REUNIÕES ============ */
function Reunioes({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["meetings", clientId],
    queryFn: async () => (await supabase.from("meetings").select("*").eq("client_id", clientId).order("held_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", held_at: new Date().toISOString().slice(0, 16), drive_url: "", recording_url: "", transcript: "", notes: "", attendees: "" });
  async function submit() {
    if (!form.title.trim() || !user) return;
    const { error } = await supabase.from("meetings").insert({ ...form, held_at: new Date(form.held_at).toISOString(), client_id: clientId, created_by: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); qc.invalidateQueries({ queryKey: ["meetings", clientId] });
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Reuniões</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Reunião</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data/hora</Label><Input type="datetime-local" value={form.held_at} onChange={(e) => setForm({ ...form, held_at: e.target.value })} /></div>
                <div className="space-y-2"><Label>Participantes</Label><Input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="Alean, Cliente…" /></div>
              </div>
              <div className="space-y-2"><Label>Link do Drive</Label><Input value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })} placeholder="https://drive.google.com/…" /></div>
              <div className="space-y-2"><Label>Link da gravação</Label><Input value={form.recording_url} onChange={(e) => setForm({ ...form, recording_url: e.target.value })} /></div>
              <div className="space-y-2"><Label>Transcrição</Label><Textarea rows={4} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} /></div>
              <div className="space-y-2"><Label>Notas / Ata</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem reuniões</p>}
        {(q.data ?? []).map((m: any) => (
          <div key={m.id} className="p-3 border rounded-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-medium text-sm">{m.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(m.held_at).toLocaleString("pt-BR")}</div>
            </div>
            {m.attendees && <div className="text-xs text-muted-foreground mt-1">{m.attendees}</div>}
            <div className="flex flex-wrap gap-2 mt-2">
              {m.drive_url && <a href={m.drive_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Drive <ExternalLink className="h-3 w-3" /></a>}
              {m.recording_url && <a href={m.recording_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Gravação <ExternalLink className="h-3 w-3" /></a>}
            </div>
            {m.notes && <div className="text-xs mt-2 whitespace-pre-wrap">{m.notes}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ============ ONBOARDING (com etapas) ============ */
function Onboarding({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const stages = useQuery({
    queryKey: ["cos", clientId],
    queryFn: async () => (await supabase.from("client_onboarding_stages").select("*").eq("client_id", clientId).order("position")).data ?? [],
  });
  const tasks = useQuery({
    queryKey: ["onboarding-full", clientId],
    queryFn: async () => (await supabase.from("onboarding_tasks").select("*").eq("client_id", clientId).order("position")).data ?? [],
  });
  const [newStage, setNewStage] = useState("");
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  async function addStage() {
    if (!newStage.trim()) return;
    const pos = (stages.data?.length ?? 0);
    await supabase.from("client_onboarding_stages").insert({ client_id: clientId, name: newStage.trim(), position: pos });
    setNewStage(""); qc.invalidateQueries({ queryKey: ["cos", clientId] });
  }
  async function addTask(stageId: string | null) {
    const key = stageId ?? "__none";
    const title = taskInputs[key]?.trim();
    if (!title) return;
    const pos = (tasks.data ?? []).filter((t: any) => t.stage_id === stageId).length;
    await supabase.from("onboarding_tasks").insert({ client_id: clientId, stage_id: stageId, title, position: pos });
    setTaskInputs({ ...taskInputs, [key]: "" });
    qc.invalidateQueries({ queryKey: ["onboarding-full", clientId] });
  }
  async function toggle(t: any, v: boolean) {
    await supabase.from("onboarding_tasks").update({ done: v, done_at: v ? new Date().toISOString() : null }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["onboarding-full", clientId] });
  }

  const grouped = useMemo(() => {
    const map = new Map<string | null, any[]>();
    (tasks.data ?? []).forEach((t: any) => {
      const k = t.stage_id ?? null;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return map;
  }, [tasks.data]);

  const stageList = stages.data ?? [];
  const totalTasks = (tasks.data ?? []).length;
  const doneTasks = (tasks.data ?? []).filter((t: any) => t.done).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Progresso</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">{doneTasks} de {totalTasks} concluídas</div>
          <Progress value={totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0} />
        </CardContent>
      </Card>

      {stageList.map((s: any) => (
        <Card key={s.id}>
          <CardHeader><CardTitle className="text-sm">{s.name}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(grouped.get(s.id) ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <Checkbox checked={t.done} onCheckedChange={(v) => toggle(t, !!v)} />
                <span className={t.done ? "line-through text-muted-foreground text-sm" : "text-sm"}>{t.title}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input placeholder="Nova tarefa" value={taskInputs[s.id] ?? ""} onChange={(e) => setTaskInputs({ ...taskInputs, [s.id]: e.target.value })} />
              <Button size="sm" variant="outline" onClick={() => addTask(s.id)}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {(grouped.get(null)?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Sem etapa</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(grouped.get(null) ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <Checkbox checked={t.done} onCheckedChange={(v) => toggle(t, !!v)} />
                <span className={t.done ? "line-through text-muted-foreground text-sm" : "text-sm"}>{t.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Nova etapa</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nome da etapa" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
          <Button onClick={addStage}><Plus className="h-4 w-4" /> Etapa</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ MOODBOARDS ============ */
function Moodboards({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["mb", clientId],
    queryFn: async () => (await supabase.from("moodboards").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ title: "", url: "", notes: "" });
  async function add() {
    if (!form.title.trim() || !user) return;
    const { error } = await supabase.from("moodboards").insert({ ...form, url: form.url || null, notes: form.notes || null, client_id: clientId, created_by: user.id });
    if (error) return toast.error(error.message);
    setForm({ title: "", url: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["mb", clientId] });
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Moodboards</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="URL (Figma, Pinterest…)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Button onClick={add}><Plus className="h-4 w-4" /> Adicionar</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">Sem moodboards.</div>}
          {(q.data ?? []).map((m: any) => (
            <div key={m.id} className="p-3 border rounded-md">
              <div className="font-medium text-sm">{m.title}</div>
              {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">Abrir <ExternalLink className="h-3 w-3" /></a>}
              {m.notes && <div className="text-xs text-muted-foreground mt-2">{m.notes}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ ACESSOS ============ */
function Acessos({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["access", clientId],
    queryFn: async () => (await supabase.from("client_access").select("*").eq("client_id", clientId).order("platform")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ platform: "", login_url: "", username: "", password: "", notes: "" });
  async function add() {
    if (!form.platform.trim() || !user) return;
    const { error } = await supabase.from("client_access").insert({ ...form, client_id: clientId, created_by: user.id });
    if (error) return toast.error(error.message);
    setOpen(false); setForm({ platform: "", login_url: "", username: "", password: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["access", clientId] });
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Acessos</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">Guarde credenciais das plataformas do cliente (Meta, Google, Shopify, Analytics…).</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Acesso</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo acesso</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Plataforma</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Meta Ads, Google Ads, Shopify…" /></div>
              <div className="space-y-2"><Label>URL de login</Label><Input value={form.login_url} onChange={(e) => setForm({ ...form, login_url: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Usuário</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
                <div className="space-y-2"><Label>Senha</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Notas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Plataforma</TableHead><TableHead>Usuário</TableHead><TableHead>Senha</TableHead><TableHead>URL</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem acessos</TableCell></TableRow>}
            {(q.data ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.platform}</TableCell>
                <TableCell className="text-sm">{a.username || "—"}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-1">
                    <span>{reveal[a.id] ? a.password : (a.password ? "•".repeat(8) : "—")}</span>
                    {a.password && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReveal({ ...reveal, [a.id]: !reveal[a.id] })}>
                        {reveal[a.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>{a.login_url ? <a href={a.login_url} target="_blank" rel="noreferrer" className="text-primary text-sm inline-flex items-center gap-1">Abrir <ExternalLink className="h-3 w-3" /></a> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============ AUDITORIA ============ */
function Auditoria({ clientId }: { clientId: string }) {
  const q = useQuery({
    queryKey: ["activities", clientId],
    queryFn: async () => {
      const { data: acts } = await supabase
        .from("client_activities")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = acts ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean))) as string[];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        names = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return rows.map((r: any) => ({ ...r, _author: names[r.user_id] || "—" }));
    },
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Auditoria completa</CardTitle><div className="text-xs text-muted-foreground mt-1">Tudo que é feito no cliente: quem, o quê, quando.</div></CardHeader>
      <CardContent className="space-y-2">
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
        {(q.data ?? []).map((a: any) => (
          <div key={a.id} className="border-l-2 border-primary/40 pl-3 py-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{a.action}</span>
              {a.entity_type && <Badge variant="outline" className="text-[10px]">{a.entity_type}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{a._author} · {new Date(a.created_at).toLocaleString("pt-BR")}</div>
            {a.description && <div className="text-xs mt-0.5">{a.description}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

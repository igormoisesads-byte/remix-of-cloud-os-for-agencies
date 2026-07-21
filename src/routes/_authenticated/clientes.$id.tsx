import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  Eye, EyeOff, ExternalLink, RefreshCw, Trash2, Facebook,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncAdAccount } from "@/lib/ads.functions";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetail,
});

const TYPE_LABEL: Record<string, string> = { local: "Local", perpetuo: "Perpétuo", lancamento: "Lançamento", autoria: "Autoria" };

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "—";
}

type Section =
  | "visao" | "performance" | "projecoes" | "seo" | "rotinas" | "health"
  | "pdas" | "nps" | "relatorios" | "reunioes" | "onboarding" | "moodboards"
  | "acesso" | "auditoria";

const NAV: { key: Section; label: string; icon: any }[] = [
  { key: "visao", label: "Visão Geral", icon: LayoutGrid },
  { key: "performance", label: "Performance", icon: BarChart3 },
  { key: "projecoes", label: "Projeções", icon: LineChart },
  { key: "seo", label: "SEO", icon: Search },
  { key: "rotinas", label: "Rotinas", icon: Repeat },
  { key: "health", label: "Health Score", icon: HeartPulse },
  { key: "pdas", label: "PDAs", icon: AlertTriangle },
  { key: "nps", label: "NPS", icon: Star },
  { key: "relatorios", label: "Relatórios", icon: FileText },
  { key: "reunioes", label: "Reuniões", icon: Video },
  { key: "onboarding", label: "Onboarding", icon: ListChecks },
  { key: "moodboards", label: "Moodboards", icon: ImageIcon },
  { key: "acesso", label: "Acesso", icon: Key },
  { key: "auditoria", label: "Auditoria", icon: ClipboardList },
];

function ClienteDetail() {
  const { id } = Route.useParams();
  const [section, setSection] = useState<Section>("visao");

  const client = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, niches(name), perf:profiles!clients_performance_user_id_fkey(full_name), cs:profiles!clients_cs_user_id_fkey(full_name)")
        .eq("id", id).single();
      if (error) throw error; return data as any;
    },
  });

  if (client.isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!client.data) return <div className="p-8">Cliente não encontrado</div>;
  const c = client.data;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Header top bar */}
      <div className="w-56 shrink-0 border-r bg-card overflow-y-auto">
        <div className="p-3 border-b">
          <Link to="/clientes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
              {c.name?.slice(0, 1)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate text-sm">{c.name}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{TYPE_LABEL[c.type]}</div>
            </div>
          </div>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = section === n.key;
            return (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" /> {n.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b px-6 py-3 flex flex-wrap items-center gap-2 bg-card/40">
          <h1 className="text-xl font-bold tracking-tight">{c.name}</h1>
          <Badge variant="outline">{TYPE_LABEL[c.type]}</Badge>
          <Badge>{c.status}</Badge>
          {c.niches?.name && <Badge variant="secondary">{c.niches.name}</Badge>}
          <div className="ml-auto text-xs text-muted-foreground">
            {[c.site, c.city_uf].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div className="p-6">
          {section === "visao" && <VisaoGeral c={c} />}
          {section === "performance" && <Performance />}
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

  return (
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
        </CardContent>
      </Card>
      <StatCard title="Health Score" icon={HeartPulse} value={healthQ.data ? `${healthQ.data.score}%` : "Sem registros"} sub={healthQ.data ? `atualizado ${fmtDate(healthQ.data.recorded_at)}` : ""} />
      <StatCard title="PDAs" icon={AlertTriangle} value={`${pdasQ.data ?? 0} pendentes`} />
      <StatCard title="NPS" icon={Star} value={npsQ.data ? String(npsQ.data.score) : "Sem registros"} sub={npsQ.data ? fmtDate(npsQ.data.created_at) : ""} />
      <StatCard title="Onboarding" icon={ListChecks} value={totalCount ? `${doneCount}/${totalCount}` : "Não iniciado"} sub={totalCount ? `${Math.round((doneCount / totalCount) * 100)}% concluído` : ""} />
    </div>
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

/* ============ PERFORMANCE (placeholder integração) ============ */
function Performance() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Performance de mídia</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md border border-dashed p-6 text-center">
          <BarChart3 className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <div className="font-medium">Integração Meta Ads e Google Ads</div>
          <div className="text-muted-foreground mt-1">Conecte as APIs para puxar gastos e resultados em tempo real. Configuração em Ajustes → Integrações (em breve).</div>
        </div>
      </CardContent>
    </Card>
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Relatórios</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Relatório</Button></DialogTrigger>
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
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead>Período</TableHead><TableHead>Link</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem relatórios</TableCell></TableRow>}
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell><Badge variant="outline">{r.kind}</Badge></TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</TableCell>
                <TableCell>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-primary text-sm inline-flex items-center gap-1">Abrir <ExternalLink className="h-3 w-3" /></a> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
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
            <div className="flex items-center justify-between">
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
    queryFn: async () => (await supabase.from("client_activities").select("*, profiles(full_name)").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200)).data ?? [],
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
            <div className="text-xs text-muted-foreground">{a.profiles?.full_name || "—"} · {new Date(a.created_at).toLocaleString("pt-BR")}</div>
            {a.description && <div className="text-xs mt-0.5">{a.description}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

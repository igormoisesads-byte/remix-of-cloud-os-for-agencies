import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, MessageSquare, Filter, Paperclip, Calendar as CalendarIcon, User, Tag,
  AlignLeft, Building2, X, FileText, Image as ImageIcon, Download, CheckSquare,
  LayoutGrid, CalendarDays, Layers, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacoes")({
  component: OperacoesPage,
});

const COLUMNS: { key: "todo" | "doing" | "review" | "done"; label: string; accent: string }[] = [
  { key: "todo", label: "A fazer", accent: "bg-slate-400" },
  { key: "doing", label: "Em andamento", accent: "bg-blue-500" },
  { key: "review", label: "Revisão", accent: "bg-amber-500" },
  { key: "done", label: "Concluído", accent: "bg-emerald-500" },
];

const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const KIND_LABEL: Record<string, string> = { kickoff: "Kickoff", rotina: "Rotina", demanda: "Demanda", auditoria: "Auditoria" };

type ViewMode = "kanban" | "calendar";

// ---------- Helpers de semana / rotina ----------
function ymd(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Janela visível de rotinas: Segunda→Sábado da semana atual. Se hoje for Domingo, mostra a próxima semana.
function currentRoutineWeek(today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = t.getDay(); // 0=Dom..6=Sáb
  const isSunday = dow === 0;
  const daysSinceMonday = isSunday ? -1 : dow - 1; // Dom => começa amanhã (segunda)
  const monday = new Date(t); monday.setDate(t.getDate() - daysSinceMonday);
  const saturday = new Date(monday); saturday.setDate(monday.getDate() + 5);
  return { start: ymd(monday), end: ymd(saturday) };
}
const OPT_RE = /^Otimização\s+(FULL|LIGHT)\s+·\s+(.+)$/i;
function parseRoutine(title: string): { variant: "FULL" | "LIGHT"; client: string } | null {
  const m = title?.match(OPT_RE);
  if (!m) return null;
  return { variant: m[1].toUpperCase() as "FULL" | "LIGHT", client: m[2].trim() };
}

function OperacoesPage() {
  const qc = useQueryClient();
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<{ label: string; items: any[] } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("kanban");

  const week = useMemo(() => currentRoutineWeek(), []);

  const tasks = useQuery({
    queryKey: ["tasks", filterClient, filterAssignee],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, clients(name)").order("position");
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterAssignee !== "all") q = q.eq("assignee_id", filterAssignee);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const clients = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const team = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data ?? [],
  });

  // Tarefas visíveis (aplica janela semanal em rotinas de otimização)
  const visibleTasks = useMemo(() => {
    const nameMap = new Map<string, string>((team.data ?? []).map((p: any) => [p.id, p.full_name]));
    return (tasks.data ?? [])
      .filter((t: any) => {
        if (t.kind !== "rotina") return true;
        const r = parseRoutine(t.title || "");
        if (!r) return true;
        if (!t.due_date) return false;
        return t.due_date >= week.start && t.due_date <= week.end;
      })
      .map((t: any) => ({ ...t, assignee: t.assignee_id ? { full_name: nameMap.get(t.assignee_id) ?? "—" } : null }));
  }, [tasks.data, team.data, week.start, week.end]);

  // Agrupa rotinas (mesma data + variante FULL/LIGHT + mesmo status) num único card com subtarefas por cliente
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { todo: [], doing: [], review: [], done: [] };
    const routineBuckets = new Map<string, any>();
    for (const t of visibleTasks) {
      const r = t.kind === "rotina" ? parseRoutine(t.title || "") : null;
      if (r && t.due_date) {
        const key = `${t.status}|${t.due_date}|${r.variant}`;
        let bucket = routineBuckets.get(key);
        if (!bucket) {
          bucket = {
            __group: true,
            id: `group-${key}`,
            key,
            variant: r.variant,
            due_date: t.due_date,
            status: t.status,
            kind: "rotina",
            priority: t.priority,
            items: [] as any[],
          };
          routineBuckets.set(key, bucket);
          g[t.status]?.push(bucket);
        }
        bucket.items.push({ ...t, client_name: t.clients?.name ?? r.client });
      } else {
        g[t.status]?.push(t);
      }
    }
    return g;
  }, [visibleTasks]);

  async function moveTo(taskId: string, status: string) {
    const { error } = await supabase.from("tasks").update({ status: status as any }).eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }
  async function moveGroup(items: any[], status: string) {
    const ids = items.map((i) => i.id);
    const { error } = await supabase.from("tasks").update({ status: status as any }).in("id", ids);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden p-4 sm:p-6 lg:p-8 gap-4 sm:gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operações</h1>
          <p className="text-muted-foreground mt-1">
            {view === "kanban"
              ? "Kanban de demandas, kickoffs e rotinas. Arraste os cards entre colunas."
              : "Calendário de tarefas por data de entrega."}
            {" "}Rotinas: <b>{new Date(week.start + "T00:00").toLocaleDateString("pt-BR")} – {new Date(week.end + "T00:00").toLocaleDateString("pt-BR")}</b>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </Button>
            <Button size="sm" variant={view === "calendar" ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setView("calendar")}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendário
            </Button>
          </div>
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clients.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda equipe</SelectItem>
              {(team.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <NewTaskDialog clients={clients.data ?? []} team={team.data ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["tasks"] })} />
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex-1 min-h-0 flex gap-4 overflow-x-auto pb-3 -mx-2 px-2">
          {COLUMNS.map(col => (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver((d) => (d === col.key ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/task-id");
                const groupKey = e.dataTransfer.getData("text/group-key");
                if (id) return moveTo(id, col.key);
                if (groupKey) {
                  const bucket = (grouped[col.key === "todo" ? "doing" : "todo"] || [])
                    .concat(grouped.todo, grouped.doing, grouped.review, grouped.done)
                    .find((x: any) => x.__group && x.key === groupKey);
                  if (bucket) moveGroup(bucket.items, col.key);
                }
              }}
              className={cn(
                "shrink-0 w-[85vw] sm:w-[320px] rounded-xl bg-muted/40 border flex flex-col h-full transition-colors",
                dragOver === col.key && "bg-primary/10 border-primary"
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.accent)} />
                  <div className="text-sm font-semibold">{col.label}</div>
                </div>
                <Badge variant="secondary" className="rounded-full">{grouped[col.key].length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-2">
                {grouped[col.key].length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">Solte cards aqui.</div>
                )}
                {grouped[col.key].map((t: any) => (
                  t.__group ? (
                    <RoutineGroupCard key={t.id} group={t} onOpen={() => setOpenGroup({
                      label: `Otimização ${t.variant} · ${new Date(t.due_date + "T00:00").toLocaleDateString("pt-BR")}`,
                      items: t.items,
                    })} />
                  ) : (
                    <TaskCard key={t.id} task={t} onOpen={() => setOpenTask(t.id)} />
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CalendarView tasks={visibleTasks} onOpen={(id) => setOpenTask(id)} />
      )}

      {openTask && (
        <TaskDetail
          taskId={openTask}
          clients={clients.data ?? []}
          team={team.data ?? []}
          onClose={() => setOpenTask(null)}
          onChange={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
        />
      )}

      {openGroup && (
        <Dialog open onOpenChange={(o) => !o && setOpenGroup(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{openGroup.label}</DialogTitle></DialogHeader>
            <div className="text-xs text-muted-foreground -mt-2">{openGroup.items.length} clientes nesta rotina</div>
            <div className="max-h-[60vh] overflow-y-auto divide-y">
              {openGroup.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => { setOpenGroup(null); setOpenTask(it.id); }}
                  className="w-full text-left flex items-center gap-3 py-2.5 px-1 hover:bg-muted/50 rounded-md"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={it.status === "done"}
                    onChange={async (e) => {
                      e.stopPropagation();
                      await supabase.from("tasks").update({ status: e.target.checked ? "done" : "todo" }).eq("id", it.id);
                      qc.invalidateQueries({ queryKey: ["tasks"] });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className={cn("flex-1 text-sm", it.status === "done" && "line-through text-muted-foreground")}>
                    {it.client_name}
                  </span>
                  {it.assignee?.full_name && (
                    <span className="text-[10px] h-5 w-5 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center" title={it.assignee.full_name}>
                      {initials(it.assignee.full_name)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RoutineGroupCard({ group, onOpen }: { group: any; onOpen: () => void }) {
  const overdue = group.due_date && group.status !== "done" && group.due_date < new Date().toISOString().slice(0, 10);
  const preview = group.items.slice(0, 3).map((i: any) => i.client_name);
  const more = group.items.length - preview.length;
  return (
    <Card
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/group-key", group.key); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onOpen}
      className="cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all border-l-4"
      style={{ borderLeftColor: group.variant === "FULL" ? "hsl(217 91% 60%)" : "hsl(38 92% 50%)" }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-snug inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            Otimização {group.variant}
          </div>
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{group.items.length} clientes</Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {preview.map((n: string) => (
            <span key={n} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{n}</span>
          ))}
          {more > 0 && <span className="text-[10px] text-muted-foreground">+{more}</span>}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className={cn("text-[11px] inline-flex items-center gap-1", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            <CalendarIcon className="h-3 w-3" />
            {new Date(group.due_date + "T00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarView({ tasks, onOpen }: { tasks: any[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (!m.has(t.due_date)) m.set(t.due_date, []);
      m.get(t.due_date)!.push(t);
    }
    return m;
  }, [tasks]);

  const todayStr = ymd(new Date());

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-xl border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="text-sm font-semibold capitalize">
          {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hoje</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="px-2 py-2 text-center">{d}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
        {cells.map((d, i) => {
          const key = d ? ymd(d) : `e-${i}`;
          const items = d ? (byDay.get(ymd(d)) ?? []) : [];
          const isToday = d && ymd(d) === todayStr;
          return (
            <div key={key} className={cn("border-r border-b p-1.5 min-h-[110px] flex flex-col gap-1", !d && "bg-muted/20")}>
              {d && (
                <div className={cn("text-[11px] font-semibold self-end", isToday && "bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center")}>
                  {d.getDate()}
                </div>
              )}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {items.slice(0, 4).map((t: any) => {
                  const r = t.kind === "rotina" ? parseRoutine(t.title || "") : null;
                  const color = r?.variant === "FULL" ? "bg-blue-500/15 text-blue-700 border-blue-500/30"
                    : r?.variant === "LIGHT" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                    : t.priority === "urgente" ? "bg-red-500/15 text-red-700 border-red-500/30"
                    : "bg-primary/10 text-primary border-primary/20";
                  return (
                    <button
                      key={t.id}
                      onClick={() => onOpen(t.id)}
                      className={cn("text-[10.5px] leading-tight text-left px-1.5 py-1 rounded border truncate", color)}
                      title={t.title}
                    >
                      {r ? `${r.variant} · ${t.clients?.name ?? r.client}` : t.title}
                    </button>
                  );
                })}
                {items.length > 4 && <div className="text-[10px] text-muted-foreground px-1.5">+{items.length - 4} mais</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen }: { task: any; onOpen: () => void }) {
  const overdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);
  return (
    <Card
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/task-id", task.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onOpen}
      className="cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-snug">{task.title}</div>
          <PriorityBadge p={task.priority} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">{KIND_LABEL[task.kind]}</Badge>
          {task.clients?.name && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{task.clients.name}</span>}
        </div>
        <div className="flex items-center justify-between pt-1">
          {task.due_date ? (
            <div className={cn("text-[11px] inline-flex items-center gap-1", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
              <CalendarIcon className="h-3 w-3" />
              {new Date(task.due_date + "T00:00").toLocaleDateString("pt-BR")}
            </div>
          ) : <span />}
          {task.assignee?.full_name && (
            <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center" title={task.assignee.full_name}>
              {initials(task.assignee.full_name)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const v = p === "urgente" ? "destructive" : p === "alta" ? "default" : "secondary";
  return <Badge variant={v as any} className="text-[10px] py-0 px-1.5">{PRIORITY_LABEL[p]}</Badge>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");
}

function NewTaskDialog({ clients, team, onDone }: { clients: any[]; team: any[]; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    title: "", description: "", priority: "media", kind: "demanda",
    client_id: "", assignee_id: "", due_date: "",
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Nova tarefa</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={form.client_id || "none"} onValueChange={v => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.assignee_id || "none"} onValueChange={v => setForm({ ...form, assignee_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {team.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2"><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!form.title.trim()) return toast.error("Título obrigatório");
            const payload = {
              title: form.title.trim(),
              description: form.description || null,
              priority: form.priority,
              kind: form.kind,
              client_id: form.client_id || null,
              assignee_id: form.assignee_id || null,
              due_date: form.due_date || null,
              created_by: user?.id ?? null,
            };
            const { error } = await supabase.from("tasks").insert(payload);
            if (error) return toast.error(error.message);
            toast.success("Tarefa criada");
            setForm({ title: "", description: "", priority: "media", kind: "demanda", client_id: "", assignee_id: "", due_date: "" });
            setOpen(false); onDone();
          }}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetail({ taskId, clients, team, onClose, onChange }: { taskId: string; clients: any[]; team: any[]; onClose: () => void; onChange: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
  });
  const comments = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => (await supabase.from("task_comments").select("*, profiles(full_name)").eq("task_id", taskId).order("created_at")).data ?? [],
  });
  const checklist = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => (await supabase.from("task_checklist_items").select("*").eq("task_id", taskId).order("position")).data ?? [],
  });
  const [newChkTitle, setNewChkTitle] = useState("");
  async function addChk() {
    const title = newChkTitle.trim();
    if (!title) return;
    const pos = (checklist.data ?? []).length;
    const { error } = await supabase.from("task_checklist_items").insert({ task_id: taskId, title, position: pos });
    if (error) return toast.error(error.message);
    setNewChkTitle("");
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  }
  async function toggleChk(id: string, done: boolean) {
    await supabase.from("task_checklist_items").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  }
  async function delChk(id: string) {
    await supabase.from("task_checklist_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  }

  const t = task.data;
  async function patch(fields: any) {
    const { error } = await supabase.from("tasks").update(fields).eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    onChange();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    const path = `tasks/${taskId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    setPendingFile({ url: pub.publicUrl, name: file.name, type: file.type });
    setUploading(false);
  }

  async function sendComment() {
    if ((!comment.trim() && !pendingFile) || !user) return;
    const payload: any = {
      task_id: taskId,
      author_id: user.id,
      body: comment.trim() || (pendingFile ? "" : ""),
    };
    if (pendingFile) {
      payload.attachment_url = pendingFile.url;
      payload.attachment_name = pendingFile.name;
      payload.attachment_type = pendingFile.type;
    }
    const { error } = await supabase.from("task_comments").insert(payload);
    if (error) return toast.error(error.message);
    setComment(""); setPendingFile(null);
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  }

  const clientName = clients.find(c => c.id === t?.client_id)?.name;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0">
        {!t ? <div className="p-8 text-muted-foreground">Carregando…</div> : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] max-h-[90vh]">
            {/* MAIN */}
            <div className="overflow-y-auto p-6 space-y-6 border-r">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  {KIND_LABEL[t.kind]} · {COLUMNS.find(c => c.key === t.status)?.label}
                </div>
                <Input
                  className="text-2xl font-bold border-none px-0 h-auto focus-visible:ring-0 shadow-none"
                  defaultValue={t.title}
                  onBlur={e => e.target.value.trim() && e.target.value !== t.title && patch({ title: e.target.value.trim() })}
                />
                {clientName && (
                  <div className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> {clientName}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlignLeft className="h-4 w-4" /> Descrição
                </div>
                {editingDesc ? (
                  <div className="space-y-2">
                    <Textarea rows={6} value={descDraft} onChange={e => setDescDraft(e.target.value)} autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => { await patch({ description: descDraft || null }); setEditingDesc(false); }}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setDescDraft(t.description ?? ""); setEditingDesc(true); }}
                    className="w-full text-left text-sm rounded-md bg-muted/50 hover:bg-muted p-4 min-h-[100px] whitespace-pre-wrap"
                  >
                    {t.description || <span className="text-muted-foreground">Adicionar uma descrição mais detalhada…</span>}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CheckSquare className="h-4 w-4" /> Checklist
                    {(checklist.data ?? []).length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {(checklist.data ?? []).filter((c: any) => c.done).length}/{(checklist.data ?? []).length}
                      </span>
                    )}
                  </div>
                </div>
                {(checklist.data ?? []).length > 0 && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${
                          ((checklist.data ?? []).filter((c: any) => c.done).length /
                            Math.max(1, (checklist.data ?? []).length)) * 100
                        }%`,
                      }}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  {(checklist.data ?? []).map((it: any) => (
                    <div key={it.id} className="group flex items-center gap-2 text-sm rounded-md hover:bg-muted/50 px-2 py-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary cursor-pointer"
                        checked={!!it.done}
                        onChange={(e) => toggleChk(it.id, e.target.checked)}
                      />
                      <span className={cn("flex-1", it.done && "line-through text-muted-foreground")}>{it.title}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => delChk(it.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar item de checklist…"
                    value={newChkTitle}
                    onChange={(e) => setNewChkTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChk()}
                    className="h-8"
                  />
                  <Button size="sm" variant="outline" onClick={addChk}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" /> Atividade
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {initials(user?.email ?? "?")}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Escreva um comentário…"
                      rows={2}
                      className="resize-none"
                    />
                    {pendingFile && (
                      <div className="flex items-center gap-2 text-xs bg-muted rounded-md px-2 py-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="truncate flex-1">{pendingFile.name}</span>
                        <button onClick={() => setPendingFile(null)}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={sendComment} disabled={uploading || (!comment.trim() && !pendingFile)}>Enviar</Button>
                      <input ref={fileInput} type="file" hidden onChange={handleFileSelect} />
                      <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()} disabled={uploading}>
                        <Paperclip className="h-4 w-4" /> {uploading ? "Enviando…" : "Anexar"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {(comments.data ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground pl-11">Nenhuma atividade ainda.</div>
                  )}
                  {(comments.data ?? []).map((c: any) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                        {initials(c.profiles?.full_name ?? "?")}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs">
                          <span className="font-semibold">{c.profiles?.full_name ?? "—"}</span>
                          <span className="text-muted-foreground"> · {new Date(c.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        {c.body && <div className="text-sm bg-muted/50 rounded-md px-3 py-2 whitespace-pre-wrap">{c.body}</div>}
                        {c.attachment_url && <AttachmentPreview url={c.attachment_url} name={c.attachment_name} type={c.attachment_type} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SIDEBAR */}
            <div className="overflow-y-auto p-4 space-y-4 bg-muted/20">
              <SideField icon={<Tag className="h-3.5 w-3.5" />} label="Status">
                <Select value={t.status} onValueChange={v => patch({ status: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </SideField>
              <SideField icon={<Tag className="h-3.5 w-3.5" />} label="Prioridade">
                <Select value={t.priority} onValueChange={v => patch({ priority: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </SideField>
              <SideField icon={<Tag className="h-3.5 w-3.5" />} label="Tipo">
                <Select value={t.kind} onValueChange={v => patch({ kind: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </SideField>
              <SideField icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Prazo">
                <Input type="date" className="h-8" defaultValue={t.due_date ?? ""} onBlur={e => patch({ due_date: e.target.value || null })} />
              </SideField>
              <SideField icon={<Building2 className="h-3.5 w-3.5" />} label="Cliente">
                <Select value={t.client_id ?? "none"} onValueChange={v => patch({ client_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </SideField>
              <SideField icon={<User className="h-3.5 w-3.5" />} label="Responsável">
                <Select value={t.assignee_id ?? "none"} onValueChange={v => patch({ assignee_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {team.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </SideField>

              <div className="pt-4 border-t">
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={async () => {
                  if (!confirm("Excluir esta tarefa?")) return;
                  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
                  if (error) return toast.error(error.message);
                  toast.success("Tarefa excluída");
                  onClose(); onChange();
                }}>
                  <Trash2 className="h-4 w-4" /> Excluir tarefa
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SideField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function AttachmentPreview({ url, name, type }: { url: string; name?: string | null; type?: string | null }) {
  const isImage = type?.startsWith("image/");
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block max-w-xs">
        <img src={url} alt={name ?? ""} className="rounded-md border max-h-56 object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm bg-muted/50 hover:bg-muted rounded-md px-3 py-2 max-w-xs">
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{name ?? "Anexo"}</span>
      <Download className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

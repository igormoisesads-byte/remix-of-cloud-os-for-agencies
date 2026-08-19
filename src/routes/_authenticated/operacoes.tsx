import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  LayoutGrid, CalendarDays, Layers, ChevronLeft, ChevronRight, BarChart3, Clock,
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

type ViewMode = "kanban" | "calendar" | "productivity";

const getInitials = (name?: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?";

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
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>(isAdmin ? "all" : (user?.id || "all"));
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<{ label: string; items: any[] } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("kanban");

  const week = useMemo(() => currentRoutineWeek(), []);

  const tasks = useQuery({
    queryKey: ["tasks", filterClient, filterAssignee, filterKind, filterTag],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, clients(name, logo_url)").order("position");
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterAssignee !== "all") q = q.eq("assignee_id", filterAssignee);
      if (filterKind !== "all") q = q.eq("kind", filterKind as any);
      if (filterTag !== "all") q = q.contains("tags", [filterTag]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const allTags = useQuery({
    queryKey: ["task-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("tags");
      const s = new Set<string>();
      (data ?? []).forEach((r: any) => (r.tags ?? []).forEach((t: string) => t && s.add(t)));
      return Array.from(s).sort();
    },
  });

  const clients = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });
  const team = useQuery({
    queryKey: ["team-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, avatar_url").order("full_name")).data ?? [],
  });

  // Contadores de subtarefas / comentários / anexos por tarefa
  const taskMeta = useQuery({
    queryKey: ["tasks-meta"],
    queryFn: async () => {
      const [chk, cmt] = await Promise.all([
        supabase.from("task_checklist_items").select("task_id, done"),
        supabase.from("task_comments").select("task_id, attachment_url"),
      ]);
      const m: Record<string, { chk: number; chkDone: number; comments: number; files: number }> = {};
      const get = (id: string) => (m[id] ??= { chk: 0, chkDone: 0, comments: 0, files: 0 });
      (chk.data ?? []).forEach((r: any) => { const e = get(r.task_id); e.chk++; if (r.done) e.chkDone++; });
      (cmt.data ?? []).forEach((r: any) => { const e = get(r.task_id); e.comments++; if (r.attachment_url) e.files++; });
      return m;
    },
  });

  // Tarefas visíveis (aplica janela semanal em rotinas de otimização)
  const visibleTasks = useMemo(() => {
    const profMap = new Map<string, any>((team.data ?? []).map((p: any) => [p.id, p]));
    const meta = taskMeta.data ?? {};
    return (tasks.data ?? [])
      .filter((t: any) => {
        if (t.kind !== "rotina") return true;
        const r = parseRoutine(t.title || "");
        if (!r) return true;
        if (!t.due_date) return false;
        return t.due_date >= week.start && t.due_date <= week.end;
      })
      .map((t: any) => ({
        ...t,
        assignee: t.assignee_id
          ? { full_name: profMap.get(t.assignee_id)?.full_name ?? "—", avatar_url: profMap.get(t.assignee_id)?.avatar_url ?? null }
          : null,
        meta: meta[t.id] ?? { chk: 0, chkDone: 0, comments: 0, files: 0 },
      }));
  }, [tasks.data, team.data, taskMeta.data, week.start, week.end]);

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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden p-4 sm:p-6 lg:p-8 gap-4 sm:gap-6 touch-none">
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">Operações</h1>
            <p className="hidden sm:block text-muted-foreground mt-1 text-sm">
              {view === "kanban"
                ? "Kanban de demandas, kickoffs e rotinas. Arraste os cards entre colunas."
                : view === "calendar"
                ? "Calendário de tarefas por data de entrega."
                : "Análise de produtividade e tempo de execução por membro da equipe."}
              {" "}Rotinas: <b>{new Date(week.start + "T00:00").toLocaleDateString("pt-BR")} – {new Date(week.end + "T00:00").toLocaleDateString("pt-BR")}</b>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="h-8 px-2 sm:gap-1.5" onClick={() => setView("kanban")} aria-label="Kanban">
                <LayoutGrid className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button size="sm" variant={view === "calendar" ? "default" : "ghost"} className="h-8 px-2 sm:gap-1.5" onClick={() => setView("calendar")} aria-label="Calendário">
                <CalendarDays className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Calendário</span>
              </Button>
              {isAdmin && (
                <Button size="sm" variant={view === "productivity" ? "default" : "ghost"} className="h-8 px-2 sm:gap-1.5" onClick={() => setView("productivity")} aria-label="Produtividade">
                  <BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Produtividade</span>
                </Button>
              )}
            </div>
            <NewTaskDialog clients={clients.data ?? []} team={team.data ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["tasks"] })} />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[140px] sm:w-[160px] h-9 shrink-0"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clients.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[130px] sm:w-[160px] h-9 shrink-0"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda equipe</SelectItem>
              {isAdmin ? (
                (team.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)
              ) : (
                <SelectItem value={user?.id || "none"}>Minhas tarefas</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={filterKind} onValueChange={setFilterKind}>
            <SelectTrigger className="w-[120px] sm:w-[140px] h-9 shrink-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[120px] sm:w-[140px] h-9 shrink-0"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {(allTags.data ?? []).length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma tag ainda</div>
              )}
              {(allTags.data ?? []).map((t: string) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
            </SelectContent>
          </Select>
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
      ) : view === "calendar" ? (
        <CalendarView tasks={visibleTasks} onOpen={(id) => setOpenTask(id)} />
      ) : (
        <ProductivityView team={team.data ?? []} tasks={visibleTasks} onOpenTask={setOpenTask} />
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
            <div key={key} className={cn("border-r border-b p-1.5 min-h-[110px] min-w-0 flex flex-col gap-1 overflow-hidden", !d && "bg-muted/20")}>
              {d && (
                <div className="flex justify-end">
                  <span className={cn(
                    "text-[11px] font-semibold shrink-0 leading-none",
                    isToday && "bg-primary text-primary-foreground rounded-full h-5 min-w-[1.25rem] px-1 flex items-center justify-center"
                  )}>
                    {d.getDate()}
                  </span>
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

/* ============ PRODUCTIVITY VIEW ============ */
function ProductivityView({ team, tasks, onOpenTask }: { team: any[]; tasks: any[]; onOpenTask: (id: string) => void }) {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  // Fetch history for all tasks in the current filter
  const history = useQuery({
    queryKey: ["tasks-productivity-history", tasks.map(t => t.id).sort()],
    queryFn: async () => {
      if (tasks.length === 0) return [];
      const { data, error } = await supabase
        .from("task_status_history")
        .select("*")
        .in("task_id", tasks.map(t => t.id))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: tasks.length > 0,
  });

  const stats = useMemo(() => {
    const userStats = new Map<string, {
      id: string;
      name: string;
      avatar: string | null;
      completed: number;
      leadTimes: number[];
      execTimes: number[];
    }>();

    team.forEach(p => {
      userStats.set(p.id, {
        id: p.id,
        name: p.full_name,
        avatar: p.avatar_url,
        completed: 0,
        leadTimes: [],
        execTimes: [],
      });
    });

    const now = new Date();
    const filteredTasks = tasks.filter(t => {
      if (period === "all") return true;
      const days = period === "7d" ? 7 : 30;
      const date = t.done_at || t.created_at;
      return (now.getTime() - new Date(date).getTime()) <= (days * 24 * 60 * 60 * 1000);
    });

    const histData = history.data ?? [];
    const histByTask = new Map<string, any[]>();
    histData.forEach(h => {
      if (!histByTask.has(h.task_id)) histByTask.set(h.task_id, []);
      histByTask.get(h.task_id)!.push(h);
    });

    filteredTasks.forEach(t => {
      if (!t.assignee_id) return;
      const s = userStats.get(t.assignee_id);
      if (!s) return;

      const tHist = histByTask.get(t.id) || [];
      const created = new Date(t.created_at).getTime();
      const doingTransition = tHist.find(h => h.to_status === "doing");
      const doneTransition = tHist.find(h => h.to_status === "done");

      if (doingTransition) {
        const doingTime = new Date(doingTransition.created_at).getTime();
        s.leadTimes.push(doingTime - created);
      }

      if (doingTransition && doneTransition) {
        const doingTime = new Date(doingTransition.created_at).getTime();
        const doneTime = new Date(doneTransition.created_at).getTime();
        s.execTimes.push(doneTime - doingTime);
      } else if (t.status === "done" && t.done_at && doingTransition) {
        // Fallback for missing 'done' transition but having 'done_at'
        const doingTime = new Date(doingTransition.created_at).getTime();
        const doneTime = new Date(t.done_at).getTime();
        s.execTimes.push(doneTime - doingTime);
      }

      if (t.status === "done") {
        s.completed++;
      }
    });

    return Array.from(userStats.values()).sort((a, b) => b.completed - a.completed);
  }, [team, tasks, history.data, period]);

  const fmtDuration = (ms: number) => {
    if (!ms) return "—";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(ms / (1000 * 60));
    return `${mins}m`;
  };

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-y-auto pr-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={period === "7d" ? "default" : "outline"}
            onClick={() => setPeriod("7d")}
          >Últimos 7 dias</Button>
          <Button
            size="sm"
            variant={period === "30d" ? "default" : "outline"}
            onClick={() => setPeriod("30d")}
          >Últimos 30 dias</Button>
          <Button
            size="sm"
            variant={period === "all" ? "default" : "outline"}
            onClick={() => setPeriod("all")}
          >Tudo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Desempenho por Membro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead className="text-center">Concluídas</TableHead>
                  <TableHead className="text-right">Lead Time (Médio)</TableHead>
                  <TableHead className="text-right">Execução (Média)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.avatar ? (
                          <img src={s.avatar} alt={s.name} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                            {getInitials(s.name)}
                          </div>
                        )}
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{s.completed}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtDuration(avg(s.leadTimes))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtDuration(avg(s.execTimes))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Métricas Globais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Concluídas</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {stats.reduce((acc, s) => acc + s.completed, 0)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg Lead Time</div>
                <div className="text-2xl font-bold">
                  {fmtDuration(avg(stats.flatMap(s => s.leadTimes)))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg Exec Time</div>
                <div className="text-2xl font-bold">
                  {fmtDuration(avg(stats.flatMap(s => s.execTimes)))}
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t space-y-3">
              <div className="text-xs font-semibold">Destaque de Eficiência</div>
              {stats[0] && stats[0].completed > 0 ? (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/20">Top Performer</Badge>
                  </div>
                  <div className="text-sm font-medium">{stats[0].name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats[0].completed} tarefas concluídas no período.
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">Dados insuficientes para destaque.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarefas Recentes (Breve Resumo)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {tasks.filter(t => t.status === "done").slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/30 px-2 rounded-md transition-colors cursor-pointer" onClick={() => onOpenTask(t.id)}>
                <div className="min-w-0 flex-1 pr-4">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground">{t.clients?.name || "Sem cliente"}</div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t.done_at ? new Date(t.done_at).toLocaleDateString("pt-BR") : "—"}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{getInitials(team.find(p => p.id === t.assignee_id)?.full_name || "?")}</Badge>
                </div>
              </div>
            ))}
            {tasks.filter(t => t.status === "done").length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground italic">Nenhuma tarefa concluída no período.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaskCard({ task, onOpen }: { task: any; onOpen: () => void }) {
  const overdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);
  const m = task.meta ?? { chk: 0, chkDone: 0, comments: 0, files: 0 };
  const hasFooter = m.chk > 0 || m.comments > 0 || m.files > 0 || task.due_date || task.assignee;
  return (
    <Card
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/task-id", task.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onOpen}
      className="cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all touch-auto select-none"
    >
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-snug min-w-0">{task.title}</div>
          <div className="shrink-0"><PriorityBadge p={task.priority} /></div>
        </div>

        {task.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">{KIND_LABEL[task.kind]}</Badge>
          {task.clients?.name && (
            <span className="inline-flex items-center gap-1 min-w-0">
              {task.clients.logo_url ? (
                <img src={task.clients.logo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" loading="lazy" />
              ) : (
                <Building2 className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate max-w-[140px]">{task.clients.name}</span>
            </span>
          )}
        </div>

        {(task.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 4).map((tg: string) => (
              <span key={tg} className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">#{tg}</span>
            ))}
            {task.tags.length > 4 && (
              <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-1.5 py-0.5">+{task.tags.length - 4}</span>
            )}
          </div>
        )}

        {hasFooter && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t">
            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground min-w-0">
              {task.due_date && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                  overdue ? "bg-destructive/10 text-destructive font-medium" : "bg-muted"
                )}>
                  <CalendarIcon className="h-3 w-3" />
                  {new Date(task.due_date + "T00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
              {m.chk > 0 && (
                <span className={cn("inline-flex items-center gap-1", m.chkDone === m.chk && "text-emerald-600")}>
                  <CheckSquare className="h-3 w-3" />{m.chkDone}/{m.chk}
                </span>
              )}
              {m.comments > 0 && (
                <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{m.comments}</span>
              )}
              {m.files > 0 && (
                <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{m.files}</span>
              )}
            </div>
            {task.assignee?.full_name && (
              task.assignee.avatar_url ? (
                <img
                  src={task.assignee.avatar_url}
                  alt={task.assignee.full_name}
                  title={task.assignee.full_name}
                  className="h-6 w-6 rounded-full object-cover ring-2 ring-background shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0" title={task.assignee.full_name}>
                  {getInitials(task.assignee.full_name)}
                </div>
              )
            )}
          </div>
        )}
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
  const commentAuthors = useQuery({
    queryKey: ["profiles-min"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name")).data ?? [],
  });
  const authorName = (uid?: string | null) =>
    (commentAuthors.data ?? []).find((p: any) => p.id === uid)?.full_name ?? null;
  const comments = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => (await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at")).data ?? [],
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
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }); qc.invalidateQueries({ queryKey: ["tasks-meta"] });
  }
  async function toggleChk(id: string, done: boolean) {
    await supabase.from("task_checklist_items").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }); qc.invalidateQueries({ queryKey: ["tasks-meta"] });
  }
  async function delChk(id: string) {
    await supabase.from("task_checklist_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }); qc.invalidateQueries({ queryKey: ["tasks-meta"] });
  }

  const t = task.data;
  async function patch(fields: any) {
    const { error } = await supabase.from("tasks").update(fields).eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    if ("tags" in fields) qc.invalidateQueries({ queryKey: ["task-tags"] });
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
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] }); qc.invalidateQueries({ queryKey: ["tasks-meta"] });
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
                    {getInitials(user?.email ?? "?")}
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
                        {getInitials(authorName(c.user_id) ?? "?")}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs">
                          <span className="font-semibold">{authorName(c.user_id) ?? "—"}</span>
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
              <SideField icon={<Tag className="h-3.5 w-3.5" />} label="Tags">
                <TagsEditor value={t.tags ?? []} onChange={(next) => patch({ tags: next })} />
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

function TagsEditor({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const raw = input.trim().replace(/^#/, "");
    if (!raw) return;
    if (value.includes(raw)) { setInput(""); return; }
    onChange([...value, raw]);
    setInput("");
  }
  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1 min-h-[1.5rem]">
        {value.length === 0 && <span className="text-xs text-muted-foreground">Sem tags</span>}
        {value.map((tg) => (
          <span key={tg} className="inline-flex items-center gap-1 text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">
            #{tg}
            <button type="button" onClick={() => remove(tg)} className="hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="Nova tag + Enter"
        className="h-8 text-xs"
      />
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

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Plus, ChevronLeft, ChevronRight, Trash2, MessageSquare, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operacoes")({
  component: OperacoesPage,
});

const COLUMNS: { key: "todo" | "doing" | "review" | "done"; label: string }[] = [
  { key: "todo", label: "A fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "review", label: "Revisão" },
  { key: "done", label: "Concluído" },
];

const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const KIND_LABEL: Record<string, string> = { kickoff: "Kickoff", rotina: "Rotina", demanda: "Demanda", auditoria: "Auditoria" };

function OperacoesPage() {
  const qc = useQueryClient();
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [openTask, setOpenTask] = useState<string | null>(null);

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

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { todo: [], doing: [], review: [], done: [] };
    (tasks.data ?? []).forEach((t: any) => g[t.status]?.push(t));
    return g;
  }, [tasks.data]);

  async function move(task: any, dir: -1 | 1) {
    const idx = COLUMNS.findIndex(c => c.key === task.status);
    const next = COLUMNS[idx + dir];
    if (!next) return;
    const { error } = await supabase.from("tasks").update({ status: next.key }).eq("id", task.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operações</h1>
          <p className="text-muted-foreground mt-1">Kanban de demandas, kickoffs e rotinas. Vinculadas ao cliente aparecem na auditoria.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clients.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda equipe</SelectItem>
              {(team.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <NewTaskDialog clients={clients.data ?? []} team={team.data ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["tasks"] })} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(col => (
          <div key={col.key} className="rounded-lg bg-muted/40 border p-3 flex flex-col gap-3 min-h-[400px]">
            <div className="flex items-center justify-between px-1">
              <div className="text-sm font-semibold">{col.label}</div>
              <Badge variant="secondary">{grouped[col.key].length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {grouped[col.key].length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Nada por aqui.</div>}
              {grouped[col.key].map((t: any) => (
                <TaskCard key={t.id} task={t} onOpen={() => setOpenTask(t.id)} onMove={move} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {openTask && (
        <TaskDetail
          taskId={openTask}
          clients={clients.data ?? []}
          team={team.data ?? []}
          onClose={() => setOpenTask(null)}
          onChange={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onOpen, onMove }: { task: any; onOpen: () => void; onMove: (t: any, d: -1 | 1) => void }) {
  const overdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10);
  const idx = COLUMNS.findIndex(c => c.key === task.status);
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div onClick={onOpen}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium leading-snug">{task.title}</div>
            <PriorityBadge p={task.priority} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{KIND_LABEL[task.kind]}</Badge>
            {task.clients?.name && <span>· {task.clients.name}</span>}
            {task.assignee?.full_name && <span>· {task.assignee.full_name}</span>}
          </div>
          {task.due_date && (
            <div className={`text-[11px] mt-1 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {overdue ? "Atrasada · " : ""}{new Date(task.due_date + "T00:00").toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-1 border-t">
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => onMove(task, -1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === COLUMNS.length - 1} onClick={() => onMove(task, 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const v = p === "urgente" ? "destructive" : p === "alta" ? "default" : "secondary";
  return <Badge variant={v as any} className="text-[10px] py-0 px-1.5">{PRIORITY_LABEL[p]}</Badge>;
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

  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
  });
  const comments = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => (await supabase.from("task_comments").select("*, profiles(full_name)").eq("task_id", taskId).order("created_at")).data ?? [],
  });

  const t = task.data;
  async function patch(fields: any) {
    const { error } = await supabase.from("tasks").update(fields).eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    onChange();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {!t ? <div className="p-6 text-muted-foreground">Carregando…</div> : (
          <>
            <DialogHeader>
              <Input className="text-lg font-semibold border-none px-0 focus-visible:ring-0" defaultValue={t.title} onBlur={e => e.target.value !== t.title && patch({ title: e.target.value })} />
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1"><Label>Status</Label>
                <Select value={t.status} onValueChange={v => patch({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Prioridade</Label>
                <Select value={t.priority} onValueChange={v => patch({ priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={t.kind} onValueChange={v => patch({ kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Prazo</Label>
                <Input type="date" defaultValue={t.due_date ?? ""} onBlur={e => patch({ due_date: e.target.value || null })} />
              </div>
              <div className="space-y-1"><Label>Cliente</Label>
                <Select value={t.client_id ?? "none"} onValueChange={v => patch({ client_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Responsável</Label>
                <Select value={t.assignee_id ?? "none"} onValueChange={v => patch({ assignee_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {team.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea rows={4} defaultValue={t.description ?? ""} onBlur={e => e.target.value !== (t.description ?? "") && patch({ description: e.target.value })} />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4" /> Comentários</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(comments.data ?? []).length === 0 && <div className="text-xs text-muted-foreground">Sem comentários.</div>}
                {(comments.data ?? []).map((c: any) => (
                  <div key={c.id} className="text-sm border-l-2 border-primary/40 pl-3">
                    <div className="text-xs text-muted-foreground">{c.profiles?.full_name ?? "—"} · {new Date(c.created_at).toLocaleString("pt-BR")}</div>
                    <div>{c.body}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário…" />
                <Button onClick={async () => {
                  if (!comment.trim() || !user) return;
                  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: user.id, body: comment.trim() });
                  if (error) return toast.error(error.message);
                  setComment("");
                  qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
                }}>Enviar</Button>
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button variant="destructive" onClick={async () => {
                if (!confirm("Excluir esta tarefa?")) return;
                const { error } = await supabase.from("tasks").delete().eq("id", taskId);
                if (error) return toast.error(error.message);
                toast.success("Tarefa excluída");
                onClose(); onChange();
              }}><Trash2 className="h-4 w-4" /> Excluir</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

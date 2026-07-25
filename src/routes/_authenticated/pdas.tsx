import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Plus, Sparkles, Target } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generatePdaPlan } from "@/lib/pda.functions";
const ReactMarkdown = lazy(() => import("react-markdown"));


export const Route = createFileRoute("/_authenticated/pdas")({
  component: PdasPage,
});

const statusColor: Record<string, string> = {
  aberto: "bg-muted text-foreground",
  em_andamento: "bg-blue-500/15 text-blue-700",
  resolvido: "bg-emerald-500/15 text-emerald-700",
};

function PdasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("todos");

  const { data: pdas } = useQuery({
    queryKey: ["pdas-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdas")
        .select("id,title,description,priority,status,due_date,client_id,created_at,clients(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name").eq("status", "ativo").order("name");
      return data ?? [];
    },
  });

  const filtered = (pdas ?? []).filter((p) => filter === "todos" || p.status === filter);
  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0];

  const counts = {
    aberto: (pdas ?? []).filter((p) => p.status === "aberto").length,
    em_andamento: (pdas ?? []).filter((p) => p.status === "em_andamento").length,
    resolvido: (pdas ?? []).filter((p) => p.status === "resolvido").length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PDA · Planos de Ação</h1>
          <p className="text-muted-foreground mt-1">Diagnósticos e planos por cliente, com passos gerados por IA.</p>
        </div>
        <NewPdaButton clients={clients ?? []} userId={user?.id ?? ""} onCreated={(id) => { setSelectedId(id); qc.invalidateQueries({ queryKey: ["pdas-all"] }); }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Abertos</div><div className="text-2xl font-bold">{counts.aberto}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Em andamento</div><div className="text-2xl font-bold text-blue-600">{counts.em_andamento}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Resolvidos</div><div className="text-2xl font-bold text-emerald-600">{counts.resolvido}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">PDAs</CardTitle>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-7 text-xs w-32 ml-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberto">Abertos</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="resolvido">Resolvidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
            {filtered.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}
              >
                <div className="font-medium truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                  <span className="truncate">{p.clients?.name}</span>
                  <Badge variant="outline" className="h-4 px-1 text-[10px] capitalize">{p.priority}</Badge>
                  <Badge className={`h-4 px-1 text-[10px] ${statusColor[p.status]}`}>{p.status.replace("_", " ")}</Badge>
                </div>
              </button>
            ))}
            {!filtered.length && <p className="text-xs text-muted-foreground p-3 text-center">Nenhum PDA.</p>}
          </CardContent>
        </Card>

        {selected ? <PdaDetail pda={selected} onChange={() => qc.invalidateQueries({ queryKey: ["pdas-all"] })} /> : (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Selecione um PDA.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function NewPdaButton({ clients, userId, onCreated }: { clients: any[]; userId: string; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [dueDate, setDueDate] = useState("");

  async function create() {
    if (!clientId || !title) { toast.error("Cliente e título obrigatórios"); return; }
    const { data, error } = await supabase.from("pdas").insert({
      client_id: clientId, title, description: description || null, priority, due_date: dueDate || null, created_by: userId || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("PDA criado");
    setOpen(false); setTitle(""); setDescription(""); setDueDate("");
    onCreated(data.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo PDA</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Plano de Ação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Título do problema/oportunidade" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição / diagnóstico" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button onClick={create} className="w-full">Criar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PdaDetail({ pda, onChange }: { pda: any; onChange: () => void }) {
  const qc = useQueryClient();
  const generate = useServerFn(generatePdaPlan);
  const [generating, setGenerating] = useState(false);
  const [horizonte, setHorizonte] = useState<"proxima_semana" | "proximo_mes" | "proximo_trimestre">("proximo_mes");
  const [extra, setExtra] = useState("");

  const { data: steps } = useQuery({
    queryKey: ["pda-steps", pda.id],
    queryFn: async () => {
      const { data } = await supabase.from("pda_action_steps").select("*").eq("pda_id", pda.id).order("position");
      return data ?? [];
    },
  });

  async function runAi() {
    setGenerating(true);
    try {
      const r = await generate({ data: { pdaId: pda.id, horizonte, contextoExtra: extra || null } });
      toast.success(`${r.steps} passos gerados`);
      setExtra("");
      qc.invalidateQueries({ queryKey: ["pda-steps", pda.id] });
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar");
    } finally { setGenerating(false); }
  }

  async function updateStep(id: string, patch: any) {
    const { error } = await supabase.from("pda_action_steps").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pda-steps", pda.id] });
  }

  async function updateStatus(v: string) {
    const { error } = await supabase.from("pdas").update({ status: v }).eq("id", pda.id);
    if (error) toast.error(error.message);
    onChange();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{pda.title}</CardTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Link to="/clientes/$id" params={{ id: pda.client_id }} className="hover:underline">{pda.clients?.name}</Link>
                <span>·</span>
                <Badge variant="outline" className="capitalize">{pda.priority}</Badge>
                {pda.due_date && <><span>·</span><span>até {new Date(pda.due_date).toLocaleDateString("pt-BR")}</span></>}
              </div>
            </div>
            <Select value={pda.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        {pda.description && (
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{pda.description}</ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Gerar plano com IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
            <Select value={horizonte} onValueChange={(v: any) => setHorizonte(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proxima_semana">Próxima semana</SelectItem>
                <SelectItem value="proximo_mes">Próximo mês</SelectItem>
                <SelectItem value="proximo_trimestre">Próximo trimestre</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Contexto extra (opcional): meta, restrições, briefing…" value={extra} onChange={(e) => setExtra(e.target.value)} />
            <Button onClick={runAi} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" />{generating ? "Gerando…" : "Gerar passos"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A IA usa os dados dos últimos 30 dias de anúncios do cliente + descrição do PDA para propor um plano tático.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Passos ({steps?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(steps ?? []).map((s: any, i: number) => (
            <div key={s.id} className="border rounded-md p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={s.status === "concluido"}
                  onCheckedChange={(v) => updateStep(s.id, { status: v ? "concluido" : "aberto" })}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`font-medium ${s.status === "concluido" ? "line-through text-muted-foreground" : ""}`}>
                      {i + 1}. {s.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.due_date && <span>{new Date(s.due_date).toLocaleDateString("pt-BR")}</span>}
                      <Select value={s.status} onValueChange={(v) => updateStep(s.id, { status: v })}>
                        <SelectTrigger className="h-6 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberto">Aberto</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.description}</p>}
                </div>
              </div>
            </div>
          ))}
          {!steps?.length && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum passo. Use a IA para gerar um plano.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

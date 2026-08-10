import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Tag, LayoutTemplate, ChevronRight, ListChecks, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajustes/onboarding")({
  component: OnboardingConfigPage,
});

type Niche = { id: string; name: string; sigla: string | null };
type Template = { id: string; niche_id: string; name: string; description: string | null };
type Stage = { id: string; template_id: string; name: string; position: number; prazo_dias: number | null };
type TemplateTask = { id: string; stage_id: string; title: string; description: string | null; position: number; prazo_dias: number | null };

function OnboardingConfigPage() {
  const qc = useQueryClient();
  const niches = useQuery({
    queryKey: ["niches"],
    queryFn: async () => (await supabase.from("niches").select("*").order("name")).data as Niche[] ?? [],
  });

  const templatesAll = useQuery({
    queryKey: ["templates-all"],
    queryFn: async () => (await supabase.from("onboarding_templates").select("*").order("name")).data as Template[] ?? [],
  });

  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templateCountByNiche = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of templatesAll.data ?? []) m[t.niche_id] = (m[t.niche_id] ?? 0) + 1;
    return m;
  }, [templatesAll.data]);

  const nicheTemplates = useMemo(
    () => (templatesAll.data ?? []).filter((t) => t.niche_id === selectedNiche),
    [templatesAll.data, selectedNiche],
  );

  const selectedNicheObj = niches.data?.find((n) => n.id === selectedNiche) ?? null;
  const selectedTemplateObj = nicheTemplates.find((t) => t.id === selectedTemplate) ?? null;

  function pickNiche(id: string) {
    setSelectedNiche(id);
    setSelectedTemplate(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Onboarding por nicho</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre <b>nichos</b>, monte <b>templates</b> com <b>etapas</b> e <b>tarefas</b>. Ao criar um cliente,
          você escolhe o template e a estrutura é copiada.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_280px_1fr] min-h-[500px]">
        {/* Nichos */}
        <Column
          icon={Tag}
          title="Nichos"
          action={<NicheDialog onSaved={() => qc.invalidateQueries({ queryKey: ["niches"] })} />}
        >
          {niches.isLoading && <Empty label="Carregando…" />}
          {!niches.isLoading && (niches.data ?? []).length === 0 && (
            <Empty label="Nenhum nicho." hint="Crie seu primeiro nicho." />
          )}
          {(niches.data ?? []).map((n) => (
            <ItemRow
              key={n.id}
              active={selectedNiche === n.id}
              onClick={() => pickNiche(n.id)}
              title={n.name}
              subtitle={n.sigla ? `Sigla: ${n.sigla}` : undefined}
              badge={templateCountByNiche[n.id] ?? 0}
              onDelete={async () => {
                if (!confirm("Excluir este nicho e todos os templates?")) return;
                await supabase.from("niches").delete().eq("id", n.id);
                if (selectedNiche === n.id) { setSelectedNiche(null); setSelectedTemplate(null); }
                qc.invalidateQueries({ queryKey: ["niches"] });
                qc.invalidateQueries({ queryKey: ["templates-all"] });
              }}
              editDialog={<NicheDialog niche={n} onSaved={() => qc.invalidateQueries({ queryKey: ["niches"] })} />}
            />
          ))}
        </Column>

        {/* Templates */}
        <Column
          icon={LayoutTemplate}
          title="Templates"
          subtitle={selectedNicheObj?.name}
          action={
            selectedNiche ? (
              <TemplateDialog
                nicheId={selectedNiche}
                onSaved={(id) => {
                  qc.invalidateQueries({ queryKey: ["templates-all"] });
                  if (id) setSelectedTemplate(id);
                }}
              />
            ) : null
          }
        >
          {!selectedNiche && <Empty label="Selecione um nicho" />}
          {selectedNiche && nicheTemplates.length === 0 && <Empty label="Sem templates." hint="Crie o primeiro template." />}
          {selectedNiche && nicheTemplates.map((t) => (
            <ItemRow
              key={t.id}
              active={selectedTemplate === t.id}
              onClick={() => setSelectedTemplate(t.id)}
              title={t.name}
              subtitle={t.description ?? undefined}
              onDelete={async () => {
                if (!confirm("Excluir template?")) return;
                await supabase.from("onboarding_templates").delete().eq("id", t.id);
                if (selectedTemplate === t.id) setSelectedTemplate(null);
                qc.invalidateQueries({ queryKey: ["templates-all"] });
              }}
            />
          ))}
        </Column>

        {/* Etapas & tarefas */}
        <div className="rounded-md border bg-card overflow-hidden">
          {selectedTemplate ? (
            <StagesEditor templateId={selectedTemplate} templateName={selectedTemplateObj?.name ?? ""} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-2">
              <ListChecks className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-sm font-medium">Etapas & Tarefas</div>
              <div className="text-xs text-muted-foreground max-w-xs">
                Selecione um template à esquerda para editar as etapas do onboarding e suas tarefas.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------- reusable UI bits ------- */

function Column({
  icon: Icon, title, subtitle, action, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {title}
          </div>
          {subtitle && <div className="text-sm font-medium truncate mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function ItemRow({
  title, subtitle, active, badge, onClick, onDelete, editDialog,
}: {
  title: string;
  subtitle?: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
  onDelete?: () => void;
  editDialog?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm ${
        active ? "bg-primary/10 text-primary" : "hover:bg-accent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {typeof badge === "number" && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{badge}</Badge>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        {editDialog}
        {onDelete && (
          <Button
            size="icon" variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {active && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
    </div>
  );
}

function Empty({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="text-center text-xs text-muted-foreground py-8 px-4">
      <div>{label}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

/* ------- dialogs ------- */

function NicheDialog({ niche, onSaved }: { niche?: Niche; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(niche?.name ?? "");
  const [sigla, setSigla] = useState(niche?.sigla ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    const finalSigla = (sigla || name).replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
    setBusy(true);
    let error;
    if (niche) {
      const res = await supabase.from("niches").update({ name: name.trim(), sigla: finalSigla }).eq("id", niche.id);
      error = res.error;
    } else {
      const res = await supabase.from("niches").insert({ name: name.trim(), sigla: finalSigla });
      error = res.error;
    }
    setBusy(true);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(niche ? "Nicho atualizado" : "Nicho criado");
    if (!niche) { setName(""); setSigla(""); }
    setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          {niche ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{niche ? "Editar nicho" : "Novo nicho"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome do nicho</Label>
            <Input placeholder="Ex: Estética, Odontologia, E-commerce" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sigla (3 letras) — usada no código do cliente</Label>
            <Input maxLength={3} placeholder="Ex: EST" value={sigla} onChange={(e) => setSigla(e.target.value.toUpperCase())} />
            <p className="text-xs text-muted-foreground">Ex: <b>EST-2607-0001</b>. Se em branco, geramos das 3 primeiras letras do nome.</p>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Criar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ nicheId, template, onSaved }: { nicheId: string; template?: Template; onSaved: (id?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: template?.name ?? "", description: template?.description ?? "" });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.name.trim()) return;
    setBusy(true);
    if (template) {
      const { error } = await supabase.from("onboarding_templates").update({ name: form.name.trim(), description: form.description || null }).eq("id", template.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Template atualizado");
      setOpen(false); onSaved();
    } else {
      const { data, error } = await supabase.from("onboarding_templates").insert({ niche_id: nicheId, name: form.name.trim(), description: form.description || null }).select().single();
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Template criado");
      setForm({ name: "", description: "" });
      setOpen(false); onSaved(data.id);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {template
          ? <Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
          : <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input placeholder="Ex: Onboarding Local Estética" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------- stages & tasks ------- */

function StagesEditor({ templateId, templateName }: { templateId: string; templateName: string }) {
  const qc = useQueryClient();

  const stages = useQuery({
    queryKey: ["tstages", templateId],
    queryFn: async () => (await supabase.from("onboarding_template_stages").select("*").eq("template_id", templateId).order("position")).data as Stage[] ?? [],
  });
  const tasks = useQuery({
    queryKey: ["ttasks", templateId, (stages.data ?? []).map((s) => s.id).join(",")],
    queryFn: async () => {
      const stageIds = (stages.data ?? []).map((s) => s.id);
      if (!stageIds.length) return [];
      return (await supabase.from("onboarding_template_tasks").select("*").in("stage_id", stageIds).order("position")).data as TemplateTask[] ?? [];
    },
    enabled: !!stages.data,
  });

  const [newStage, setNewStage] = useState("");
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["tstages", templateId] });
    qc.invalidateQueries({ queryKey: ["ttasks", templateId] });
  }

  async function addStage() {
    if (!newStage.trim()) return;
    const pos = stages.data?.length ?? 0;
    const { error } = await supabase.from("onboarding_template_stages").insert({ template_id: templateId, name: newStage.trim(), position: pos });
    if (error) return toast.error(error.message);
    setNewStage(""); invalidate();
  }
  async function delStage(id: string) {
    if (!confirm("Excluir etapa e suas tarefas?")) return;
    await supabase.from("onboarding_template_stages").delete().eq("id", id);
    invalidate();
  }
  async function addTask(stageId: string) {
    const title = taskInputs[stageId]?.trim();
    if (!title) return;
    const pos = (tasks.data ?? []).filter((t) => t.stage_id === stageId).length;
    const { error } = await supabase.from("onboarding_template_tasks").insert({ stage_id: stageId, title, position: pos });
    if (error) return toast.error(error.message);
    setTaskInputs({ ...taskInputs, [stageId]: "" });
    invalidate();
  }
  async function delTask(id: string) {
    await supabase.from("onboarding_template_tasks").delete().eq("id", id);
    invalidate();
  }

  const totalTasks = tasks.data?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" /> Template
            </div>
            <div className="text-base font-semibold truncate">{templateName}</div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{stages.data?.length ?? 0} etapas</Badge>
            <Badge variant="outline">{totalTasks} tarefas</Badge>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex gap-2">
          <Input placeholder="Nova etapa (ex: Kickoff, Pixel & Tracking, Criativos)" value={newStage} onChange={(e) => setNewStage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage()} />
          <Button size="sm" onClick={addStage}><Plus className="h-4 w-4" /> Etapa</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(stages.data ?? []).length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-md">
            Nenhuma etapa. Comece adicionando a primeira acima.
          </div>
        )}
        {(stages.data ?? []).map((s, idx) => {
          const stageTasks = (tasks.data ?? []).filter((t) => t.stage_id === s.id);
          return (
            <Card key={s.id} className="overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className="flex-1 font-medium text-sm">{s.name}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Prazo</span>
                  <Input
                    type="number"
                    min="0"
                    defaultValue={s.prazo_dias ?? ""}
                    onBlur={async (e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v === (s.prazo_dias ?? null)) return;
                      await supabase.from("onboarding_template_stages").update({ prazo_dias: v }).eq("id", s.id);
                      invalidate();
                    }}
                    className="h-7 w-16 text-xs"
                    placeholder="—"
                  />
                  <span>dias</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{stageTasks.length} tarefas</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delStage(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <CardContent className="p-3 space-y-2">
                {stageTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2">Sem tarefas nesta etapa.</div>
                )}
                {stageTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-1.5 bg-background">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="flex-1 truncate">{t.title}</span>
                    <Input
                      type="number"
                      min="0"
                      defaultValue={t.prazo_dias ?? ""}
                      onBlur={async (e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        if (v === (t.prazo_dias ?? null)) return;
                        await supabase.from("onboarding_template_tasks").update({ prazo_dias: v }).eq("id", t.id);
                        invalidate();
                      }}
                      className="h-6 w-14 text-xs"
                      placeholder="prazo"
                    />
                    <span className="text-[10px] text-muted-foreground">d</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delTask(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Nova tarefa"
                    value={taskInputs[s.id] ?? ""}
                    onChange={(e) => setTaskInputs({ ...taskInputs, [s.id]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addTask(s.id)}
                    className="h-8"
                  />
                  <Button size="sm" variant="outline" onClick={() => addTask(s.id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

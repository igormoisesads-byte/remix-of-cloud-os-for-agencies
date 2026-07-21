import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LogOut, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajustes")({
  component: AjustesPage,
});

const KIND_LABEL: Record<string, string> = { mensal: "Mensal", lancamento: "Lançamento", autoria: "Autoria", outro: "Outro" };
const fmtBRL = (n: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

function AjustesPage() {
  const { profile, roles, signOut, hasRole } = useAuth();
  const nav = useNavigate();
  const isAdmin = hasRole("admin");

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Meu perfil</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row k="Nome" v={profile?.full_name || "—"} />
          <Row k="E-mail" v={profile?.email || "—"} />
          <Row k="Papéis" v={roles.join(", ") || "—"} last />
        </CardContent>
      </Card>

      {isAdmin && <PlansCard />}
      {isAdmin && <TiersCard />}
      {isAdmin && <OnboardingConfigCard />}

      <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}>
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${last ? "" : "border-b"}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

/* ------- Plans ------- */

type Plan = { id: string; name: string; kind: string; amount: number | null; description: string | null; active: boolean };

function PlansCard() {
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  async function remove(id: string) {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano excluído");
    qc.invalidateQueries({ queryKey: ["plans"] });
  }

  async function toggle(p: Plan) {
    await supabase.from("plans").update({ active: !p.active }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["plans"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Planos & Produtos</CardTitle>
        <PlanDialog onSaved={() => qc.invalidateQueries({ queryKey: ["plans"] })} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>}
            {!isLoading && (plans ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum plano cadastrado.</TableCell></TableRow>
            )}
            {(plans ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.description}</div></TableCell>
                <TableCell><Badge variant="outline">{KIND_LABEL[p.kind] || p.kind}</Badge></TableCell>
                <TableCell className="text-right">{p.amount != null ? fmtBRL(Number(p.amount)) : "—"}</TableCell>
                <TableCell><Switch checked={p.active} onCheckedChange={() => toggle(p)} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <PlanDialog plan={p} onSaved={() => qc.invalidateQueries({ queryKey: ["plans"] })} />
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlanDialog({ plan, onSaved }: { plan?: Plan; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: plan?.name ?? "", kind: plan?.kind ?? "mensal",
    amount: plan?.amount != null ? String(plan.amount) : "",
    description: plan?.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.name.trim()) return;
    setBusy(true);
    const payload = {
      name: form.name.trim(), kind: form.kind,
      amount: form.amount ? Number(form.amount) : null,
      description: form.description || null,
    };
    const { error } = plan
      ? await supabase.from("plans").update(payload).eq("id", plan.id)
      : await supabase.from("plans").insert({ ...payload, active: true });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(plan ? "Plano atualizado" : "Plano criado");
    setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan
          ? <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm"><Plus className="h-4 w-4" /> Novo plano</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{plan ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal (local / perpétuo)</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                  <SelectItem value="autoria">Autoria</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------- Commission tiers ------- */

type Tier = { id: string; min_revenue: number; max_revenue: number | null; pct: number; label: string | null };

function TiersCard() {
  const qc = useQueryClient();
  const { data: tiers, isLoading } = useQuery({
    queryKey: ["tiers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_tiers").select("*").order("min_revenue");
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
  });

  async function remove(id: string) {
    if (!confirm("Excluir esta faixa?")) return;
    await supabase.from("commission_tiers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tiers"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Tabela padrão de comissão (lançamento)</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">Faixas de faturamento × % — usada como referência ao cadastrar clientes de lançamento.</div>
        </div>
        <TierDialog onSaved={() => qc.invalidateQueries({ queryKey: ["tiers"] })} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faixa</TableHead>
              <TableHead className="text-right">Mín</TableHead>
              <TableHead className="text-right">Máx</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>}
            {!isLoading && (tiers ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem faixas cadastradas.</TableCell></TableRow>
            )}
            {(tiers ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.label || "—"}</TableCell>
                <TableCell className="text-right">{fmtBRL(Number(t.min_revenue))}</TableCell>
                <TableCell className="text-right">{t.max_revenue != null ? fmtBRL(Number(t.max_revenue)) : "∞"}</TableCell>
                <TableCell className="text-right"><Badge variant="secondary">{t.pct}%</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <TierDialog tier={t} onSaved={() => qc.invalidateQueries({ queryKey: ["tiers"] })} />
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TierDialog({ tier, onSaved }: { tier?: Tier; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    label: tier?.label ?? "",
    min_revenue: tier ? String(tier.min_revenue) : "0",
    max_revenue: tier?.max_revenue != null ? String(tier.max_revenue) : "",
    pct: tier ? String(tier.pct) : "",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.pct) return;
    setBusy(true);
    const payload = {
      label: form.label || null,
      min_revenue: Number(form.min_revenue) || 0,
      max_revenue: form.max_revenue ? Number(form.max_revenue) : null,
      pct: Number(form.pct),
    };
    const { error } = tier
      ? await supabase.from("commission_tiers").update(payload).eq("id", tier.id)
      : await supabase.from("commission_tiers").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setOpen(false); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {tier
          ? <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm"><Plus className="h-4 w-4" /> Nova faixa</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{tier ? "Editar faixa" : "Nova faixa"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Rótulo</Label><Input placeholder="Ex: R$ 100k a 250k" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Mín (R$)</Label><Input type="number" step="0.01" value={form.min_revenue} onChange={(e) => setForm({ ...form, min_revenue: e.target.value })} /></div>
            <div className="space-y-2"><Label>Máx (R$)</Label><Input type="number" step="0.01" placeholder="vazio = ∞" value={form.max_revenue} onChange={(e) => setForm({ ...form, max_revenue: e.target.value })} /></div>
            <div className="space-y-2"><Label>%</Label><Input type="number" step="0.01" value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------- Onboarding config (Niches -> Templates -> Stages -> Tasks) ------- */

type Niche = { id: string; name: string };
type Template = { id: string; niche_id: string; name: string; description: string | null };
type Stage = { id: string; template_id: string; name: string; position: number };
type TemplateTask = { id: string; stage_id: string; title: string; description: string | null; position: number };

function OnboardingConfigCard() {
  const qc = useQueryClient();
  const niches = useQuery({
    queryKey: ["niches"],
    queryFn: async () => (await supabase.from("niches").select("*").order("name")).data as Niche[] ?? [],
  });
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [newNiche, setNewNiche] = useState("");

  async function addNiche() {
    if (!newNiche.trim()) return;
    const { error } = await supabase.from("niches").insert({ name: newNiche.trim() });
    if (error) return toast.error(error.message);
    setNewNiche(""); qc.invalidateQueries({ queryKey: ["niches"] });
  }
  async function delNiche(id: string) {
    if (!confirm("Excluir este nicho e todos os templates?")) return;
    await supabase.from("niches").delete().eq("id", id);
    if (selectedNiche === id) setSelectedNiche(null);
    qc.invalidateQueries({ queryKey: ["niches"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Onboarding por nicho</CardTitle>
        <div className="text-xs text-muted-foreground mt-1">Cadastre nichos, templates, etapas e tarefas. Ao criar um cliente, você escolhe o template e a estrutura é copiada.</div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Nichos</div>
            <div className="flex gap-2">
              <Input placeholder="Novo nicho" value={newNiche} onChange={(e) => setNewNiche(e.target.value)} />
              <Button size="sm" onClick={addNiche}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1">
              {(niches.data ?? []).map((n) => (
                <div key={n.id} className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer ${selectedNiche === n.id ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  <span className="flex-1 text-sm" onClick={() => setSelectedNiche(n.id)}>{n.name}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delNiche(n.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              {(niches.data ?? []).length === 0 && <div className="text-xs text-muted-foreground">Nenhum nicho.</div>}
            </div>
          </div>
          <div>
            {selectedNiche ? <TemplatesEditor nicheId={selectedNiche} /> : <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">Selecione um nicho para ver os templates.</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesEditor({ nicheId }: { nicheId: string }) {
  const qc = useQueryClient();
  const templates = useQuery({
    queryKey: ["templates", nicheId],
    queryFn: async () => (await supabase.from("onboarding_templates").select("*").eq("niche_id", nicheId).order("name")).data as Template[] ?? [],
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  async function addTemplate() {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("onboarding_templates").insert({ niche_id: nicheId, name: newName.trim() }).select().single();
    if (error) return toast.error(error.message);
    setNewName(""); setSelected(data.id);
    qc.invalidateQueries({ queryKey: ["templates", nicheId] });
  }
  async function delTemplate(id: string) {
    if (!confirm("Excluir template?")) return;
    await supabase.from("onboarding_templates").delete().eq("id", id);
    if (selected === id) setSelected(null);
    qc.invalidateQueries({ queryKey: ["templates", nicheId] });
  }

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Templates</div>
      <div className="flex gap-2">
        <Input placeholder="Nome do template" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button size="sm" onClick={addTemplate}><Plus className="h-4 w-4" /> Template</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(templates.data ?? []).map((t) => (
          <div key={t.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm cursor-pointer ${selected === t.id ? "bg-primary/10 border-primary text-primary" : "hover:bg-accent"}`} onClick={() => setSelected(t.id)}>
            {t.name}
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); delTemplate(t.id); }}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
      {selected && <StagesEditor templateId={selected} />}
    </div>
  );
}

function StagesEditor({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const stages = useQuery({
    queryKey: ["tstages", templateId],
    queryFn: async () => (await supabase.from("onboarding_template_stages").select("*").eq("template_id", templateId).order("position")).data as Stage[] ?? [],
  });
  const tasks = useQuery({
    queryKey: ["ttasks", templateId],
    queryFn: async () => {
      const stageIds = (stages.data ?? []).map((s) => s.id);
      if (!stageIds.length) return [];
      return (await supabase.from("onboarding_template_tasks").select("*").in("stage_id", stageIds).order("position")).data as TemplateTask[] ?? [];
    },
    enabled: !!stages.data,
  });
  const [newStage, setNewStage] = useState("");
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  async function addStage() {
    if (!newStage.trim()) return;
    const pos = (stages.data?.length ?? 0);
    await supabase.from("onboarding_template_stages").insert({ template_id: templateId, name: newStage.trim(), position: pos });
    setNewStage("");
    qc.invalidateQueries({ queryKey: ["tstages", templateId] });
    qc.invalidateQueries({ queryKey: ["ttasks", templateId] });
  }
  async function delStage(id: string) {
    if (!confirm("Excluir etapa e suas tarefas?")) return;
    await supabase.from("onboarding_template_stages").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tstages", templateId] });
    qc.invalidateQueries({ queryKey: ["ttasks", templateId] });
  }
  async function addTask(stageId: string) {
    const title = taskInputs[stageId]?.trim();
    if (!title) return;
    const pos = (tasks.data ?? []).filter((t) => t.stage_id === stageId).length;
    await supabase.from("onboarding_template_tasks").insert({ stage_id: stageId, title, position: pos });
    setTaskInputs({ ...taskInputs, [stageId]: "" });
    qc.invalidateQueries({ queryKey: ["ttasks", templateId] });
  }
  async function delTask(id: string) {
    await supabase.from("onboarding_template_tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["ttasks", templateId] });
  }

  return (
    <div className="space-y-3 rounded-md border p-3 bg-muted/20">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Etapas & Tarefas</div>
      <div className="flex gap-2">
        <Input placeholder="Nova etapa (ex: Kickoff, Pixel & Tracking)" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
        <Button size="sm" onClick={addStage}><Plus className="h-4 w-4" /> Etapa</Button>
      </div>
      {(stages.data ?? []).length === 0 && <div className="text-xs text-muted-foreground">Sem etapas.</div>}
      {(stages.data ?? []).map((s) => (
        <div key={s.id} className="rounded-md border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">{s.name}</div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delStage(s.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
          <div className="space-y-1">
            {(tasks.data ?? []).filter((t) => t.stage_id === s.id).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{t.title}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delTask(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Input placeholder="Nova tarefa" value={taskInputs[s.id] ?? ""} onChange={(e) => setTaskInputs({ ...taskInputs, [s.id]: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => addTask(s.id)}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

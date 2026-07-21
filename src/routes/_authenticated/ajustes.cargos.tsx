import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/ajustes/cargos")({
  component: CargosPage,
});

type Template = { id: string; cargo: string; nivel: string | null; descricao: string | null };

const PERIODICIDADES = [
  "Diária", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo",
  "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Ocasional", "Uma vez",
];

function CargosPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("superadmin");
  const qc = useQueryClient();

  const templatesQ = useQuery({
    queryKey: ["role_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_templates").select("*").order("cargo");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = templatesQ.data?.find((t) => t.id === selectedId) ?? templatesQ.data?.[0] ?? null;
  const activeId = selected?.id ?? null;

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ cargo: "", nivel: "", descricao: "" });
  async function createTemplate() {
    if (!newForm.cargo.trim()) return;
    const { data, error } = await supabase
      .from("role_templates")
      .insert({ cargo: newForm.cargo.trim(), nivel: newForm.nivel.trim() || null, descricao: newForm.descricao.trim() || null })
      .select().single();
    if (error) return toast.error(error.message);
    setNewOpen(false);
    setNewForm({ cargo: "", nivel: "", descricao: "" });
    await qc.invalidateQueries({ queryKey: ["role_templates"] });
    setSelectedId(data!.id);
  }

  async function removeTemplate(id: string) {
    if (!confirm("Excluir este cargo? Todas as rotinas serão perdidas.")) return;
    const { error } = await supabase.from("role_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedId === id) setSelectedId(null);
    qc.invalidateQueries({ queryKey: ["role_templates"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Rotinas por cargo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure atribuições, reuniões, rotinas, análises e KPIs de cada cargo — usado na auditoria de RH/DP.
          </p>
        </div>
        {canEdit && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Novo cargo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo cargo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Cargo *</Label><Input value={newForm.cargo} onChange={(e) => setNewForm({ ...newForm, cargo: e.target.value })} placeholder="Ex: Gestor de Tráfego" /></div>
                <div className="space-y-2"><Label>Nível (opcional)</Label><Input value={newForm.nivel} onChange={(e) => setNewForm({ ...newForm, nivel: e.target.value })} placeholder="Junior / Pleno / Senior" /></div>
                <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={newForm.descricao} onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={createTemplate}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lista de cargos */}
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cargos</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {templatesQ.isLoading && <p className="text-xs text-muted-foreground p-2">Carregando…</p>}
            {templatesQ.data?.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum cargo cadastrado.</p>}
            {templatesQ.data?.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  activeId === t.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{t.cargo}</span>
                {t.nivel && <Badge variant="outline" className="text-[10px]">{t.nivel}</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Detalhe */}
        <div className="col-span-8 lg:col-span-9">
          {!selected ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Selecione um cargo à esquerda ou crie um novo.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{selected.cargo}{selected.nivel ? ` — ${selected.nivel}` : ""}</CardTitle>
                  {selected.descricao && <p className="text-xs text-muted-foreground mt-1">{selected.descricao}</p>}
                </div>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => removeTemplate(selected.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="atrib">
                  <TabsList className="mb-3">
                    <TabsTrigger value="atrib">Atribuições</TabsTrigger>
                    <TabsTrigger value="reun">Reuniões</TabsTrigger>
                    <TabsTrigger value="rot">Rotinas</TabsTrigger>
                    <TabsTrigger value="ana">Análises</TabsTrigger>
                    <TabsTrigger value="kpi">KPIs</TabsTrigger>
                  </TabsList>

                  <TabsContent value="atrib"><AtribuicoesList templateId={selected.id} canEdit={canEdit} /></TabsContent>
                  <TabsContent value="reun"><ReunioesList templateId={selected.id} canEdit={canEdit} /></TabsContent>
                  <TabsContent value="rot"><RotinasList templateId={selected.id} canEdit={canEdit} /></TabsContent>
                  <TabsContent value="ana"><AnalisesList templateId={selected.id} canEdit={canEdit} /></TabsContent>
                  <TabsContent value="kpi"><KpisList templateId={selected.id} canEdit={canEdit} /></TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ATRIBUIÇÕES ---------- */
function AtribuicoesList({ templateId, canEdit }: { templateId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["role_attribuicoes", templateId],
    queryFn: async () => (await supabase.from("role_attribuicoes").select("*").eq("template_id", templateId).order("ordem")).data ?? [],
  });
  const [desc, setDesc] = useState("");
  async function add() {
    if (!desc.trim()) return;
    const nextOrdem = ((q.data ?? []).at(-1) as any)?.ordem ?? 0;
    const { error } = await supabase.from("role_attribuicoes").insert({ template_id: templateId, descricao: desc.trim(), ordem: nextOrdem + 1 });
    if (error) return toast.error(error.message);
    setDesc("");
    qc.invalidateQueries({ queryKey: ["role_attribuicoes", templateId] });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("role_attribuicoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["role_attribuicoes", templateId] });
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Nova atribuição" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="space-y-1">
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atribuição.</p>}
        {(q.data ?? []).map((r: any, idx: number) => (
          <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border">
            <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
            <span className="flex-1 text-sm">{r.descricao}</span>
            {canEdit && <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- REUNIÕES ---------- */
function ReunioesList({ templateId, canEdit }: { templateId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["role_reunioes", templateId],
    queryFn: async () => (await supabase.from("role_reunioes").select("*").eq("template_id", templateId).order("ordem")).data ?? [],
  });
  const [form, setForm] = useState({ periodicidade: "Semanal", titulo: "" });
  async function add() {
    if (!form.titulo.trim()) return;
    const nextOrdem = ((q.data ?? []).at(-1) as any)?.ordem ?? 0;
    const { error } = await supabase.from("role_reunioes").insert({ template_id: templateId, ...form, titulo: form.titulo.trim(), ordem: nextOrdem + 1 });
    if (error) return toast.error(error.message);
    setForm({ periodicidade: "Semanal", titulo: "" });
    qc.invalidateQueries({ queryKey: ["role_reunioes", templateId] });
  }
  async function remove(id: string) {
    await supabase.from("role_reunioes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["role_reunioes", templateId] });
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <Select value={form.periodicidade} onValueChange={(v) => setForm({ ...form, periodicidade: v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Nome da reunião" />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      )}
      <Table>
        <TableHeader><TableRow><TableHead className="w-48">Periodicidade</TableHead><TableHead>Reunião</TableHead>{canEdit && <TableHead className="w-16" />}</TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center text-muted-foreground py-6">Nenhuma reunião.</TableCell></TableRow>}
          {(q.data ?? []).map((r: any) => (
            <TableRow key={r.id}>
              <TableCell><Badge variant="outline">{r.periodicidade}</Badge></TableCell>
              <TableCell>{r.titulo}</TableCell>
              {canEdit && <TableCell><Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------- ROTINAS ---------- */
function RotinasList({ templateId, canEdit }: { templateId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["role_rotinas", templateId],
    queryFn: async () => (await supabase.from("role_rotinas").select("*").eq("template_id", templateId).order("ordem")).data ?? [],
  });
  const [form, setForm] = useState({ periodicidade: "Segunda-feira", tarefa: "", entregavel: false, entregavel_desc: "" });
  async function add() {
    if (!form.tarefa.trim()) return;
    const nextOrdem = ((q.data ?? []).at(-1) as any)?.ordem ?? 0;
    const { error } = await supabase.from("role_rotinas").insert({
      template_id: templateId,
      periodicidade: form.periodicidade,
      tarefa: form.tarefa.trim(),
      entregavel: form.entregavel,
      entregavel_desc: form.entregavel ? form.entregavel_desc.trim() || null : null,
      ordem: nextOrdem + 1,
    });
    if (error) return toast.error(error.message);
    setForm({ periodicidade: "Segunda-feira", tarefa: "", entregavel: false, entregavel_desc: "" });
    qc.invalidateQueries({ queryKey: ["role_rotinas", templateId] });
  }
  async function toggle(id: string, entregavel: boolean) {
    await supabase.from("role_rotinas").update({ entregavel }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["role_rotinas", templateId] });
  }
  async function remove(id: string) {
    await supabase.from("role_rotinas").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["role_rotinas", templateId] });
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="grid grid-cols-12 gap-2 items-end p-3 rounded-md border bg-muted/30">
          <div className="col-span-3 space-y-1"><Label className="text-xs">Periodicidade</Label>
            <Select value={form.periodicidade} onValueChange={(v) => setForm({ ...form, periodicidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-5 space-y-1"><Label className="text-xs">Tarefa</Label>
            <Input value={form.tarefa} onChange={(e) => setForm({ ...form, tarefa: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center gap-2 pb-2">
            <Switch checked={form.entregavel} onCheckedChange={(v) => setForm({ ...form, entregavel: v })} />
            <Label className="text-xs">Entregável?</Label>
          </div>
          <div className="col-span-2 flex gap-2">
            {form.entregavel && <Input placeholder="Descrição" value={form.entregavel_desc} onChange={(e) => setForm({ ...form, entregavel_desc: e.target.value })} />}
            <Button onClick={add} className="shrink-0"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <Table>
        <TableHeader><TableRow><TableHead className="w-40">Periodicidade</TableHead><TableHead>Tarefa</TableHead><TableHead className="w-28">Entregável?</TableHead><TableHead>Descrição</TableHead>{canEdit && <TableHead className="w-16" />}</TableRow></TableHeader>
        <TableBody>
          {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground py-6">Nenhuma rotina.</TableCell></TableRow>}
          {(q.data ?? []).map((r: any) => (
            <TableRow key={r.id}>
              <TableCell><Badge variant="outline">{r.periodicidade}</Badge></TableCell>
              <TableCell>{r.tarefa}</TableCell>
              <TableCell>
                <Switch checked={r.entregavel} onCheckedChange={(v) => toggle(r.id, v)} disabled={!canEdit} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.entregavel_desc ?? "—"}</TableCell>
              {canEdit && <TableCell><Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------- ANÁLISES ---------- */
function AnalisesList({ templateId, canEdit }: { templateId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["role_analises", templateId],
    queryFn: async () => (await supabase.from("role_analises").select("*").eq("template_id", templateId).order("ordem")).data ?? [],
  });
  const [txt, setTxt] = useState("");
  async function add() {
    if (!txt.trim()) return;
    const nextOrdem = ((q.data ?? []).at(-1) as any)?.ordem ?? 0;
    const { error } = await supabase.from("role_analises").insert({ template_id: templateId, analise: txt.trim(), ordem: nextOrdem + 1 });
    if (error) return toast.error(error.message);
    setTxt("");
    qc.invalidateQueries({ queryKey: ["role_analises", templateId] });
  }
  async function remove(id: string) {
    await supabase.from("role_analises").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["role_analises", templateId] });
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <Input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Nova análise" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="space-y-1">
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma análise.</p>}
        {(q.data ?? []).map((r: any) => (
          <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border">
            <span className="flex-1 text-sm">{r.analise}</span>
            {canEdit && <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- KPIs ---------- */
function KpisList({ templateId, canEdit }: { templateId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["role_kpis", templateId],
    queryFn: async () => (await supabase.from("role_kpis").select("*").eq("template_id", templateId).order("ordem")).data ?? [],
  });
  const [txt, setTxt] = useState("");
  async function add() {
    if (!txt.trim()) return;
    const nextOrdem = ((q.data ?? []).at(-1) as any)?.ordem ?? 0;
    const { error } = await supabase.from("role_kpis").insert({ template_id: templateId, kpi: txt.trim(), ordem: nextOrdem + 1 });
    if (error) return toast.error(error.message);
    setTxt("");
    qc.invalidateQueries({ queryKey: ["role_kpis", templateId] });
  }
  async function remove(id: string) {
    await supabase.from("role_kpis").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["role_kpis", templateId] });
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <Input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Novo KPI" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="space-y-1">
        {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum KPI.</p>}
        {(q.data ?? []).map((r: any) => (
          <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border">
            <span className="flex-1 text-sm">{r.kpi}</span>
            {canEdit && <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

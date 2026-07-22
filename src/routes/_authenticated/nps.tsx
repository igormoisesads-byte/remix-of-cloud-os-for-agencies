import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, Copy, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/nps")({
  component: NpsPage,
});

type QType = "nps" | "text" | "rating" | "choice";
type Question = { id: string; label: string; type: QType; options?: string[]; required?: boolean };

function uid() { return Math.random().toString(36).slice(2, 10); }

function NpsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: surveys } = useQuery({
    queryKey: ["nps-surveys"],
    queryFn: async () => {
      const { data } = await supabase.from("nps_surveys").select("*, clients(name)").order("created_at", { ascending: false });
      return (data ?? []).map((s: any) => ({ ...s, client_name: s.clients?.name }));
    },
  });



  const selected = surveys?.find((s) => s.id === selectedId) ?? surveys?.[0];

  const { data: responses } = useQuery({
    queryKey: ["nps-responses", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase.from("nps_survey_responses").select("*").eq("survey_id", selected.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!selected,
  });

  const stats = useMemo(() => {
    const scored = (responses ?? []).filter((r: any) => r.score != null);
    const total = scored.length;
    if (!total) return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: null as number | null };
    const promoters = scored.filter((r: any) => r.score >= 9).length;
    const detractors = scored.filter((r: any) => r.score <= 6).length;
    const passives = total - promoters - detractors;
    return { total, promoters, passives, detractors, nps: Math.round(((promoters - detractors) / total) * 100) };
  }, [responses]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NPS</h1>
          <p className="text-muted-foreground mt-1">Formulários de NPS da empresa e respostas recebidas.</p>
        </div>
        <NewSurveyButton onCreated={(id) => { setSelectedId(id); qc.invalidateQueries({ queryKey: ["nps-surveys"] }); }} userId={user?.id ?? ""} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Formulários</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {(surveys ?? []).map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent ${selected?.id === s.id ? "bg-accent" : ""}`}
              >
                <div className="font-medium truncate">{s.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  {s.active ? <Badge variant="default" className="h-4 px-1 text-[10px]">ativo</Badge> : <Badge variant="secondary" className="h-4 px-1 text-[10px]">inativo</Badge>}
                  {s.ref_month && <span>{new Date(s.ref_month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>}
                </div>
                {s.client_name && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{s.client_name}</div>}
              </button>
            ))}
            {!surveys?.length && <p className="text-xs text-muted-foreground p-2">Crie o primeiro formulário.</p>}

          </CardContent>
        </Card>

        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">NPS</div><div className="text-2xl font-bold">{stats.nps ?? "—"}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Promotores</div><div className="text-2xl font-bold text-emerald-600">{stats.promoters}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Neutros</div><div className="text-2xl font-bold text-amber-600">{stats.passives}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Detratores</div><div className="text-2xl font-bold text-red-600">{stats.detractors}</div></CardContent></Card>
            </div>

            <SurveyEditor survey={selected} onChange={() => qc.invalidateQueries({ queryKey: ["nps-surveys"] })} />

            <Card>
              <CardHeader><CardTitle className="text-base">Respostas ({stats.total})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(responses ?? []).map((r: any) => (
                  <div key={r.id} className="border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.score != null && (
                          <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-semibold ${
                            r.score >= 9 ? "bg-emerald-500/15 text-emerald-700" : r.score <= 6 ? "bg-red-500/15 text-red-700" : "bg-amber-500/15 text-amber-700"
                          }`}>{r.score}</span>
                        )}
                        <span className="font-medium">{r.respondent_name ?? r.respondent_email ?? "Anônimo"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    {r.comment && <p className="mt-2 text-muted-foreground">{r.comment}</p>}
                    {r.answers && Object.keys(r.answers).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        {Object.entries(r.answers).map(([k, v]) => (<div key={k}><span className="font-medium">{k}:</span> {String(v)}</div>))}
                      </div>
                    )}
                  </div>
                ))}
                {!responses?.length && <p className="text-sm text-muted-foreground py-6 text-center">Sem respostas ainda. Compartilhe o link público.</p>}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Selecione ou crie um formulário.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function NewSurveyButton({ onCreated, userId }: { onCreated: (id: string) => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Pesquisa de satisfação");
  const [description, setDescription] = useState("");
  async function create() {
    const { data, error } = await supabase.from("nps_surveys").insert({
      title, description: description || null, created_by: userId || null,
      questions: [{ id: uid(), label: "Em uma escala de 0 a 10, o quanto você recomendaria nossa agência?", type: "nps", required: true }],
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Formulário criado");
    setOpen(false);
    onCreated(data.id);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo formulário</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo formulário NPS</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button onClick={create} className="w-full">Criar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SurveyEditor({ survey, onChange }: { survey: any; onChange: () => void }) {
  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description ?? "");
  const [active, setActive] = useState(survey.active);
  const [questions, setQuestions] = useState<Question[]>(survey.questions ?? []);
  const [saving, setSaving] = useState(false);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/nps/${survey.public_token}` : "";

  function addQ() {
    setQuestions([...questions, { id: uid(), label: "Nova pergunta", type: "text" }]);
  }
  function updateQ(id: string, patch: Partial<Question>) {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQ(id: string) { setQuestions(questions.filter((q) => q.id !== id)); }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("nps_surveys").update({ title, description: description || null, active, questions }).eq("id", survey.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    onChange();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Configuração</CardTitle>
        <div className="flex items-center gap-2 text-xs">
          <span>Ativo</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
          <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-xs">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{publicUrl}</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Perguntas</h4>
            <Button size="sm" variant="outline" onClick={addQ}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                <Input value={q.label} onChange={(e) => updateQ(q.id, { label: e.target.value })} placeholder="Pergunta" />
                <Select value={q.type} onValueChange={(v) => updateQ(q.id, { type: v as QType })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nps">NPS (0-10)</SelectItem>
                    <SelectItem value="rating">Estrelas (1-5)</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="choice">Múltipla escolha</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => removeQ(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {q.type === "choice" && (
                <Input
                  placeholder="Opções separadas por vírgula"
                  value={(q.options ?? []).join(", ")}
                  onChange={(e) => updateQ(q.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
            </div>
          ))}
        </div>

        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
      </CardContent>
    </Card>
  );
}

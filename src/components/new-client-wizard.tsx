import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { local: "Local", perpetuo: "Perpétuo", lancamento: "Lançamento", autoria: "Autoria" };

type Plan = { id: string; name: string; kind: string; amount: number | null; active: boolean };
type Tier = { id: string; min_revenue: number; max_revenue: number | null; pct: number; label: string | null };
type Niche = { id: string; name: string };
type Template = { id: string; niche_id: string; name: string };
type Profile = { id: string; full_name: string | null };

export function NewClientWizard({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [form, setForm] = useState({
    name: "", type: "local",
    niche_id: "", onboarding_template_id: "",
    platform: "", site: "", city_uf: "", address: "", brand_anniversary: "",
    instagram: "",
    responsavel_nome: "", responsavel_telefone: "", responsavel_email: "",
    performance_user_id: "", cs_user_id: "",
    plan_id: "",
    contract_start: "", contract_end: "",
    monthly_fee_amount: "", monthly_fee_day: "5",
    primeiro_vencimento: "", tempo_contrato_meses: "12", investimento_mensal: "",
    launch_commission_pct: "",
    optimization_frequency: "2s",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [p, t, n, tmpl, pr] = await Promise.all([
        supabase.from("plans").select("id,name,kind,amount,active").eq("active", true).order("name"),
        supabase.from("commission_tiers").select("id,min_revenue,max_revenue,pct,label").order("min_revenue"),
        supabase.from("niches").select("id,name").order("name"),
        supabase.from("onboarding_templates").select("id,niche_id,name").order("name"),
        supabase.from("profiles").select("id,full_name").order("full_name"),
      ]);
      setPlans((p.data ?? []) as Plan[]);
      setTiers((t.data ?? []) as Tier[]);
      setNiches((n.data ?? []) as Niche[]);
      setTemplates((tmpl.data ?? []) as Template[]);
      setProfiles((pr.data ?? []) as Profile[]);
    })();
  }, [open]);

  function reset() {
    setStep(0); setBusy(false);
    setForm({
      name: "", type: "local", niche_id: "", onboarding_template_id: "", platform: "", site: "", city_uf: "",
      address: "", brand_anniversary: "", instagram: "",
      responsavel_nome: "", responsavel_telefone: "", responsavel_email: "",
      performance_user_id: "", cs_user_id: "", plan_id: "",
      contract_start: "", contract_end: "", monthly_fee_amount: "", monthly_fee_day: "5",
      primeiro_vencimento: "", tempo_contrato_meses: "12", investimento_mensal: "",
      launch_commission_pct: "", optimization_frequency: "2s", notes: "",
    });
  }

  const isLaunch = form.type === "lancamento";
  const filteredPlans = useMemo(() => {
    if (isLaunch) return plans.filter((p) => p.kind === "lancamento");
    if (form.type === "autoria") return plans.filter((p) => p.kind === "autoria" || p.kind === "mensal");
    return plans.filter((p) => p.kind === "mensal" || p.kind === "outro" || !p.kind);
  }, [plans, form.type, isLaunch]);

  const filteredTemplates = useMemo(
    () => (form.niche_id ? templates.filter((t) => t.niche_id === form.niche_id) : []),
    [templates, form.niche_id]
  );

  function pickPlan(id: string) {
    const p = plans.find((x) => x.id === id);
    setForm((f) => ({ ...f, plan_id: id, monthly_fee_amount: p?.amount ? String(p.amount) : f.monthly_fee_amount }));
  }

  const steps = ["Cadastro", "Briefing (BI)", "Responsáveis", "Contrato", isLaunch ? "Comissão" : "Financeiro", "Revisão"];

  function canNext(): boolean {
    if (step === 0) return !!form.name.trim() && !!form.type;
    return true;
  }

  async function submit() {
    if (!user) return;
    setBusy(true);
    const { data: client, error } = await supabase.from("clients").insert({
      name: form.name.trim(),
      type: form.type as any,
      niche_id: form.niche_id || null,
      onboarding_template_id: form.onboarding_template_id || null,
      platform: form.platform || null,
      site: form.site || null,
      city_uf: form.city_uf || null,
      address: form.address || null,
      brand_anniversary: form.brand_anniversary || null,
      instagram: form.instagram || null,
      responsavel_nome: form.responsavel_nome || null,
      responsavel_telefone: form.responsavel_telefone || null,
      responsavel_email: form.responsavel_email || null,
      primeiro_vencimento: form.primeiro_vencimento || null,
      tempo_contrato_meses: form.tempo_contrato_meses ? Number(form.tempo_contrato_meses) : null,
      investimento_mensal: form.investimento_mensal ? Number(form.investimento_mensal) : null,
      performance_user_id: form.performance_user_id || null,
      cs_user_id: form.cs_user_id || null,
      plan_id: form.plan_id || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      monthly_fee_amount: form.monthly_fee_amount ? Number(form.monthly_fee_amount) : null,
      monthly_fee_day: form.monthly_fee_day ? Number(form.monthly_fee_day) : null,
      launch_commission_pct: isLaunch && form.launch_commission_pct ? Number(form.launch_commission_pct) : null,
      optimization_frequency: form.optimization_frequency || null,
      notes: form.notes || null,
      created_by: user.id,
      status: "onboarding",
    }).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }

    // Copy onboarding template stages + tasks (para a página do cliente)
    // e criar 1 CARD por etapa no Kanban de Operações com as tarefas como CHECKLIST.
    if (form.onboarding_template_id) {
      const [{ data: tStages }, { data: tTasks }] = await Promise.all([
        supabase.from("onboarding_template_stages").select("id,name,position,prazo_dias").eq("template_id", form.onboarding_template_id).order("position"),
        supabase.from("onboarding_template_tasks").select("id,stage_id,title,description,position,prazo_dias").order("position"),
      ]);
      const stageMap = new Map<string, string>();
      if (tStages && tStages.length) {
        const { data: created } = await supabase.from("client_onboarding_stages")
          .insert(tStages.map((s: any) => ({ client_id: client.id, name: s.name, position: s.position })))
          .select("id,name,position");
        (created ?? []).forEach((cs: any) => {
          const src = tStages.find((s: any) => s.name === cs.name && s.position === cs.position);
          if (src) stageMap.set(src.id, cs.id);
        });
      }
      const stageIds = new Set(stageMap.keys());
      const relevantTasks = (tTasks ?? []).filter((tt: any) => stageIds.has(tt.stage_id));
      if (relevantTasks.length) {
        await supabase.from("onboarding_tasks").insert(relevantTasks.map((tt: any) => ({
          client_id: client.id,
          stage_id: stageMap.get(tt.stage_id),
          title: tt.title,
          description: tt.description,
          position: tt.position,
          created_by: user.id,
        })));
      }

      // Kanban: 1 card por etapa, checklist com as tarefas.
      const baseDate = form.contract_start ? new Date(form.contract_start + "T00:00:00") : new Date();
      for (let i = 0; i < (tStages ?? []).length; i++) {
        const stg: any = (tStages as any[])[i];
        const due = stg.prazo_dias
          ? new Date(baseDate.getTime() + Number(stg.prazo_dias) * 86400000).toISOString().slice(0, 10)
          : null;
        const { data: tk, error: terr } = await supabase.from("tasks").insert({
          title: `Onboarding · ${stg.name}`,
          description: `Etapa do onboarding do cliente ${form.name}.`,
          status: "todo",
          priority: "media",
          kind: "kickoff",
          client_id: client.id,
          assignee_id: form.performance_user_id || form.cs_user_id || user.id,
          created_by: user.id,
          due_date: due,
          position: i,
        }).select("id").single();
        if (terr || !tk) continue;
        const items = (tTasks ?? []).filter((tt: any) => tt.stage_id === stg.id)
          .map((tt: any, idx: number) => ({ task_id: tk.id, title: tt.title, position: idx }));
        if (items.length) await supabase.from("task_checklist_items").insert(items);
      }
    }

    // Auto-generate mensalidades
    if (!isLaunch && form.monthly_fee_amount && Number(form.monthly_fee_amount) > 0) {
      const amount = Number(form.monthly_fee_amount);
      const day = Math.min(Math.max(Number(form.monthly_fee_day) || 5, 1), 28);
      const start = form.contract_start ? new Date(form.contract_start + "T00:00:00") : new Date();
      const end = form.contract_end ? new Date(form.contract_end + "T00:00:00") : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
      const fees: any[] = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= endCursor) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        const ref = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const due = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        fees.push({ client_id: client.id, reference_month: ref, due_date: due, amount });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      if (fees.length) await supabase.from("monthly_fees").insert(fees);
    }

    await supabase.from("client_activities").insert({
      client_id: client.id, user_id: user.id,
      action: "Cliente criado", description: `Tipo: ${TYPE_LABEL[form.type]}${form.monthly_fee_amount ? ` · Mensalidades geradas` : ""}`,
      entity_type: "client", entity_id: client.id,
    });

    setBusy(false);
    toast.success("Cliente criado!");
    onCreated?.();
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Novo cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <div className="flex items-center gap-2 pt-3">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  i < step && "bg-primary text-primary-foreground",
                  i === step && "bg-primary/20 text-primary border border-primary",
                  i > step && "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className={cn("text-xs font-medium flex-1", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</div>
                {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-[280px] py-2 max-h-[60vh] overflow-y-auto pr-1">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome / Marca *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, plan_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="perpetuo">Perpétuo</SelectItem>
                    <SelectItem value="lancamento">Lançamento</SelectItem>
                    <SelectItem value="autoria">Autoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nicho</Label>
                <Select value={form.niche_id} onValueChange={(v) => setForm({ ...form, niche_id: v, onboarding_template_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {niches.length === 0 && <div className="p-2 text-xs text-muted-foreground">Cadastre nichos em Ajustes.</div>}
                    {niches.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template de onboarding</Label>
                <Select value={form.onboarding_template_id} onValueChange={(v) => setForm({ ...form, onboarding_template_id: v })} disabled={!form.niche_id}>
                  <SelectTrigger><SelectValue placeholder={form.niche_id ? "Selecione" : "Escolha o nicho antes"} /></SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum template para este nicho.</div>}
                    {filteredTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Shopify, WooCommerce…" />
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="marca.com.br" />
              </div>
              <div className="space-y-2">
                <Label>Cidade/UF</Label>
                <Input value={form.city_uf} onChange={(e) => setForm({ ...form, city_uf: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Aniversário da marca</Label>
                <Input type="date" value={form.brand_anniversary} onChange={(e) => setForm({ ...form, brand_anniversary: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Responsável pelo contrato (nome)</Label>
                <Input value={form.responsavel_nome} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} placeholder="Nome do decisor" />
              </div>
              <div className="space-y-2">
                <Label>Telefone do responsável</Label>
                <Input value={form.responsavel_telefone} onChange={(e) => setForm({ ...form, responsavel_telefone: e.target.value })} placeholder="(11) 90000-0000" />
              </div>
              <div className="space-y-2">
                <Label>E-mail do responsável</Label>
                <Input type="email" value={form.responsavel_email} onChange={(e) => setForm({ ...form, responsavel_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Instagram do cliente</Label>
                <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@marca" />
              </div>
              <div className="space-y-2">
                <Label>Investimento mensal em mídia (R$)</Label>
                <Input type="number" step="0.01" value={form.investimento_mensal} onChange={(e) => setForm({ ...form, investimento_mensal: e.target.value })} />
              </div>
              <div className="col-span-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Estes dados compõem o <b>BI (briefing interno)</b> do cliente e ficam disponíveis na página do cliente.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável Performance</Label>
                <Select value={form.performance_user_id} onValueChange={(v) => setForm({ ...form, performance_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "—"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável CS</Label>
                <Select value={form.cs_user_id} onValueChange={(v) => setForm({ ...form, cs_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "—"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Plano contratado</Label>
                {filteredPlans.length === 0 ? (
                  <div className="text-sm text-muted-foreground rounded-md border p-3">
                    Nenhum plano cadastrado para este tipo. Cadastre em <b>Ajustes → Planos</b>.
                  </div>
                ) : (
                  <Select value={form.plan_id} onValueChange={pickPlan}>
                    <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                    <SelectContent>
                      {filteredPlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.amount ? `— ${brl(Number(p.amount))}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2"><Label>Início do contrato</Label><Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fim do contrato</Label><Input type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} /></div>
              <div className="space-y-2"><Label>Tempo do contrato (meses)</Label><Input type="number" min="1" value={form.tempo_contrato_meses} onChange={(e) => setForm({ ...form, tempo_contrato_meses: e.target.value })} /></div>
              <div className="space-y-2"><Label>1º vencimento</Label><Input type="date" value={form.primeiro_vencimento} onChange={(e) => setForm({ ...form, primeiro_vencimento: e.target.value })} /></div>
            </div>
          )}

          {step === 4 && !isLaunch && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Mensalidade (R$)</Label><Input type="number" step="0.01" value={form.monthly_fee_amount} onChange={(e) => setForm({ ...form, monthly_fee_amount: e.target.value })} />{form.plan_id && <p className="text-xs text-muted-foreground">Preenchido pelo plano — pode ajustar.</p>}</div>
              <div className="space-y-2"><Label>Dia de vencimento</Label><Input type="number" min="1" max="31" value={form.monthly_fee_day} onChange={(e) => setForm({ ...form, monthly_fee_day: e.target.value })} /></div>
              <div className="col-span-2 rounded-md border bg-muted/30 p-3 text-xs">
                Valor total do contrato:{" "}
                <b>{brl((Number(form.monthly_fee_amount) || 0) * (Number(form.tempo_contrato_meses) || 0))}</b>
              </div>
              <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          )}

          {step === 4 && isLaunch && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>% de comissão negociada</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" className="max-w-[140px]" value={form.launch_commission_pct} onChange={(e) => setForm({ ...form, launch_commission_pct: e.target.value })} placeholder="Ex: 15" />
                  <span className="text-sm text-muted-foreground">% sobre o faturamento</span>
                </div>
              </div>
              <div className="rounded-md border">
                <div className="px-3 py-2 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tabela padrão (clique para aplicar)</div>
                <div className="divide-y">
                  {tiers.length === 0 && <div className="p-3 text-sm text-muted-foreground">Cadastre em Ajustes → Comissão.</div>}
                  {tiers.map((t) => (
                    <button key={t.id} type="button" onClick={() => setForm({ ...form, launch_commission_pct: String(t.pct) })}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left">
                      <span>{t.label || `${brl(t.min_revenue)} — ${t.max_revenue ? brl(t.max_revenue) : "∞"}`}</span>
                      <Badge variant="secondary">{t.pct}%</Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <ReviewRow k="Nome" v={form.name} />
              <ReviewRow k="Tipo" v={TYPE_LABEL[form.type]} />
              <ReviewRow k="Nicho" v={niches.find((n) => n.id === form.niche_id)?.name || "—"} />
              <ReviewRow k="Template onboarding" v={templates.find((t) => t.id === form.onboarding_template_id)?.name || "—"} />
              <ReviewRow k="Responsável" v={[form.responsavel_nome, form.responsavel_telefone, form.responsavel_email].filter(Boolean).join(" · ") || "—"} />
              <ReviewRow k="Instagram" v={form.instagram || "—"} />
              <ReviewRow k="Performance / CS" v={`${profiles.find((p) => p.id === form.performance_user_id)?.full_name || "—"} · ${profiles.find((p) => p.id === form.cs_user_id)?.full_name || "—"}`} />
              <ReviewRow k="Site / Cidade" v={[form.site, form.city_uf].filter(Boolean).join(" · ") || "—"} />
              <ReviewRow k="Plano" v={plans.find((p) => p.id === form.plan_id)?.name || "—"} />
              <ReviewRow k="Contrato" v={`${form.contract_start || "—"} → ${form.contract_end || "—"} (${form.tempo_contrato_meses || "—"} meses)`} />
              <ReviewRow k="Investimento mensal" v={form.investimento_mensal ? brl(Number(form.investimento_mensal)) : "—"} />
              {!isLaunch
                ? <ReviewRow k="Mensalidade" v={form.monthly_fee_amount ? `${brl(Number(form.monthly_fee_amount))} · vence dia ${form.monthly_fee_day}` : "—"} />
                : <ReviewRow k="Comissão" v={form.launch_commission_pct ? `${form.launch_commission_pct}%` : "—"} />}
              <ReviewRow k="Valor total" v={brl((Number(form.monthly_fee_amount) || 0) * (Number(form.tempo_contrato_meses) || 0))} />
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Criar cliente"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

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

const ONBOARDING_TEMPLATES: Record<string, string[]> = {
  local: ["Kickoff realizado", "Acesso ao Google Ads", "Acesso ao Meta Business", "Pixel/Tag Manager instalado", "Configurar Google Meu Negócio", "Aprovar primeira campanha"],
  perpetuo: ["Kickoff realizado", "Acesso à plataforma de e-com", "Acesso ao Meta Business e Google Ads", "Catálogo e feed configurados", "Pixel + eventos de conversão", "Aprovar plano de mídia mês 1"],
  lancamento: ["Reunião de estratégia do lançamento", "Definição de datas (CPL, aula, carrinho)", "Estrutura de captação no ar", "Pixel e eventos configurados", "Aprovar criativos de captação", "Aprovar página de vendas"],
  autoria: ["Reunião de descoberta", "Definição de posicionamento", "Estrutura de funil validada", "Página de captura no ar", "Sequência de e-mail ativa", "Primeira campanha aprovada"],
};

export function NewClientWizard({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);

  const [form, setForm] = useState({
    name: "", type: "local",
    niche: "", platform: "", site: "", city_uf: "",
    plan_id: "",
    contract_start: "", contract_end: "",
    monthly_fee_amount: "", monthly_fee_day: "5",
    launch_commission_pct: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("plans").select("id,name,kind,amount,active").eq("active", true).order("name"),
        supabase.from("commission_tiers").select("id,min_revenue,max_revenue,pct,label").order("min_revenue"),
      ]);
      setPlans((p ?? []) as Plan[]);
      setTiers((t ?? []) as Tier[]);
    })();
  }, [open]);

  function reset() {
    setStep(0); setBusy(false);
    setForm({ name: "", type: "local", niche: "", platform: "", site: "", city_uf: "", plan_id: "", contract_start: "", contract_end: "", monthly_fee_amount: "", monthly_fee_day: "5", launch_commission_pct: "", notes: "" });
  }

  const isLaunch = form.type === "lancamento";
  const filteredPlans = useMemo(() => {
    if (isLaunch) return plans.filter((p) => p.kind === "lancamento");
    if (form.type === "autoria") return plans.filter((p) => p.kind === "autoria" || p.kind === "mensal");
    return plans.filter((p) => p.kind === "mensal" || p.kind === "outro" || !p.kind);
  }, [plans, form.type, isLaunch]);

  function pickPlan(id: string) {
    const p = plans.find((x) => x.id === id);
    setForm((f) => ({ ...f, plan_id: id, monthly_fee_amount: p?.amount ? String(p.amount) : f.monthly_fee_amount }));
  }

  const steps = ["Cadastro", "Contrato", isLaunch ? "Comissão" : "Financeiro", "Revisão"];

  function canNext(): boolean {
    if (step === 0) return !!form.name.trim() && !!form.type;
    if (step === 1) return true;
    return true;
  }

  async function submit() {
    if (!user) return;
    setBusy(true);
    const { data: client, error } = await supabase.from("clients").insert({
      name: form.name.trim(),
      type: form.type as any,
      niche: form.niche || null,
      platform: form.platform || null,
      site: form.site || null,
      city_uf: form.city_uf || null,
      plan_id: form.plan_id || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      monthly_fee_amount: form.monthly_fee_amount ? Number(form.monthly_fee_amount) : null,
      monthly_fee_day: form.monthly_fee_day ? Number(form.monthly_fee_day) : null,
      launch_commission_pct: isLaunch && form.launch_commission_pct ? Number(form.launch_commission_pct) : null,
      notes: form.notes || null,
      created_by: user.id,
      status: "onboarding",
    }).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }

    const tpl = ONBOARDING_TEMPLATES[form.type] || [];
    if (tpl.length) {
      await supabase.from("onboarding_tasks").insert(tpl.map((title, i) => ({ client_id: client.id, title, position: i })));
    }
    // Auto-generate mensalidades a partir do contrato (só para tipos recorrentes com valor)
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

        <div className="min-h-[280px] py-2">
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
                <Input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Shopify, WooCommerce…" />
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="marca.com.br" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Cidade/UF</Label>
                <Input value={form.city_uf} onChange={(e) => setForm({ ...form, city_uf: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && (
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
                          {p.name} {p.amount ? `— R$ ${Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Início do contrato</Label>
                <Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fim do contrato</Label>
                <Input type="date" value={form.contract_end} onChange={(e) => setForm({ ...form, contract_end: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && !isLaunch && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mensalidade (R$)</Label>
                <Input type="number" step="0.01" value={form.monthly_fee_amount} onChange={(e) => setForm({ ...form, monthly_fee_amount: e.target.value })} />
                {form.plan_id && <p className="text-xs text-muted-foreground">Preenchido pelo plano — pode ajustar.</p>}
              </div>
              <div className="space-y-2">
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="31" value={form.monthly_fee_day} onChange={(e) => setForm({ ...form, monthly_fee_day: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && isLaunch && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>% de comissão negociada</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.01" className="max-w-[140px]" value={form.launch_commission_pct}
                    onChange={(e) => setForm({ ...form, launch_commission_pct: e.target.value })} placeholder="Ex: 15" />
                  <span className="text-sm text-muted-foreground">% sobre o faturamento do lançamento</span>
                </div>
              </div>
              <div className="rounded-md border">
                <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tabela padrão</div>
                  <div className="text-[11px] text-muted-foreground">Clique para aplicar</div>
                </div>
                <div className="divide-y">
                  {tiers.length === 0 && <div className="p-3 text-sm text-muted-foreground">Cadastre em Ajustes → Comissão.</div>}
                  {tiers.map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => setForm({ ...form, launch_commission_pct: String(t.pct) })}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left">
                      <span>{t.label || `${brl(t.min_revenue)} — ${t.max_revenue ? brl(t.max_revenue) : "∞"}`}</span>
                      <Badge variant="secondary">{t.pct}%</Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <ReviewRow k="Nome" v={form.name} />
              <ReviewRow k="Tipo" v={TYPE_LABEL[form.type]} />
              <ReviewRow k="Nicho / Plataforma" v={[form.niche, form.platform].filter(Boolean).join(" · ") || "—"} />
              <ReviewRow k="Site / Cidade" v={[form.site, form.city_uf].filter(Boolean).join(" · ") || "—"} />
              <ReviewRow k="Plano" v={plans.find((p) => p.id === form.plan_id)?.name || "—"} />
              <ReviewRow k="Contrato" v={`${form.contract_start || "—"} → ${form.contract_end || "—"}`} />
              {!isLaunch
                ? <ReviewRow k="Mensalidade" v={form.monthly_fee_amount ? `${brl(Number(form.monthly_fee_amount))} · vence dia ${form.monthly_fee_day}` : "—"} />
                : <ReviewRow k="Comissão" v={form.launch_commission_pct ? `${form.launch_commission_pct}%` : "—"} />}
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

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

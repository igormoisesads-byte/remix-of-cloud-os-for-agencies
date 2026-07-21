import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajustes/planos")({
  component: PlansPage,
});

type Plan = { id: string; name: string; kind: string; amount: number | null; description: string | null; active: boolean };

const KIND_LABEL: Record<string, string> = { mensal: "Mensal", lancamento: "Lançamento", autoria: "Autoria", outro: "Outro" };
const fmtBRL = (n: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

function PlansPage() {
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Planos & Produtos</h2>
          <p className="text-sm text-muted-foreground mt-1">Cadastre os planos e produtos que sua agência oferece.</p>
        </div>
        <PlanDialog onSaved={() => qc.invalidateQueries({ queryKey: ["plans"] })} />
      </div>

      <Card>
        <CardContent className="p-0">
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
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>}
              {!isLoading && (plans ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum plano cadastrado.</TableCell></TableRow>
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
    </div>
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

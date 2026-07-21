import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajustes/comissao")({
  component: ComissaoPage,
});

type Tier = { id: string; min_revenue: number; max_revenue: number | null; pct: number; label: string | null };

const fmtBRL = (n: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

function ComissaoPage() {
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tabela de comissão</h2>
          <p className="text-sm text-muted-foreground mt-1">Faixas de faturamento × % — usada como referência ao cadastrar clientes de lançamento.</p>
        </div>
        <TierDialog onSaved={() => qc.invalidateQueries({ queryKey: ["tiers"] })} />
      </div>

      <Card>
        <CardContent className="p-0">
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
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>}
              {!isLoading && (tiers ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem faixas cadastradas.</TableCell></TableRow>
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
    </div>
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

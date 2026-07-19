import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientesList,
});

const TYPE_LABEL: Record<string, string> = { local: "Local", perpetuo: "Perpétuo", autoria: "Autoria" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ativo: "default", pausado: "outline", onboarding: "secondary", churn: "destructive",
};

function ClientesList() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, type, status, niche, platform, site, monthly_fee_amount, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">Carteira, contratos e status.</p>
        </div>
        <NewClientDialog />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Nenhum cliente cadastrado. Comece adicionando o primeiro.
                </TableCell></TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/clientes/$id" params={{ id: c.id }} className="font-medium hover:text-primary">
                      {c.name}
                    </Link>
                    {c.site && <div className="text-xs text-muted-foreground">{c.site}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[c.type]}</Badge></TableCell>
                  <TableCell className="text-sm">{c.niche || "—"}</TableCell>
                  <TableCell className="text-sm">{c.platform || "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">
                    {c.monthly_fee_amount ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.monthly_fee_amount)) : "—"}
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

function NewClientDialog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "local", niche: "", platform: "", site: "",
    city_uf: "", monthly_fee_amount: "", monthly_fee_day: "5", contract_start: "", notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data: client, error } = await supabase.from("clients").insert({
      name: form.name.trim(),
      type: form.type as any,
      niche: form.niche || null,
      platform: form.platform || null,
      site: form.site || null,
      city_uf: form.city_uf || null,
      contract_start: form.contract_start || null,
      monthly_fee_amount: form.monthly_fee_amount ? Number(form.monthly_fee_amount) : null,
      monthly_fee_day: form.monthly_fee_day ? Number(form.monthly_fee_day) : null,
      notes: form.notes || null,
      created_by: user.id,
      status: "onboarding",
    }).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }

    // seed onboarding tasks by type
    const templates: Record<string, string[]> = {
      local: [
        "Kickoff realizado",
        "Acesso ao Google Ads",
        "Acesso ao Meta Business",
        "Pixel/Tag Manager instalado",
        "Configurar Google Meu Negócio",
        "Aprovar primeira campanha",
      ],
      perpetuo: [
        "Kickoff realizado",
        "Acesso à plataforma de e-com",
        "Acesso ao Meta Business e Google Ads",
        "Catálogo e feed configurados",
        "Pixel + eventos de conversão",
        "Aprovar plano de mídia mês 1",
      ],
      autoria: [
        "Reunião de descoberta",
        "Definição de posicionamento",
        "Estrutura de funil validada",
        "Página de captura no ar",
        "Sequência de e-mail ativa",
        "Primeira campanha aprovada",
      ],
    };
    const tasks = (templates[form.type] || []).map((title, i) => ({ client_id: client.id, title, position: i }));
    if (tasks.length) await supabase.from("onboarding_tasks").insert(tasks);
    await supabase.from("client_activities").insert({ client_id: client.id, user_id: user.id, action: "Cliente criado", description: `Tipo: ${TYPE_LABEL[form.type]}` });

    setBusy(false); setOpen(false); toast.success("Cliente criado!");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Novo cliente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Nome / Marca *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="perpetuo">Perpétuo</SelectItem>
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
            <div className="space-y-2">
              <Label>Cidade/UF</Label>
              <Input value={form.city_uf} onChange={(e) => setForm({ ...form, city_uf: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Início do contrato</Label>
              <Input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mensalidade (R$)</Label>
              <Input type="number" step="0.01" value={form.monthly_fee_amount} onChange={(e) => setForm({ ...form, monthly_fee_amount: e.target.value })} />
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
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Criar cliente"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

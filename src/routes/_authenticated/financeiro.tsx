import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Check, Search, X, AlertTriangle, Plus, Trash2, Repeat, Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
  head: () => ({
    meta: [
      { title: "Financeiro · CloudOS" },
      { name: "description", content: "Mensalidades, despesas recorrentes e planejamento financeiro da agência." },
    ],
  }),
});

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function today0() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }

function FinanceiroPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Mensalidades, despesas e planejamento da agência.</p>
      </div>

      <OverviewCards />

      <Tabs defaultValue="mensalidades">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="mensalidades">Mensalidades</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
        </TabsList>
        <TabsContent value="mensalidades" className="mt-4"><FeesTab /></TabsContent>
        <TabsContent value="despesas" className="mt-4"><ExpensesTab /></TabsContent>
        <TabsContent value="planejamento" className="mt-4"><PlanningTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============= Overview =============
function OverviewCards() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data } = useQuery({
    queryKey: ["fin-overview-month", monthStart],
    queryFn: async () => {
      const [f, e] = await Promise.all([
        supabase.from("monthly_fees").select("amount,status,due_date,paid_at").gte("due_date", monthStart).lte("due_date", monthEnd),
        supabase.from("expenses").select("amount,status,due_date,paid_at").gte("due_date", monthStart).lte("due_date", monthEnd),
      ]);
      return { fees: f.data ?? [], expenses: e.data ?? [] };
    },
  });

  const receita = (data?.fees ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
  const recebido = (data?.fees ?? []).filter((r: any) => r.status === "pago").reduce((s, r: any) => s + Number(r.amount), 0);
  const despesas = (data?.expenses ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
  const despesasPagas = (data?.expenses ?? []).filter((r: any) => r.status === "pago").reduce((s, r: any) => s + Number(r.amount), 0);
  const lucroPrev = receita - despesas;
  const lucroReal = recebido - despesasPagas;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card><CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Receita do mês</div>
        <div className="text-2xl font-bold mt-1">{fmtBRL(receita)}</div>
        <div className="text-xs text-muted-foreground">Recebido: <span className="text-emerald-600 font-medium">{fmtBRL(recebido)}</span></div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Despesas do mês</div>
        <div className="text-2xl font-bold mt-1 text-red-600">{fmtBRL(despesas)}</div>
        <div className="text-xs text-muted-foreground">Pago: {fmtBRL(despesasPagas)}</div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">Lucro previsto</div>
        <div className={`text-2xl font-bold mt-1 ${lucroPrev >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtBRL(lucroPrev)}</div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">Lucro realizado</div>
        <div className={`text-2xl font-bold mt-1 ${lucroReal >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtBRL(lucroReal)}</div>
      </CardContent></Card>
    </div>
  );
}

// ============= Mensalidades =============
function FeesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openFee, setOpenFee] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data } = useQuery({
    queryKey: ["financeiro-fees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_fees")
        .select("id, reference_month, due_date, amount, status, paid_at, paid_amount, notes, client_id, clients(name)")
        .order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const t0 = today0();

  const monthOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r: any) => s.add(monthKey(r.reference_month)));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((f: any) => {
    const eff = f.status === "pendente" && new Date(f.due_date) < t0 ? "atrasado" : f.status;
    if (status !== "all" && eff !== status) return false;
    if (month !== "all" && monthKey(f.reference_month) !== month) return false;
    if (search && !(f.clients?.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, search, status, month]);

  const total = filtered.reduce((s, f: any) => s + Number(f.amount), 0);
  const pago = filtered.filter((f: any) => f.status === "pago").reduce((s, f: any) => s + Number(f.amount), 0);
  const atrasadoValor = filtered.filter((f: any) => f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < t0).reduce((s, f: any) => s + Number(f.amount), 0);
  const atrasadoQtd = filtered.filter((f: any) => f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < t0).length;

  function toggle(id: string) { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); }
  function toggleAll() { setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((f: any) => f.id))); }

  async function markPaid(ids: string[]) {
    const iso = new Date().toISOString();
    for (const f of filtered.filter((x: any) => ids.includes(x.id))) {
      await supabase.from("monthly_fees").update({ status: "pago", paid_at: iso, paid_amount: f.amount }).eq("id", f.id);
    }
    toast.success(`${ids.length} lançamento(s) marcado(s) como pago`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["financeiro-fees"] });
    qc.invalidateQueries({ queryKey: ["fin-overview-month"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }
  async function markOverdue() {
    const ids = filtered.filter((f: any) => f.status === "pendente" && new Date(f.due_date) < t0).map((f: any) => f.id);
    if (!ids.length) { toast.info("Nenhum vencido"); return; }
    await supabase.from("monthly_fees").update({ status: "atrasado" }).in("id", ids);
    toast.success(`${ids.length} marcado(s) como atrasado`);
    qc.invalidateQueries({ queryKey: ["financeiro-fees"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Lançado</div><div className="text-2xl font-bold">{fmtBRL(total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Recebido</div><div className="text-2xl font-bold text-emerald-600">{fmtBRL(pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">A receber</div><div className="text-2xl font-bold">{fmtBRL(total - pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Em atraso</div><div className="text-2xl font-bold text-red-600">{fmtBRL(atrasadoValor)}</div></CardContent></Card>
      </div>

      <FeesAnalytics fees={filtered} />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Mensalidades ({filtered.length})</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Nova mensalidade
              </Button>
              {atrasadoQtd > 0 && (
                <Button variant="outline" size="sm" onClick={markOverdue}>
                  <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-600" />Marcar {atrasadoQtd} vencido(s)
                </Button>
              )}
              {selected.size > 0 && (
                <Button size="sm" onClick={() => markPaid(Array.from(selected))}>
                  <Check className="h-4 w-4 mr-1.5" />Marcar {selected.size} como pago
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {monthOptions.map((m) => {
                  const [y, mo] = m.split("-");
                  const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
                  return <SelectItem key={m} value={m}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {(search || status !== "all" || month !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setStatus("all"); setMonth("all"); }}>
                <X className="h-4 w-4 mr-1" />Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {rows.length === 0 ? "Nenhuma mensalidade gerada." : "Nenhum lançamento com esses filtros."}
                  </TableCell></TableRow>
                )}
                {filtered.map((f: any) => {
                  const isOverdue = f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < t0;
                  const displayStatus = isOverdue && f.status === "pendente" ? "atrasado" : f.status;
                  return (
                    <TableRow key={f.id} className={`cursor-pointer ${selected.has(f.id) ? "bg-accent/40" : ""}`} onClick={() => setOpenFee(f)}>
                      <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} /></TableCell>
                      <TableCell className="font-medium">{f.clients?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{new Date(f.reference_month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</TableCell>
                      <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>{new Date(f.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{fmtBRL(Number(f.amount))}</TableCell>
                      <TableCell>
                        <Badge variant={displayStatus === "pago" ? "default" : displayStatus === "atrasado" ? "destructive" : displayStatus === "cancelado" ? "secondary" : "outline"}>{displayStatus}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FeeDetailDialog 
        fee={openFee} 
        onClose={() => setOpenFee(null)} 
        onSaved={() => { 
          qc.invalidateQueries({ queryKey: ["financeiro-fees"] }); 
          qc.invalidateQueries({ queryKey: ["fin-overview-month"] }); 
        }} 
      />
      
      <FeeAddDialog 
        open={showAddForm} 
        onOpenChange={setShowAddForm} 
        onSaved={() => { 
          qc.invalidateQueries({ queryKey: ["financeiro-fees"] }); 
          qc.invalidateQueries({ queryKey: ["fin-overview-month"] }); 
        }} 
      />
    </div>
  );
}

function FeeDetailDialog({ fee, onClose, onSaved }: { fee: any; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<string>(fee?.status ?? "pendente");
  const [amount, setAmount] = useState<string>(fee?.amount?.toString() ?? "");
  const [paidAmount, setPaidAmount] = useState<string>(fee?.paid_amount?.toString() ?? "");
  const [paidAt, setPaidAt] = useState<string>(fee?.paid_at?.slice(0, 10) ?? "");
  const [dueDate, setDueDate] = useState<string>(fee?.due_date ?? "");
  const [notes, setNotes] = useState<string>(fee?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Reset state when fee changes
  useMemo(() => {
    if (fee) {
      setStatus(fee.status); setAmount(String(fee.amount)); setPaidAmount(fee.paid_amount ? String(fee.paid_amount) : "");
      setPaidAt(fee.paid_at?.slice(0, 10) ?? ""); setDueDate(fee.due_date); setNotes(fee.notes ?? "");
    }
  }, [fee?.id]);

  if (!fee) return null;

  async function save() {
    setSaving(true);
    const patch: any = { status, amount: Number(amount), due_date: dueDate, notes: notes || null };
    if (status === "pago") {
      patch.paid_at = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();
      patch.paid_amount = paidAmount ? Number(paidAmount) : Number(amount);
    } else {
      patch.paid_at = null; patch.paid_amount = null;
    }
    const { error } = await supabase.from("monthly_fees").update(patch).eq("id", fee.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mensalidade atualizada");
    onSaved(); onClose();
  }

  return (
    <Dialog open={!!fee} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mensalidade · {fee.clients?.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">Referência: {new Date(fee.reference_month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Valor</label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vencimento</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === "pago" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Data de pagamento</label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor pago</label>
                <Input type="number" step="0.01" placeholder={amount} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Link to="/clientes/$id" params={{ id: fee.client_id }} className="text-xs text-primary hover:underline">Abrir painel do cliente →</Link>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={async () => {
            if (!confirm("Excluir esta mensalidade?")) return;
            setSaving(true);
            const { error } = await supabase.from("monthly_fees").delete().eq("id", fee.id);
            setSaving(false);
            if (error) { toast.error(error.message); return; }
            toast.success("Mensalidade excluída");
            onSaved(); onClose();
          }} disabled={saving}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeeAddDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) {
      (async () => {
        const { data } = await supabase.from("clients").select("id, name").order("name");
        setClients(data ?? []);
      })();
    }
  }, [open]);

  async function save() {
    if (!clientId || !amount || !dueDate || !referenceMonth) {
      toast.error("Preencha cliente, valor, vencimento e mês de referência");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("monthly_fees").insert({
      client_id: clientId,
      reference_month: referenceMonth.length === 7 ? referenceMonth + "-01" : referenceMonth,
      amount: Number(amount),
      due_date: dueDate,
      status: "pendente",
      notes: notes || null
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mensalidade cadastrada");
    onSaved();
    onOpenChange(false);
    // Reset local state
    setClientId(""); setAmount(""); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Mensalidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Cliente *</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Valor *</label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Referência *</label>
              <Input type="month" value={referenceMonth.slice(0, 7)} onChange={(e) => setReferenceMonth(e.target.value + "-01")} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Vencimento *</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Cadastrando…" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Despesas =============
function ExpensesTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);

  const { data } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const t0 = today0();

  const monthOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r: any) => s.add(monthKey(r.due_date)));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((e: any) => {
    const eff = e.status === "pendente" && new Date(e.due_date) < t0 ? "atrasado" : e.status;
    if (status !== "all" && eff !== status) return false;
    if (month !== "all" && monthKey(e.due_date) !== month) return false;
    if (search && !(e.description ?? "").toLowerCase().includes(search.toLowerCase()) && !(e.category ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, search, status, month]);

  const total = filtered.reduce((s, e: any) => s + Number(e.amount), 0);
  const pago = filtered.filter((e: any) => e.status === "pago").reduce((s, e: any) => s + Number(e.amount), 0);
  const atrasado = filtered.filter((e: any) => e.status !== "pago" && e.status !== "cancelado" && new Date(e.due_date) < t0).reduce((s, e: any) => s + Number(e.amount), 0);

  async function markPaid(id: string, amount: number) {
    await supabase.from("expenses").update({ status: "pago", paid_at: new Date().toISOString(), paid_amount: amount }).eq("id", id);
    toast.success("Despesa paga");
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["fin-overview-month"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Total</div><div className="text-2xl font-bold">{fmtBRL(total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Pago</div><div className="text-2xl font-bold text-emerald-600">{fmtBRL(pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">A pagar</div><div className="text-2xl font-bold">{fmtBRL(total - pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Em atraso</div><div className="text-2xl font-bold text-red-600">{fmtBRL(atrasado)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Despesas ({filtered.length})</CardTitle>
            <Button size="sm" onClick={() => { setEdit(null); setShowForm(true); }}><Plus className="h-4 w-4 mr-1.5" />Lançar despesa</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar descrição ou categoria…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {monthOptions.map((m) => {
                  const [y, mo] = m.split("-");
                  const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
                  return <SelectItem key={m} value={m}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma despesa. Clique em "Lançar despesa" para começar.</TableCell></TableRow>}
                {filtered.map((e: any) => {
                  const isOverdue = e.status !== "pago" && e.status !== "cancelado" && new Date(e.due_date) < t0;
                  const displayStatus = isOverdue && e.status === "pendente" ? "atrasado" : e.status;
                  return (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => { setEdit(e); setShowForm(true); }}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {e.recurrence !== "none" && <Repeat className="h-3.5 w-3.5 text-muted-foreground" />}
                          {e.description}
                        </div>
                        {e.vendor && <div className="text-xs text-muted-foreground">{e.vendor}</div>}
                      </TableCell>
                      <TableCell>{e.category ? <Badge variant="outline">{e.category}</Badge> : "—"}</TableCell>
                      <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>{new Date(e.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{fmtBRL(Number(e.amount))}</TableCell>
                      <TableCell><Badge variant={displayStatus === "pago" ? "default" : displayStatus === "atrasado" ? "destructive" : displayStatus === "cancelado" ? "secondary" : "outline"}>{displayStatus}</Badge></TableCell>
                      <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {e.status !== "pago" && e.status !== "cancelado" && (
                            <Button size="sm" variant="outline" onClick={() => markPaid(e.id, Number(e.amount))}><Check className="h-3.5 w-3.5" /></Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ExpenseFormDialog open={showForm} onOpenChange={setShowForm} expense={edit} userId={user?.id ?? null} onSaved={() => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["fin-overview-month"] }); }} />
    </div>
  );
}

function ExpenseFormDialog({ open, onOpenChange, expense, userId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; expense: any | null; userId: string | null; onSaved: () => void }) {
  const isEdit = !!expense;
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("pendente");
  const [recurrence, setRecurrence] = useState<string>("none");
  const [recurrenceDay, setRecurrenceDay] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) {
      if (expense) {
        setDescription(expense.description ?? ""); setCategory(expense.category ?? ""); setVendor(expense.vendor ?? "");
        setAmount(String(expense.amount ?? "")); setDueDate(expense.due_date ?? ""); setStatus(expense.status ?? "pendente");
        setRecurrence(expense.recurrence ?? "none"); setRecurrenceDay(expense.recurrence_day ? String(expense.recurrence_day) : "");
        setNotes(expense.notes ?? "");
      } else {
        setDescription(""); setCategory(""); setVendor(""); setAmount(""); setDueDate(new Date().toISOString().slice(0, 10));
        setStatus("pendente"); setRecurrence("none"); setRecurrenceDay(String(new Date().getDate())); setNotes("");
      }
    }
  }, [open, expense?.id]);

  async function save() {
    if (!description || !amount || !dueDate) { toast.error("Preencha descrição, valor e vencimento"); return; }
    setSaving(true);
    const payload: any = {
      description, category: category || null, vendor: vendor || null,
      amount: Number(amount), due_date: dueDate, status,
      recurrence, recurrence_day: recurrence !== "none" ? Number(recurrenceDay || new Date(dueDate).getDate()) : null,
      notes: notes || null,
    };
    if (status === "pago") { payload.paid_at = new Date().toISOString(); payload.paid_amount = Number(amount); }

    let err: any = null;
    if (isEdit) {
      ({ error: err } = await supabase.from("expenses").update(payload).eq("id", expense.id));
    } else {
      payload.created_by = userId;
      ({ error: err } = await supabase.from("expenses").insert(payload));
    }
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success(isEdit ? "Despesa atualizada" : "Despesa lançada");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar despesa" : "Lançar despesa"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Descrição *</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel, Salário, Ferramentas" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Infra, Pessoal, Marketing" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fornecedor</label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Ex: AWS, Google, João" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Valor *</label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vencimento *</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Recorrência</label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Única</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {recurrence === "monthly" && (
            <div>
              <label className="text-xs text-muted-foreground">Dia do mês</label>
              <Input type="number" min={1} max={31} value={recurrenceDay} onChange={(e) => setRecurrenceDay(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : isEdit ? "Salvar" : "Lançar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Planejamento (Recorrentes + Calendário) =============
function PlanningTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthStart = new Date(target.getFullYear(), target.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: recurring } = useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").neq("recurrence", "none").order("recurrence_day");
      return data ?? [];
    },
  });

  const { data: monthItems } = useQuery({
    queryKey: ["planning-month", monthStart],
    queryFn: async () => {
      const [f, e] = await Promise.all([
        supabase.from("monthly_fees").select("id,due_date,amount,status,clients(name)").gte("due_date", monthStart).lte("due_date", monthEnd),
        supabase.from("expenses").select("id,due_date,amount,status,description").gte("due_date", monthStart).lte("due_date", monthEnd),
      ]);
      return { fees: f.data ?? [], expenses: e.data ?? [] };
    },
  });

  const totalRecurring = (recurring ?? []).reduce((s: number, e: any) => s + Number(e.amount) * (e.recurrence === "annual" ? 1 / 12 : 1), 0);

  const days = useMemo(() => {
    const map = new Map<string, { in: number; out: number; items: { label: string; kind: "in" | "out"; amount: number; status: string }[] }>();
    for (const f of monthItems?.fees ?? []) {
      const k = f.due_date;
      if (!map.has(k)) map.set(k, { in: 0, out: 0, items: [] });
      const e = map.get(k)!; e.in += Number(f.amount);
      e.items.push({ label: (f as any).clients?.name ?? "Mensalidade", kind: "in", amount: Number(f.amount), status: f.status });
    }
    for (const x of monthItems?.expenses ?? []) {
      const k = x.due_date;
      if (!map.has(k)) map.set(k, { in: 0, out: 0, items: [] });
      const e = map.get(k)!; e.out += Number(x.amount);
      e.items.push({ label: x.description, kind: "out", amount: Number(x.amount), status: x.status });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [monthItems]);

  async function generateThisMonth() {
    if (!recurring?.length) { toast.info("Nenhuma recorrência cadastrada"); return; }
    let created = 0, skipped = 0;
    for (const r of recurring) {
      if (r.recurrence !== "monthly") continue;
      const day = Math.min(r.recurrence_day ?? new Date(r.due_date).getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
      const due = new Date(target.getFullYear(), target.getMonth(), day).toISOString().slice(0, 10);
      const { data: existing } = await supabase.from("expenses").select("id").eq("parent_id", r.id).eq("due_date", due).maybeSingle();
      if (existing) { skipped++; continue; }
      const { error } = await supabase.from("expenses").insert({
        description: r.description, category: r.category, vendor: r.vendor,
        amount: r.amount, due_date: due, status: "pendente",
        recurrence: "none", parent_id: r.id, notes: r.notes,
      });
      if (!error) created++;
    }
    toast.success(`${created} despesa(s) criada(s)${skipped ? `, ${skipped} já existia(m)` : ""}`);
    qc.invalidateQueries({ queryKey: ["planning-month"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  const monthLabel = target.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4" /> Despesas recorrentes</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Modelos que geram lançamentos a cada mês.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Custo mensal recorrente</div>
            <div className="text-xl font-bold">{fmtBRL(totalRecurring)}</div>
          </div>
        </CardHeader>
        <CardContent>
          {!recurring?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma recorrência. Ao lançar uma despesa, marque "Recorrência: Mensal" para que apareça aqui.
            </p>
          ) : (
            <div className="space-y-2">
              {recurring.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <div className="font-medium text-sm">{r.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.category ? `${r.category} · ` : ""}
                      {r.recurrence === "monthly" ? `Todo dia ${r.recurrence_day ?? "?"}` : "Anual"}
                      {r.vendor ? ` · ${r.vendor}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{fmtBRL(Number(r.amount))}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Agenda de {monthLabel}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Datas de recebimento e pagamento do mês.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMonthOffset(monthOffset - 1)}>←</Button>
              <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>Hoje</Button>
              <Button variant="outline" size="sm" onClick={() => setMonthOffset(monthOffset + 1)}>→</Button>
              <Button size="sm" onClick={generateThisMonth}>Gerar recorrentes deste mês</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!days.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento neste mês.</p>
          ) : (
            <div className="space-y-2">
              {days.map(([date, agg]) => (
                <div key={date} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{new Date(date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</div>
                    <div className="flex gap-3 text-xs">
                      {agg.in > 0 && <span className="text-emerald-600 font-medium">+ {fmtBRL(agg.in)}</span>}
                      {agg.out > 0 && <span className="text-red-600 font-medium">− {fmtBRL(agg.out)}</span>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {agg.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${it.kind === "in" ? "bg-emerald-500" : "bg-red-500"}`} />
                          {it.label}
                          {it.status === "pago" && <Badge variant="outline" className="h-4 px-1 text-[10px]">pago</Badge>}
                        </span>
                        <span className={it.kind === "in" ? "text-emerald-600" : "text-red-600"}>{fmtBRL(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

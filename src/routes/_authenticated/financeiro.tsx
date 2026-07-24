import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Search, X, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
  head: () => ({
    meta: [
      { title: "Financeiro · CloudOS" },
      { name: "description", content: "Mensalidades, recebimentos e inadimplência dos clientes." },
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

function FinanceiroPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["financeiro-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_fees")
        .select("id, reference_month, due_date, amount, status, paid_at, client_id, clients(name)")
        .order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const rows = data ?? [];

  const monthOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r: any) => s.add(monthKey(r.reference_month)));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter((f: any) => {
      const effectiveStatus =
        f.status === "pendente" && new Date(f.due_date) < today ? "atrasado" : f.status;
      if (status !== "all" && effectiveStatus !== status) return false;
      if (month !== "all" && monthKey(f.reference_month) !== month) return false;
      if (search && !(f.clients?.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, status, month]);

  const total = filtered.reduce((s, f: any) => s + Number(f.amount), 0);
  const pago = filtered.filter((f: any) => f.status === "pago").reduce((s, f: any) => s + Number(f.amount), 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const atrasadoValor = filtered
    .filter((f: any) => f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < today)
    .reduce((s, f: any) => s + Number(f.amount), 0);
  const atrasadoQtd = filtered.filter(
    (f: any) => f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < today,
  ).length;

  function toggle(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f: any) => f.id)));
  }

  async function markPaid(ids: string[]) {
    const nowIso = new Date().toISOString();
    const toUpdate = filtered.filter((f: any) => ids.includes(f.id));
    for (const f of toUpdate) {
      await supabase
        .from("monthly_fees")
        .update({ status: "pago", paid_at: nowIso, paid_amount: f.amount })
        .eq("id", f.id);
    }
    toast.success(`${ids.length} lançamento(s) marcado(s) como pago`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["financeiro-all"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  async function markOverdue() {
    const overdueIds = filtered
      .filter((f: any) => f.status === "pendente" && new Date(f.due_date) < today)
      .map((f: any) => f.id);
    if (!overdueIds.length) { toast.info("Nenhum vencido para marcar"); return; }
    await supabase.from("monthly_fees").update({ status: "atrasado" }).in("id", overdueIds);
    toast.success(`${overdueIds.length} marcado(s) como atrasado`);
    qc.invalidateQueries({ queryKey: ["financeiro-all"] });
  }

  const clearFilters = search || status !== "all" || month !== "all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Mensalidades geradas para todos os clientes.</p>
        </div>
        {atrasadoQtd > 0 && (
          <Button variant="outline" size="sm" onClick={markOverdue}>
            <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
            Marcar {atrasadoQtd} vencido(s) como atrasado
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Total lançado</div><div className="text-2xl font-bold">{fmtBRL(total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Recebido</div><div className="text-2xl font-bold text-emerald-600">{fmtBRL(pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">A receber</div><div className="text-2xl font-bold">{fmtBRL(total - pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Em atraso</div><div className="text-2xl font-bold text-red-600">{fmtBRL(atrasadoValor)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Lançamentos ({filtered.length})</CardTitle>
            {selected.size > 0 && (
              <Button size="sm" onClick={() => markPaid(Array.from(selected))}>
                <Check className="h-4 w-4 mr-2" />Marcar {selected.size} como pago
              </Button>
            )}
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
            {clearFilters && (
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
                <TableHead className="w-8">
                  <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {rows.length === 0 ? "Nenhuma mensalidade gerada. Gere pelo painel do cliente." : "Nenhum lançamento com esses filtros."}
                </TableCell></TableRow>
              )}
              {filtered.map((f: any) => {
                const isOverdue = f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < today;
                const displayStatus = isOverdue && f.status === "pendente" ? "atrasado" : f.status;
                return (
                  <TableRow key={f.id} className={selected.has(f.id) ? "bg-accent/40" : ""}>
                    <TableCell><Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} /></TableCell>
                    <TableCell className="font-medium">
                      <Link to="/clientes/$id" params={{ id: f.client_id }} className="hover:underline">
                        {f.clients?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{new Date(f.reference_month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</TableCell>
                    <TableCell className={isOverdue ? "text-red-600 font-medium" : ""}>{new Date(f.due_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{fmtBRL(Number(f.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={displayStatus === "pago" ? "default" : displayStatus === "atrasado" ? "destructive" : displayStatus === "cancelado" ? "secondary" : "outline"}>
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status !== "pago" && f.status !== "cancelado" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid([f.id])}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

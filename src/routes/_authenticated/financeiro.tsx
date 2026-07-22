import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["financeiro-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_fees")
        .select("id, reference_month, due_date, amount, status, paid_at, clients(name)")
        .order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((s, f: any) => s + Number(f.amount), 0);
  const pago = (data ?? []).filter((f: any) => f.status === "pago").reduce((s, f: any) => s + Number(f.amount), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Mensalidades geradas para todos os clientes.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Total lançado</div><div className="text-2xl font-bold">{fmtBRL(total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Recebido</div><div className="text-2xl font-bold text-primary">{fmtBRL(pago)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">A receber</div><div className="text-2xl font-bold">{fmtBRL(total - pago)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Referência</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma mensalidade gerada. Gere pelo painel do cliente.</TableCell></TableRow>}
              {(data ?? []).map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.clients?.name}</TableCell>
                  <TableCell>{new Date(f.reference_month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</TableCell>
                  <TableCell>{new Date(f.due_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{fmtBRL(Number(f.amount))}</TableCell>
                  <TableCell><Badge variant={f.status === "pago" ? "default" : f.status === "atrasado" ? "destructive" : "outline"}>{f.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {f.status !== "pago" && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        await supabase.from("monthly_fees").update({ status: "pago", paid_at: new Date().toISOString(), paid_amount: f.amount }).eq("id", f.id);
                        qc.invalidateQueries({ queryKey: ["financeiro-all"] });
                        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                      }}><Check className="h-3.5 w-3.5" /> Pago</Button>
                    )}
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

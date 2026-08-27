import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function short(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}
function monthKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}
function today0() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }

const chartConfig = {
  recebido: { label: "Recebido", color: "hsl(152 60% 40%)" },
  aReceber: { label: "A receber", color: "hsl(220 90% 56%)" },
  atrasado: { label: "Em atraso", color: "hsl(0 72% 51%)" },
} as const;

type Fee = any;

export function FeesAnalytics({ fees }: { fees: Fee[] }) {
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const t0 = today0();

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; recebido: number; aReceber: number; atrasado: number }>();
    fees.forEach((f) => {
      if (f.status === "cancelado") return;
      const k = monthKey(f.reference_month);
      const cur = map.get(k) ?? { month: k, recebido: 0, aReceber: 0, atrasado: 0 };
      const amount = Number(f.amount) || 0;
      if (f.status === "pago") cur.recebido += amount;
      else if (new Date(f.due_date) < t0) cur.atrasado += amount;
      else cur.aReceber += amount;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((r) => ({ ...r, label: monthLabel(r.month) }));
  }, [fees]);

  const statusData = useMemo(() => {
    let recebido = 0, aReceber = 0, atrasado = 0;
    fees.forEach((f) => {
      if (f.status === "cancelado") return;
      const amount = Number(f.amount) || 0;
      if (f.status === "pago") recebido += amount;
      else if (new Date(f.due_date) < t0) atrasado += amount;
      else aReceber += amount;
    });
    return [
      { key: "recebido", name: "Recebido", value: recebido, fill: chartConfig.recebido.color },
      { key: "aReceber", name: "A receber", value: aReceber, fill: chartConfig.aReceber.color },
      { key: "atrasado", name: "Em atraso", value: atrasado, fill: chartConfig.atrasado.color },
    ].filter((d) => d.value > 0);
  }, [fees]);

  const totalStatus = statusData.reduce((s, d) => s + d.value, 0);

  const byClient = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; pago: number; atrasado: number }>();
    fees.forEach((f) => {
      if (f.status === "cancelado") return;
      const id = f.client_id ?? "sem-cliente";
      const cur = map.get(id) ?? { id, name: f.clients?.name ?? "—", total: 0, pago: 0, atrasado: 0 };
      const amount = Number(f.amount) || 0;
      cur.total += amount;
      if (f.status === "pago") cur.pago += amount;
      else if (new Date(f.due_date) < t0) cur.atrasado += amount;
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [fees]);

  if (fees.length === 0) return null;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução das mensalidades</CardTitle>
            <p className="text-xs text-muted-foreground">Últimos {byMonth.length} meses por mês de referência</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <BarChart data={byMonth} margin={{ left: 4, right: 4, top: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v) => short(Number(v))} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => [`${fmtBRL(Number(v))} `, chartConfig[n as keyof typeof chartConfig]?.label ?? n] as any} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="recebido" stackId="a" fill="var(--color-recebido)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="aReceber" stackId="a" fill="var(--color-aReceber)" />
                <Bar dataKey="atrasado" stackId="a" fill="var(--color-atrasado)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição por status</CardTitle>
            <p className="text-xs text-muted-foreground">Total {fmtBRL(totalStatus)}</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v, n) => [`${fmtBRL(Number(v))} `, n] as any} />} />
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                  {statusData.map((d) => <Cell key={d.key} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-2 space-y-1.5">
              {statusData.map((d) => (
                <li key={d.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} aria-hidden />
                    {d.name}
                  </span>
                  <span className="font-medium tabular-nums">{fmtBRL(d.value)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Maiores clientes por faturamento</CardTitle>
          <p className="text-xs text-muted-foreground">Selecione um cliente para ver o histórico detalhado</p>
        </CardHeader>
        <CardContent className="space-y-1">
          {byClient.map((c) => {
            const pct = c.total > 0 ? (c.pago / c.total) * 100 : 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setClient({ id: c.id, name: c.name })}
                className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ver mensalidades de ${c.name}`}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    {c.atrasado > 0 && <Badge variant="destructive" className="text-[10px]">{fmtBRL(c.atrasado)} atrasado</Badge>}
                    {fmtBRL(c.total)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <ClientFeesDialog client={client} fees={fees} onClose={() => setClient(null)} />
    </>
  );
}

function ClientFeesDialog({ client, fees, onClose }: { client: { id: string; name: string } | null; fees: Fee[]; onClose: () => void }) {
  const t0 = today0();
  const rows = useMemo(
    () => fees
      .filter((f) => (f.client_id ?? "sem-cliente") === client?.id)
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()),
    [fees, client?.id],
  );
  const series = useMemo(
    () => [...rows]
      .reverse()
      .slice(-12)
      .map((f) => ({
        label: monthLabel(monthKey(f.reference_month)),
        recebido: f.status === "pago" ? Number(f.amount) : 0,
        aReceber: f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) >= t0 ? Number(f.amount) : 0,
        atrasado: f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < t0 ? Number(f.amount) : 0,
      })),
    [rows],
  );
  const total = rows.reduce((s, f) => s + (f.status === "cancelado" ? 0 : Number(f.amount)), 0);
  const pago = rows.filter((f) => f.status === "pago").reduce((s, f) => s + Number(f.amount), 0);

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{client?.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{fmtBRL(total)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Recebido</div>
            <div className="text-lg font-semibold text-emerald-600">{fmtBRL(pago)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">A receber</div>
            <div className="text-lg font-semibold">{fmtBRL(total - pago)}</div>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={series} margin={{ left: 4, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v) => short(Number(v))} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v, n) => [`${fmtBRL(Number(v))} `, chartConfig[n as keyof typeof chartConfig]?.label ?? n] as any} />} />
            <Bar dataKey="recebido" stackId="a" fill="var(--color-recebido)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="aReceber" stackId="a" fill="var(--color-aReceber)" />
            <Bar dataKey="atrasado" stackId="a" fill="var(--color-atrasado)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <ul className="divide-y rounded-lg border">
          {rows.map((f) => {
            const overdue = f.status !== "pago" && f.status !== "cancelado" && new Date(f.due_date) < t0;
            const st = overdue && f.status === "pendente" ? "atrasado" : f.status;
            return (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="capitalize">{new Date(f.reference_month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
                <span className={overdue ? "text-red-600" : "text-muted-foreground"}>
                  vence {new Date(f.due_date).toLocaleDateString("pt-BR")}
                </span>
                <span className="tabular-nums font-medium">{fmtBRL(Number(f.amount))}</span>
                <Badge variant={st === "pago" ? "default" : st === "atrasado" ? "destructive" : st === "cancelado" ? "secondary" : "outline"}>{st}</Badge>
              </li>
            );
          })}
          {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sem lançamentos.</li>}
        </ul>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

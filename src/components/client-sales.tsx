import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, TrendingUp, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid } from "recharts";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

export function ClientSales({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ref_date: new Date().toISOString().slice(0, 10),
    hour: "",
    leads: "",
    agendamentos: "",
    vendas: "",
    faturamento: "",
    notes: "",
  });

  const q = useQuery({
    queryKey: ["client_sales", clientId],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("client_sales")
        .select("*")
        .eq("client_id", clientId)
        .gte("ref_date", since)
        .order("ref_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];

  const totals = useMemo(() => {
    return rows.reduce(
      (a: any, r: any) => ({
        leads: a.leads + Number(r.leads || 0),
        agendamentos: a.agendamentos + Number(r.agendamentos || 0),
        vendas: a.vendas + Number(r.vendas || 0),
        faturamento: a.faturamento + Number(r.faturamento || 0),
      }),
      { leads: 0, agendamentos: 0, vendas: 0, faturamento: 0 },
    );
  }, [rows]);

  // Heatmap semana × dia (últimas 12 semanas)
  const heatmap = useMemo(() => {
    const weeks: { key: string; cells: { date: string; dow: number; leads: number; vendas: number }[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - 11 * 7); // 12 semanas atrás (domingo)

    const byDate: Record<string, { leads: number; vendas: number }> = {};
    for (const r of rows) {
      const k = r.ref_date as string;
      const cur = byDate[k] ?? { leads: 0, vendas: 0 };
      cur.leads += Number(r.leads || 0);
      cur.vendas += Number(r.vendas || 0);
      byDate[k] = cur;
    }
    for (let w = 0; w < 12; w++) {
      const wkStart = new Date(start);
      wkStart.setDate(wkStart.getDate() + w * 7);
      const cells: any[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(wkStart);
        cell.setDate(cell.getDate() + d);
        const key = cell.toISOString().slice(0, 10);
        cells.push({ date: key, dow: d, ...(byDate[key] ?? { leads: 0, vendas: 0 }) });
      }
      const label = wkStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      weeks.push({ key: label, cells });
    }
    const maxLeads = Math.max(1, ...Object.values(byDate).map((v) => v.leads));
    return { weeks, maxLeads };
  }, [rows]);

  const byWeekday = useMemo(() => {
    const acc = Array.from({ length: 7 }, (_, i) => ({ dow: i, label: DOW[i], leads: 0, vendas: 0, faturamento: 0 }));
    for (const r of rows) {
      const dow = Number(r.weekday ?? new Date(r.ref_date + "T00:00").getDay());
      acc[dow].leads += Number(r.leads || 0);
      acc[dow].vendas += Number(r.vendas || 0);
      acc[dow].faturamento += Number(r.faturamento || 0);
    }
    return acc;
  }, [rows]);

  const byHour = useMemo(() => {
    const acc = Array.from({ length: 24 }, (_, i) => ({ hour: i, label: `${i}h`, leads: 0, vendas: 0 }));
    for (const r of rows) {
      if (r.hour == null) continue;
      const h = Math.max(0, Math.min(23, Number(r.hour)));
      acc[h].leads += Number(r.leads || 0);
      acc[h].vendas += Number(r.vendas || 0);
    }
    return acc;
  }, [rows]);

  const bestDay = [...byWeekday].sort((a, b) => b.leads - a.leads)[0];
  const bestHour = [...byHour].sort((a, b) => b.leads - a.leads)[0];

  async function save() {
    if (!user) return;
    const payload = {
      client_id: clientId,
      ref_date: form.ref_date,
      hour: form.hour === "" ? null : Number(form.hour),
      leads: Number(form.leads || 0),
      agendamentos: Number(form.agendamentos || 0),
      vendas: Number(form.vendas || 0),
      faturamento: Number(form.faturamento || 0),
      notes: form.notes || null,
      created_by: user.id,
    };
    const { error } = await supabase.from("client_sales").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Registro salvo");
    setOpen(false);
    setForm({ ref_date: new Date().toISOString().slice(0, 10), hour: "", leads: "", agendamentos: "", vendas: "", faturamento: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["client_sales", clientId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("client_sales").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["client_sales", clientId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Vendas do cliente</h2>
          <p className="text-sm text-muted-foreground">Registre manualmente leads, agendamentos e vendas para acompanhar performance real.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo registro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar vendas</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={form.ref_date} onChange={(e) => setForm({ ...form, ref_date: e.target.value })} /></div>
                <div><Label>Hora (opcional)</Label><Input type="number" min={0} max={23} placeholder="Ex: 14" value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Leads</Label><Input type="number" min={0} value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })} /></div>
                <div><Label>Agendamentos</Label><Input type="number" min={0} value={form.agendamentos} onChange={(e) => setForm({ ...form, agendamentos: e.target.value })} /></div>
                <div><Label>Vendas</Label><Input type="number" min={0} value={form.vendas} onChange={(e) => setForm({ ...form, vendas: e.target.value })} /></div>
              </div>
              <div><Label>Faturamento (R$)</Label><Input type="number" min={0} step="0.01" value={form.faturamento} onChange={(e) => setForm({ ...form, faturamento: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiSm label="Leads" value={String(totals.leads)} accent="primary" />
        <KpiSm label="Agendamentos" value={String(totals.agendamentos)} accent="violet" />
        <KpiSm label="Vendas" value={String(totals.vendas)} accent="emerald" />
        <KpiSm label="Faturamento" value={fmtBRL(totals.faturamento)} accent="emerald" />
      </div>

      {/* GitHub-style heatmap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Mapa de calor · leads por dia (12 semanas)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {bestDay && bestDay.leads > 0 ? `Melhor dia: ${bestDay.label} (${bestDay.leads} leads)` : "Sem dados suficientes ainda"}
              {bestHour && bestHour.leads > 0 ? ` · Melhor horário: ${bestHour.label} (${bestHour.leads} leads)` : ""}
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto">
            <div className="flex flex-col gap-1 text-[10px] text-muted-foreground pt-4">
              {DOW.map((d) => <div key={d} className="h-4 flex items-center">{d}</div>)}
            </div>
            <div className="flex gap-1">
              {heatmap.weeks.map((w, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  <div className="text-[9px] text-muted-foreground h-3 text-center" style={{ width: 16 }}>
                    {wi % 2 === 0 ? w.key.split(" ")[0] : ""}
                  </div>
                  {w.cells.map((c) => {
                    const intensity = heatmap.maxLeads ? c.leads / heatmap.maxLeads : 0;
                    const bg = c.leads === 0
                      ? "hsl(var(--muted))"
                      : `color-mix(in oklch, hsl(var(--primary)) ${20 + intensity * 80}%, transparent)`;
                    return (
                      <div key={c.date} className="h-4 w-4 rounded-sm border border-border/50"
                        style={{ background: bg }}
                        title={`${new Date(c.date + "T00:00").toLocaleDateString("pt-BR")} · ${c.leads} leads · ${c.vendas} vendas`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
            <span>Menos</span>
            {[0.1, 0.3, 0.6, 1].map((v) => (
              <div key={v} className="h-3 w-3 rounded-sm" style={{ background: `color-mix(in oklch, hsl(var(--primary)) ${20 + v * 80}%, transparent)` }} />
            ))}
            <span>Mais</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Melhor dia da semana</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              <ResponsiveContainer>
                <BarChart data={byWeekday}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="vendas" fill="#10b981" name="Vendas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Melhor horário</CardTitle></CardHeader>
          <CardContent>
            {byHour.every((h) => h.leads === 0) ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                Registre a hora nas próximas entradas para ver a análise por horário.
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer>
                  <BarChart data={byHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} interval={1} />
                    <YAxis fontSize={11} />
                    <RTooltip />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" name="Leads" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos registros</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">Nenhum registro ainda. Adicione o primeiro clicando em "Novo registro".</div>
          ) : (
            <div className="space-y-1">
              {[...rows].reverse().slice(0, 20).map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-xs w-24 shrink-0">{new Date(r.ref_date + "T00:00").toLocaleDateString("pt-BR")} {r.hour != null ? `${r.hour}h` : ""}</div>
                  <div className="flex-1 grid grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Leads:</span> <b>{r.leads}</b></div>
                    <div><span className="text-muted-foreground">Agend:</span> <b>{r.agendamentos}</b></div>
                    <div><span className="text-muted-foreground">Vendas:</span> <b>{r.vendas}</b></div>
                    <div><span className="text-muted-foreground">R$:</span> <b>{fmtBRL(Number(r.faturamento))}</b></div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiSm({ label, value, accent }: { label: string; value: string; accent?: "primary" | "emerald" | "violet" }) {
  const bg =
    accent === "primary" ? "bg-primary/10 text-primary"
    : accent === "emerald" ? "bg-emerald-500/10 text-emerald-600"
    : accent === "violet" ? "bg-violet-500/10 text-violet-600"
    : "bg-muted";
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 tabular-nums ${bg.split(" ")[1] ?? ""}`}>{value}</div>
    </div>
  );
}

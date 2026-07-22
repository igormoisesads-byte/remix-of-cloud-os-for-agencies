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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}
// Segunda-feira da semana ISO da data informada (yyyy-mm-dd)
function mondayOf(iso: string) {
  const d = new Date(iso + "T00:00");
  const dow = d.getDay(); // 0=dom
  const diff = (dow + 6) % 7; // dias desde segunda
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtBR(iso: string) {
  return new Date(iso + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function currentMonday() {
  return mondayOf(new Date().toISOString().slice(0, 10));
}

export function ClientSales({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    week_start: currentMonday(),
    leads: "",
    agendamentos: "",
    vendas: "",
    faturamento: "",
    notes: "",
  });

  const q = useQuery({
    queryKey: ["client_sales", clientId],
    queryFn: async () => {
      const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("client_sales")
        .select("*")
        .eq("client_id", clientId)
        .gte("ref_date", since)
        .order("ref_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = q.data ?? [];

  // Consolida por semana (ref_date = segunda). Se houver múltiplos registros na mesma semana, soma.
  const weekly = useMemo(() => {
    const m = new Map<string, { week: string; leads: number; agendamentos: number; vendas: number; faturamento: number; ids: string[] }>();
    for (const r of rows) {
      const wk = mondayOf(r.ref_date as string);
      const cur = m.get(wk) ?? { week: wk, leads: 0, agendamentos: 0, vendas: 0, faturamento: 0, ids: [] };
      cur.leads += Number(r.leads || 0);
      cur.agendamentos += Number(r.agendamentos || 0);
      cur.vendas += Number(r.vendas || 0);
      cur.faturamento += Number(r.faturamento || 0);
      cur.ids.push(r.id);
      m.set(wk, cur);
    }
    return [...m.values()].sort((a, b) => b.week.localeCompare(a.week));
  }, [rows]);

  const totals = useMemo(
    () => weekly.reduce(
      (a, w) => ({
        leads: a.leads + w.leads,
        agendamentos: a.agendamentos + w.agendamentos,
        vendas: a.vendas + w.vendas,
        faturamento: a.faturamento + w.faturamento,
      }),
      { leads: 0, agendamentos: 0, vendas: 0, faturamento: 0 },
    ),
    [weekly],
  );

  async function save() {
    if (!user) return;
    const wk = mondayOf(form.week_start);
    const payload = {
      client_id: clientId,
      ref_date: wk,
      hour: null,
      leads: Number(form.leads || 0),
      agendamentos: Number(form.agendamentos || 0),
      vendas: Number(form.vendas || 0),
      faturamento: Number(form.faturamento || 0),
      notes: form.notes || null,
      created_by: user.id,
    };
    const { error } = await supabase.from("client_sales").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Semana registrada");
    setOpen(false);
    setForm({ week_start: currentMonday(), leads: "", agendamentos: "", vendas: "", faturamento: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["client_sales", clientId] });
  }

  async function removeWeek(ids: string[]) {
    if (!confirm("Remover os registros desta semana?")) return;
    const { error } = await supabase.from("client_sales").delete().in("id", ids);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["client_sales", clientId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Resultados do cliente</h2>
          <p className="text-sm text-muted-foreground">Registro semanal — leads, agendamentos, matrículas/cadastros e faturamento por semana.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Registrar semana</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar resultados da semana</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Semana (segunda a domingo)</Label>
                <Input type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">
                  Semana: {fmtBR(mondayOf(form.week_start))} → {fmtBR(addDays(mondayOf(form.week_start), 6))}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Leads</Label><Input type="number" min={0} value={form.leads} onChange={(e) => setForm({ ...form, leads: e.target.value })} /></div>
                <div><Label>Agendamentos</Label><Input type="number" min={0} value={form.agendamentos} onChange={(e) => setForm({ ...form, agendamentos: e.target.value })} /></div>
                <div><Label>Matrículas / Cadastros</Label><Input type="number" min={0} value={form.vendas} onChange={(e) => setForm({ ...form, vendas: e.target.value })} /></div>
              </div>
              <div><Label>Faturamento (R$)</Label><Input type="number" min={0} step="0.01" value={form.faturamento} onChange={(e) => setForm({ ...form, faturamento: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiSm label="Leads (total)" value={String(totals.leads)} accent="primary" />
        <KpiSm label="Agendamentos" value={String(totals.agendamentos)} accent="violet" />
        <KpiSm label="Matrículas/Cadastros" value={String(totals.vendas)} accent="emerald" />
        <KpiSm label="Faturamento" value={fmtBRL(totals.faturamento)} accent="emerald" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Semanas registradas</CardTitle></CardHeader>
        <CardContent>
          {weekly.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhum registro ainda. Clique em "Registrar semana" para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {weekly.map((w, idx) => {
                const num = weekly.length - idx;
                const end = addDays(w.week, 6);
                const tkt = w.vendas ? w.faturamento / w.vendas : 0;
                return (
                  <div key={w.week} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-medium">Semana {num} · {fmtBR(w.week)} — {fmtBR(end)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Ticket médio: {tkt ? fmtBRL(tkt) : "—"}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeWeek(w.ids)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <Cell k="Leads" v={String(w.leads)} />
                      <Cell k="Agend." v={String(w.agendamentos)} />
                      <Cell k="Vendas" v={String(w.vendas)} />
                      <Cell k="R$" v={fmtBRL(w.faturamento)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</div>
      <div className="font-semibold tabular-nums">{v}</div>
    </div>
  );
}
function KpiSm({ label, value, accent }: { label: string; value: string; accent?: "primary" | "emerald" | "violet" }) {
  const color =
    accent === "primary" ? "text-primary"
    : accent === "emerald" ? "text-emerald-600"
    : accent === "violet" ? "text-violet-600"
    : "";
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

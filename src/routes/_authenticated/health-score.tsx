import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/health-score")({
  component: HealthScorePage,
});

type Row = {
  client_id: string;
  client_name: string;
  client_type: string | null;
  score: number | null;
  notes: string | null;
  recorded_at: string | null;
};

function scoreColor(s: number | null) {
  if (s == null) return "bg-muted text-muted-foreground";
  if (s >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (s >= 60) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}

function scoreLabel(s: number | null) {
  if (s == null) return "Sem registro";
  if (s >= 80) return "Saudável";
  if (s >= 60) return "Atenção";
  return "Crítico";
}

function HealthScorePage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["health-score-overview"],
    queryFn: async (): Promise<Row[]> => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id,name,type,status")
        .eq("status", "ativo")
        .order("name");
      if (!clients) return [];
      const ids = clients.map((c) => c.id);
      const { data: scores } = await supabase
        .from("health_scores")
        .select("client_id,score,notes,recorded_at")
        .in("client_id", ids)
        .order("recorded_at", { ascending: false });
      const latest = new Map<string, any>();
      for (const s of scores ?? []) if (!latest.has(s.client_id)) latest.set(s.client_id, s);
      return clients.map((c) => ({
        client_id: c.id,
        client_name: c.name,
        client_type: c.type,
        score: latest.get(c.id)?.score ?? null,
        notes: latest.get(c.id)?.notes ?? null,
        recorded_at: latest.get(c.id)?.recorded_at ?? null,
      }));
    },
  });

  const avg = (() => {
    const withScore = (data ?? []).filter((r) => r.score != null);
    if (!withScore.length) return null;
    return Math.round(withScore.reduce((a, r) => a + (r.score ?? 0), 0) / withScore.length);
  })();

  const criticos = (data ?? []).filter((r) => (r.score ?? 0) < 60 && r.score != null).length;
  const atencao = (data ?? []).filter((r) => (r.score ?? 0) >= 60 && (r.score ?? 0) < 80).length;
  const saudaveis = (data ?? []).filter((r) => (r.score ?? 0) >= 80).length;
  const semRegistro = (data ?? []).filter((r) => r.score == null).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Health Score</h1>
        <p className="text-muted-foreground mt-1">Qualidade da relação com clientes ativos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Média geral</div><div className="text-2xl font-bold">{avg ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Saudáveis</div><div className="text-2xl font-bold text-emerald-600">{saudaveis}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Atenção</div><div className="text-2xl font-bold text-amber-600">{atencao}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground">Críticos</div><div className="text-2xl font-bold text-red-600">{criticos}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Clientes ativos ({data?.length ?? 0}) · {semRegistro} sem registro</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead>Anotações</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((r) => (
                <TableRow key={r.client_id}>
                  <TableCell>
                    <Link to="/clientes/$id" params={{ id: r.client_id }} className="font-medium hover:underline">
                      {r.client_name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.client_type ?? "—"}</Badge></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center justify-center h-8 min-w-10 px-2 rounded-md text-sm font-semibold ${scoreColor(r.score)}`}>
                      {r.score ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell><span className="text-sm">{scoreLabel(r.score)}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.recorded_at ? new Date(r.recorded_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{r.notes ?? "—"}</TableCell>
                  <TableCell>
                    <RegisterButton clientId={r.client_id} userId={user?.id ?? ""} onSaved={() => qc.invalidateQueries({ queryKey: ["health-score-overview"] })} />
                  </TableCell>
                </TableRow>
              ))}
              {!data?.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum cliente ativo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterButton({ clientId, userId, onSaved }: { clientId: string; userId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number>(80);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const { error } = await supabase.from("health_scores").insert({ client_id: clientId, score, notes: notes || null, recorded_by: userId || null });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Score registrado");
    setOpen(false);
    setNotes("");
    onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Registrar</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar Health Score</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Score (0-100)</label>
            <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Anotações</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que motivou este score?" />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

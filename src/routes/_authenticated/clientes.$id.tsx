import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, Plus, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetail,
});

const TYPE_LABEL: Record<string, string> = { local: "Local", perpetuo: "Perpétuo", autoria: "Autoria" };

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function ClienteDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const client = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error; return data;
    },
  });

  const onboarding = useQuery({
    queryKey: ["onboarding", id],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_tasks").select("*").eq("client_id", id).order("position");
      return data ?? [];
    },
  });

  const fees = useQuery({
    queryKey: ["fees", id],
    queryFn: async () => {
      const { data } = await supabase.from("monthly_fees").select("*").eq("client_id", id).order("reference_month", { ascending: false });
      return data ?? [];
    },
  });

  const activities = useQuery({
    queryKey: ["activities", id],
    queryFn: async () => {
      const { data } = await supabase.from("client_activities").select("*, profiles(full_name)").eq("client_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (client.isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!client.data) return <div className="p-8">Cliente não encontrado</div>;
  const c = client.data;

  const doneCount = (onboarding.data ?? []).filter(t => t.done).length;
  const totalCount = (onboarding.data ?? []).length;
  const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/clientes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
            <Badge variant="outline">{TYPE_LABEL[c.type]}</Badge>
            <Badge>{c.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {[c.niche, c.platform, c.site, c.city_uf].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Dados Cadastrais</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Tipo" value={TYPE_LABEL[c.type]} />
                <Row label="Nicho" value={c.niche || "—"} />
                <Row label="Plataforma" value={c.platform || "—"} />
                <Row label="Site" value={c.site || "—"} />
                <Row label="Cidade/UF" value={c.city_uf || "—"} />
                <Row label="Início contrato" value={c.contract_start ? new Date(c.contract_start).toLocaleDateString("pt-BR") : "—"} />
                <Row label="Mensalidade" value={c.monthly_fee_amount ? `${fmtBRL(Number(c.monthly_fee_amount))} / dia ${c.monthly_fee_day ?? "—"}` : "—"} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Onboarding</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{doneCount} de {totalCount} concluídas</div>
                <Progress value={progress} />
                <div className="text-2xl font-bold">{progress}%</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="onboarding">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Checklist</CardTitle>
              <NewOnboardingTask clientId={id} onDone={() => qc.invalidateQueries({ queryKey: ["onboarding", id] })} />
            </CardHeader>
            <CardContent className="space-y-2">
              {(onboarding.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem itens.</p>}
              {(onboarding.data ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <Checkbox checked={t.done} onCheckedChange={async (v) => {
                    await supabase.from("onboarding_tasks").update({ done: !!v, done_at: v ? new Date().toISOString() : null }).eq("id", t.id);
                    qc.invalidateQueries({ queryKey: ["onboarding", id] });
                  }} />
                  <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Mensalidades</CardTitle>
              <NewFeeDialog clientId={id} defaultAmount={Number(c.monthly_fee_amount) || 0} defaultDay={c.monthly_fee_day || 5} onDone={() => qc.invalidateQueries({ queryKey: ["fees", id] })} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fees.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem mensalidades geradas.</TableCell></TableRow>}
                  {(fees.data ?? []).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{new Date(f.reference_month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</TableCell>
                      <TableCell>{new Date(f.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{fmtBRL(Number(f.amount))}</TableCell>
                      <TableCell><Badge variant={f.status === "pago" ? "default" : f.status === "atrasado" ? "destructive" : "outline"}>{f.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {f.status !== "pago" ? (
                          <Button size="sm" variant="outline" onClick={async () => {
                            await supabase.from("monthly_fees").update({ status: "pago", paid_at: new Date().toISOString(), paid_amount: f.amount }).eq("id", f.id);
                            qc.invalidateQueries({ queryKey: ["fees", id] });
                            qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                          }}><Check className="h-3.5 w-3.5" /> Marcar como pago</Button>
                        ) : <span className="text-xs text-muted-foreground">Pago em {f.paid_at ? new Date(f.paid_at).toLocaleDateString("pt-BR") : ""}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader><CardTitle className="text-base">Registro de atividades</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(activities.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
              {(activities.data ?? []).map((a: any) => (
                <div key={a.id} className="border-l-2 border-primary/40 pl-3 text-sm">
                  <div className="font-medium">{a.action}</div>
                  <div className="text-xs text-muted-foreground">{a.profiles?.full_name || ""} · {new Date(a.created_at).toLocaleString("pt-BR")}</div>
                  {a.description && <div className="text-xs mt-1">{a.description}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function NewOnboardingTask({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Item</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo item de onboarding</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            if (!title.trim()) return;
            const { data } = await supabase.from("onboarding_tasks").select("position").eq("client_id", clientId).order("position", { ascending: false }).limit(1);
            const pos = (data?.[0]?.position ?? -1) + 1;
            await supabase.from("onboarding_tasks").insert({ client_id: clientId, title: title.trim(), position: pos });
            setTitle(""); setOpen(false); onDone();
          }}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewFeeDialog({ clientId, defaultAmount, defaultDay, onDone }: { clientId: string; defaultAmount: number; defaultDay: number; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [ref, setRef] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [due, setDue] = useState(new Date(today.getFullYear(), today.getMonth(), defaultDay || 5).toISOString().slice(0, 10));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Gerar mensalidade</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova mensalidade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Mês de referência</Label><Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            const { error } = await supabase.from("monthly_fees").insert({ client_id: clientId, reference_month: ref, due_date: due, amount: Number(amount) || 0 });
            if (error) return toast.error(error.message);
            if (user) await supabase.from("client_activities").insert({ client_id: clientId, user_id: user.id, action: "Mensalidade gerada", description: `${new Date(ref).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} — ${fmtBRL(Number(amount))}` });
            setOpen(false); onDone();
          }}>Gerar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

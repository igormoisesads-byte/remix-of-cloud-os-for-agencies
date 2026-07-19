import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, ClipboardList, AlertTriangle, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/hoje")({
  component: HojePage,
});

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function HojePage() {
  const { profile } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [{ count: activos }, { count: onboarding }, feesMonth, feesPending, activities] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "onboarding"),
        supabase.from("monthly_fees").select("amount, status, due_date").gte("due_date", firstDay).lte("due_date", lastDay),
        supabase.from("monthly_fees").select("id, amount, due_date, status, clients(name)").in("status", ["pendente", "atrasado"]).order("due_date"),
        supabase.from("client_activities").select("id, action, description, created_at, clients(name), profiles(full_name)").order("created_at", { ascending: false }).limit(8),
      ]);

      const receitaMes = (feesMonth.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const recebidoMes = (feesMonth.data ?? []).filter(f => f.status === "pago").reduce((s, f) => s + Number(f.amount), 0);

      return {
        activos: activos ?? 0,
        onboarding: onboarding ?? 0,
        receitaMes,
        recebidoMes,
        pendingFees: feesPending.data ?? [],
        activities: activities.data ?? [],
      };
    },
  });

  const nome = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hoje{nome ? `, ${nome}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Resumo da operação — clientes, tarefas e financeiro.</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Clientes ativos" value={String(stats.data?.activos ?? "—")} sub="carteira atual" />
        <StatCard icon={ClipboardList} label="Em onboarding" value={String(stats.data?.onboarding ?? "—")} sub="novos clientes" />
        <StatCard icon={DollarSign} label="Receita do mês" value={fmtBRL(stats.data?.receitaMes)} sub="meta faturamento" />
        <StatCard icon={TrendingUp} label="Recebido no mês" value={fmtBRL(stats.data?.recebidoMes)} sub={`de ${fmtBRL(stats.data?.receitaMes)}`} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Mensalidades pendentes
            </CardTitle>
            <Badge variant="secondary">{stats.data?.pendingFees.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats.data?.pendingFees ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma mensalidade em aberto. 🎉</p>
            )}
            {(stats.data?.pendingFees ?? []).slice(0, 8).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                <div>
                  <div className="font-medium">{f.clients?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Vence {new Date(f.due_date).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{fmtBRL(Number(f.amount))}</span>
                  <Badge variant={f.status === "atrasado" ? "destructive" : "outline"}>{f.status}</Badge>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Link to="/financeiro" className="text-sm text-primary hover:underline">Ver todas →</Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Atividade recente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(stats.data?.activities ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sem atividade registrada ainda.</p>
            )}
            {(stats.data?.activities ?? []).map((a: any) => (
              <div key={a.id} className="text-sm border-l-2 border-primary/40 pl-3">
                <div className="font-medium">{a.action}</div>
                <div className="text-xs text-muted-foreground">
                  {a.clients?.name ? `${a.clients.name} · ` : ""}
                  {a.profiles?.full_name ?? ""} · {new Date(a.created_at).toLocaleString("pt-BR")}
                </div>
                {a.description && <div className="text-xs mt-1">{a.description}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-9 w-9 rounded-md flex items-center justify-center ${accent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

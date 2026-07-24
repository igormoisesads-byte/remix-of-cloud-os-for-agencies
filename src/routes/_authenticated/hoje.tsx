import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, ClipboardList, AlertTriangle, TrendingUp, CalendarDays, CalendarClock, CircleAlert, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listLowBalanceAlerts } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/hoje")({
  component: HojePage,
});

function fmtBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

function HojePage() {
  const { profile } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
      const todayStr = ymd(today);
      const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
      const in7Str = ymd(in7);

      const [{ count: activos }, { count: onboarding }, feesMonth, feesPending, activities,
        tasksOpen, tasksDone7] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "onboarding"),
        supabase.from("monthly_fees").select("amount, status, due_date").gte("due_date", firstDay).lte("due_date", lastDay),
        supabase.from("monthly_fees").select("id, amount, due_date, status, clients(name)").in("status", ["pendente", "atrasado"]).order("due_date"),
        supabase.from("client_activities").select("id, action, description, created_at, clients(name), profiles(full_name)").order("created_at", { ascending: false }).limit(8),
        supabase.from("tasks").select("id, title, due_date, status, priority, kind, clients(name)").neq("status", "done").order("due_date", { nullsFirst: false }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").gte("done_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

      const receitaMes = (feesMonth.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
      const recebidoMes = (feesMonth.data ?? []).filter(f => f.status === "pago").reduce((s, f) => s + Number(f.amount), 0);

      const tasks = tasksOpen.data ?? [];
      const overdue = tasks.filter(t => t.due_date && t.due_date < todayStr);
      const forToday = tasks.filter(t => t.due_date === todayStr);
      const week = tasks.filter(t => t.due_date && t.due_date > todayStr && t.due_date <= in7Str);
      const noDate = tasks.filter(t => !t.due_date);

      return {
        activos: activos ?? 0,
        onboarding: onboarding ?? 0,
        receitaMes,
        recebidoMes,
        pendingFees: feesPending.data ?? [],
        activities: activities.data ?? [],
        overdue, forToday, week, noDate,
        openCount: tasks.length,
        doneWeek: tasksDone7.count ?? 0,
      };
    },
  });

  const listLow = useServerFn(listLowBalanceAlerts);
  const lowBalance = useQuery({
    queryKey: ["low-balance-alerts"],
    queryFn: () => listLow(),
    refetchInterval: 5 * 60 * 1000,
  });

  const nome = profile?.full_name?.split(" ")[0] || "";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hoje{nome ? `, ${nome}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Resumo da operação — clientes, tarefas e financeiro.</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Users} label="Clientes ativos" value={String(stats.data?.activos ?? "—")} />
        <StatCard icon={ClipboardList} label="Onboarding" value={String(stats.data?.onboarding ?? "—")} />
        <StatCard icon={CircleAlert} label="Tarefas atrasadas" value={String(stats.data?.overdue.length ?? "—")} accent={!!stats.data?.overdue.length} />
        <StatCard icon={CalendarClock} label="Tarefas hoje" value={String(stats.data?.forToday.length ?? "—")} />
        <StatCard icon={DollarSign} label="Receita do mês" value={fmtBRL(stats.data?.receitaMes)} />
        <StatCard icon={TrendingUp} label="Recebido" value={fmtBRL(stats.data?.recebidoMes)} accent />
      </div>

      {(lowBalance.data?.length ?? 0) > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-destructive" />
              Contas de anúncio com saldo crítico
            </CardTitle>
            <Badge variant="destructive">{lowBalance.data?.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {(lowBalance.data ?? []).map((a: any) => {
              const d = Number(a.last_low_balance_days ?? 0);
              const tone = d <= 1 ? "destructive" : d <= 3 ? "warning" : "primary";
              const cur = a.currency || "BRL";
              const nf = new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur });
              const bal = a.balance_cents != null ? Number(a.balance_cents) / 100 : null;
              const taxRate = Number(a.tax_rate ?? 0.1215);
              const taxEst = bal != null ? bal * taxRate : null;
              const dailyWithTax = bal != null && d > 0 ? bal / d : null;
              const dailyGross = dailyWithTax != null ? dailyWithTax / (1 + taxRate) : null;
              const runOut = d > 0 ? new Date(Date.now() + d * 86400000) : null;
              const runOutFmt = runOut
                ? runOut.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                : "—";
              return (
                <Link
                  key={a.id}
                  to="/clientes/$id"
                  params={{ id: a.clients?.id ?? "" }}
                  className="block rounded-lg border border-border/60 bg-background/60 p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.clients?.name ?? a.account_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.account_name}</div>
                    </div>
                    <Badge
                      variant={tone === "destructive" ? "destructive" : "outline"}
                      className={
                        tone === "warning"
                          ? "border-warning text-warning"
                          : tone === "primary"
                          ? "border-primary text-primary"
                          : ""
                      }
                    >
                      ~{d.toFixed(1)} dia(s)
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md bg-muted/40 px-2 py-1.5">
                      <div className="text-muted-foreground">Saldo atual</div>
                      <div className="font-semibold text-sm">{bal != null ? nf.format(bal) : "—"}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 px-2 py-1.5">
                      <div className="text-muted-foreground">Imposto ({(taxRate * 100).toFixed(2)}%)</div>
                      <div className="font-semibold text-sm">{taxEst != null ? `+ ${nf.format(taxEst)}` : "—"}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 px-2 py-1.5">
                      <div className="text-muted-foreground">Gasto/dia c/ imposto</div>
                      <div className="font-semibold text-sm">{dailyWithTax != null ? nf.format(dailyWithTax) : "—"}</div>
                      {dailyGross != null && (
                        <div className="text-[10px] text-muted-foreground">bruto {nf.format(dailyGross)}</div>
                      )}
                    </div>
                    <div className="rounded-md bg-muted/40 px-2 py-1.5">
                      <div className="text-muted-foreground">Esgota em</div>
                      <div className="font-semibold text-sm">{runOutFmt}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}


      <div className="grid gap-4 lg:grid-cols-3">
        <TaskGroup title="Atrasadas" icon={CircleAlert} tone="destructive" tasks={stats.data?.overdue ?? []} empty="Nenhuma tarefa atrasada." />
        <TaskGroup title="Para hoje" icon={CalendarClock} tone="primary" tasks={stats.data?.forToday ?? []} empty="Nada agendado para hoje." />
        <TaskGroup title="Próximos 7 dias" icon={CalendarDays} tone="muted" tasks={stats.data?.week ?? []} empty="Sem tarefas na próxima semana." />
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

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : ""}>
      <CardContent className="pt-4 pb-3 px-3 sm:pt-5 sm:pb-4 sm:px-4 min-w-0">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center mb-2 shrink-0 ${accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="text-base sm:text-lg lg:text-xl font-bold mt-0.5 truncate" title={value}>{value}</div>
      </CardContent>
    </Card>
  );
}


function TaskGroup({ title, icon: Icon, tone, tasks, empty }: { title: string; icon: any; tone: "destructive" | "primary" | "muted"; tasks: any[]; empty: string }) {
  const toneCls = tone === "destructive" ? "text-destructive" : tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${toneCls}`} /> {title}
        </CardTitle>
        <Badge variant="secondary">{tasks.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {tasks.slice(0, 6).map((t) => (
          <Link key={t.id} to="/operacoes" className="block text-sm border-b border-border/60 pb-2 last:border-0 hover:bg-muted/40 -mx-2 px-2 rounded">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{t.title}</div>
              <PriorityDot p={t.priority} />
            </div>
            <div className="text-xs text-muted-foreground">
              {t.clients?.name ? `${t.clients.name} · ` : ""}
              {t.due_date ? new Date(t.due_date + "T00:00").toLocaleDateString("pt-BR") : "sem prazo"}
            </div>
          </Link>
        ))}
        {tasks.length > 6 && (
          <Link to="/operacoes" className="text-xs text-primary hover:underline">Ver todas ({tasks.length}) →</Link>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityDot({ p }: { p: string }) {
  const c = p === "urgente" ? "bg-destructive" : p === "alta" ? "bg-warning" : p === "media" ? "bg-primary" : "bg-muted-foreground/50";
  return <span className={`h-2 w-2 rounded-full ${c}`} title={p} />;
}

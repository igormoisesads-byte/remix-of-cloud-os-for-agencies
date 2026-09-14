import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth", replace: true });
  }, [session, loading, nav]);

  useEffect(() => {
    if (!session) return;
    const refreshDashboard = () => queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    const channel = supabase
      .channel(`cloudos-live-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        refreshDashboard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_fees" }, () => {
        queryClient.invalidateQueries({ queryKey: ["financeiro-fees"] });
        queryClient.invalidateQueries({ queryKey: ["fin-overview-month"] });
        refreshDashboard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        refreshDashboard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "client_activities" }, refreshDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["team"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["team"] });
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [queryClient, session]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b border-border px-4 sticky top-0 z-30 bg-background/80 backdrop-blur">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">CloudOS</div>
          </header>
          <main className="flex-1 min-w-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-0">
            <Outlet />
          </main>
        </SidebarInset>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}


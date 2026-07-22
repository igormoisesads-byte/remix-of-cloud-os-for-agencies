import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Cloud, Home, MessageSquare, Users, ClipboardList, DollarSign, Settings, LogOut, UserCog,
  HeartPulse, Smile, Target, Film,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Hoje", url: "/hoje", icon: Home },
      { title: "Chat", url: "/chat", icon: MessageSquare },
    ],
  },
  {
    label: "CS",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Health Score", url: "/health-score", icon: HeartPulse },
      { title: "NPS", url: "/nps", icon: Smile },
      { title: "PDA", url: "/pdas", icon: Target },
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Tarefas", url: "/operacoes", icon: ClipboardList },
      { title: "Criativos", url: "/criativos", icon: Film },
    ],
  },

  {
    label: "Financeiro",
    items: [
      { title: "Mensalidades", url: "/financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Equipe", url: "/equipe", icon: UserCog },
      { title: "Ajustes", url: "/ajustes", icon: Settings },
    ],
  },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Cloud className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold truncate">CloudOS</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agência</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {groups.map((g, idx) => (
          <SidebarGroup
            key={g.label}
            className={
              idx > 0
                ? "border-t border-sidebar-border/40 pt-3 mt-2 group-data-[collapsible=icon]:mt-1 group-data-[collapsible=icon]:pt-2"
                : "pt-2"
            }
          >
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55 font-semibold px-2">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {(profile?.full_name || profile?.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{profile?.full_name || profile?.email || "…"}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {roles.length > 0 ? roles.join(" · ") : "sem papel"}
            </div>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 shrink-0 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title="Sair"
            onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

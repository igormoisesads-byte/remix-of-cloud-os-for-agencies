import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Cloud, Home, MessageSquare, Users, ClipboardList, DollarSign, Settings, LogOut, UserCog,
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
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Tarefas", url: "/operacoes", icon: ClipboardList },
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
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Cloud className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold truncate">CloudOS</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agência</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
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
        <div className="px-2 py-2 space-y-2 group-data-[collapsible=icon]:hidden">
          <div className="text-xs">
            <div className="font-medium truncate">{profile?.full_name || profile?.email || "…"}</div>
            <div className="text-muted-foreground truncate">
              {roles.length > 0 ? roles.join(" · ") : "sem papel"}
            </div>
          </div>
          <Button
            variant="ghost" size="sm" className="w-full justify-start gap-2"
            onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

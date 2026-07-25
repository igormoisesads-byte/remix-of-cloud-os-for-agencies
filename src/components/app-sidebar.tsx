import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Home, MessageSquare, Users, ClipboardList, DollarSign, Settings, LogOut, UserCog,
  HeartPulse, Smile, Target, Film, LayoutDashboard, Headphones, Briefcase, Wallet, Cog, ChevronDown,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
const AGENCY_LOGO_URL = "https://cdn.clouddigital.com.br/agency/logo/2026/07/1164be74-089b-47a9-8a16-1d5a26b82830-Ativo_4_4x.png";



const groups = [
  {
    label: "Visão geral",
    icon: LayoutDashboard,
    items: [
      { title: "Hoje", url: "/hoje", icon: Home },
      { title: "Chat", url: "/chat", icon: MessageSquare },
    ],
  },
  {
    label: "CS",
    icon: Headphones,
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Health Score", url: "/health-score", icon: HeartPulse },
      { title: "NPS", url: "/nps", icon: Smile },
      { title: "PDA", url: "/pdas", icon: Target },
    ],
  },
  {
    label: "Operações",
    icon: Briefcase,
    items: [
      { title: "Tarefas", url: "/operacoes", icon: ClipboardList },
      { title: "Criativos", url: "/criativos", icon: Film },
    ],
  },

  {
    label: "Financeiro",
    icon: Wallet,
    items: [
      { title: "Mensalidades", url: "/financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Configurações",
    icon: Cog,
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
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");
  const closeIfMobile = () => { if (isMobile) setOpenMobile(false); };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, true]))
  );


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <div className="h-9 w-9 rounded-lg bg-black flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/10">
            <img src={cloudosLogo.url} alt="CloudOS" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden leading-tight">
            <div className="text-sm font-semibold tracking-tight truncate">CloudOS</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60 font-medium">Agência</div>
          </div>
        </div>

      </SidebarHeader>
      <SidebarContent className="gap-0">
        {groups.map((g, idx) => {
          const open = openGroups[g.label] ?? true;
          const GroupIcon = g.icon;
          return (
            <Collapsible
              key={g.label}
              open={open}
              onOpenChange={(v) => setOpenGroups((s) => ({ ...s, [g.label]: v }))}
            >
              <SidebarGroup
                className={
                  idx > 0
                    ? "border-t border-sidebar-border/40 pt-3 mt-2 group-data-[collapsible=icon]:mt-1 group-data-[collapsible=icon]:pt-2"
                    : "pt-2"
                }
              >
                <SidebarGroupLabel asChild className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55 font-semibold px-2 group-data-[collapsible=icon]:hidden">
                  <CollapsibleTrigger className="flex w-full items-center gap-2 hover:text-sidebar-foreground transition-colors">
                    <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-left truncate">{g.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="group-data-[collapsible=icon]:!hidden data-[state=closed]:hidden data-[state=open]:block">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {g.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild isActive={isActive(item.url)}>
                            <Link to={item.url} onClick={closeIfMobile}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>

                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
                {/* When sidebar itself is icon-collapsed, always show items as icons */}
                <SidebarGroupContent className="hidden group-data-[collapsible=icon]:block">
                  <SidebarMenu>
                    {g.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                          <Link to={item.url} onClick={closeIfMobile}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>

                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden ring-1 ring-white/10">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile?.full_name || profile?.email || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-xs font-semibold text-sidebar-foreground truncate">{profile?.full_name || profile?.email || "…"}</div>
            <div className="text-[10px] font-medium text-sidebar-foreground/70 truncate uppercase tracking-wider flex items-center gap-1">
              {roles.length > 0 ? roles.join(" · ") : "sem papel"}
              <SquadBadge />
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

function SquadBadge() {
  const { user } = useAuth();
  const [squad, setSquad] = useState<{ name: string; color: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data: mem } = await supabase
        .from("squad_members").select("squad_id").eq("user_id", user.id).limit(1).maybeSingle();
      let squadId = mem?.squad_id as string | undefined;
      if (!squadId) {
        const { data: head } = await supabase
          .from("squads").select("id,name,color").eq("head_user_id", user.id).limit(1).maybeSingle();
        if (!cancel && head) setSquad({ name: head.name, color: head.color });
        return;
      }
      const { data: sq } = await supabase
        .from("squads").select("name,color").eq("id", squadId).maybeSingle();
      if (!cancel && sq) setSquad({ name: sq.name, color: sq.color });
    })();
    return () => { cancel = true; };
  }, [user]);
  if (!squad) return null;
  return (
    <span className="inline-flex items-center gap-1 normal-case tracking-normal rounded px-1.5 py-0.5 bg-white/10 text-sidebar-foreground/90">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: squad.color || "#3b82f6" }} />
      {squad.name}
    </span>
  );
}

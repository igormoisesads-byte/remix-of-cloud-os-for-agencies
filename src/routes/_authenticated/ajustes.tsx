import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { User, Package, Percent, ListChecks, Plug, Users, Briefcase, Palette, UsersRound } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/ajustes")({
  component: AjustesLayout,
});

const nav = [
  { to: "/ajustes/perfil", label: "Meu perfil", icon: User, admin: false },
  { to: "/ajustes/marca", label: "Marca da agência", icon: Palette, admin: true },
  { to: "/ajustes/equipe", label: "Equipe & Cargos (RH)", icon: Users, admin: true },
  { to: "/ajustes/squads", label: "Squads", icon: UsersRound, admin: true },
  { to: "/ajustes/cargos", label: "Rotinas por cargo", icon: Briefcase, admin: true },
  { to: "/ajustes/planos", label: "Planos & Produtos", icon: Package, admin: true },
  { to: "/ajustes/comissao", label: "Tabela de comissão", icon: Percent, admin: true },
  { to: "/ajustes/onboarding", label: "Onboarding por nicho", icon: ListChecks, admin: true },
  { to: "/ajustes/integracoes", label: "Integrações", icon: Plug, admin: true },
] as const;

function AjustesLayout() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const items = nav.filter((n) => !n.admin || isAdmin);

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-3.5rem)] md:overflow-hidden">
      <aside className="md:w-64 md:shrink-0 border-b md:border-b-0 md:border-r bg-card/40 md:overflow-y-auto">
        <div className="p-4 border-b hidden md:block">
          <h1 className="text-lg font-semibold tracking-tight">Ajustes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configurações da agência</p>
        </div>
        <nav className="flex md:block gap-1 md:gap-0 p-2 md:space-y-0.5 overflow-x-auto md:overflow-visible">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`shrink-0 md:shrink flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground"
                }`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 md:overflow-y-auto min-w-0">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


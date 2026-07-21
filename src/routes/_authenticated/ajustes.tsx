import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { User, Package, Percent, ListChecks, Plug, Users, Briefcase } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/ajustes")({
  component: AjustesLayout,
});

const nav = [
  { to: "/ajustes/perfil", label: "Meu perfil", icon: User, admin: false },
  { to: "/ajustes/equipe", label: "Equipe & Cargos (RH)", icon: Users, admin: true },
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
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <aside className="w-64 shrink-0 border-r bg-card/40 overflow-y-auto">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold tracking-tight">Ajustes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configurações da agência</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
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
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

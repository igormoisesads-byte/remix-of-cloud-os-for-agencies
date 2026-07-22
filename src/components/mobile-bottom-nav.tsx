import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquare, Users, ClipboardList, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Hoje", url: "/hoje", icon: Home },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Tarefas", url: "/operacoes", icon: ClipboardList },
  { title: "Ajustes", url: "/ajustes", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = isActive(it.url);
          return (
            <li key={it.url}>
              <Link
                to={it.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <it.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="truncate">{it.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

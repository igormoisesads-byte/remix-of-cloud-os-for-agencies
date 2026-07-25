import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquare, Sparkles, ClipboardList, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Hoje", url: "/hoje", icon: Home },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Tarefas", url: "/operacoes", icon: ClipboardList },
  { title: "Criativos", url: "/criativos", icon: Sparkles },
  { title: "Ajustes", url: "/ajustes", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-40 pointer-events-none flex justify-center px-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >

      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/40 bg-white/60 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-2xl backdrop-saturate-150 dark:bg-black/40 dark:border-white/10"
      >
        <ul className="grid grid-cols-5">
          {items.map((it) => {
            const active = isActive(it.url);
            return (
              <li key={it.url} className="flex">
                <Link
                  to={it.url}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium rounded-2xl transition-colors",
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
    </div>
  );
}

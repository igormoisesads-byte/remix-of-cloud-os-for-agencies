import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloudOS — Entrar no sistema" },
      { name: "description", content: "Acesse o CloudOS para gerenciar clientes, operações, criativos, financeiro e equipe da agência." },
      { property: "og:title", content: "CloudOS — Entrar no sistema" },
      { property: "og:description", content: "Acesse o painel CloudOS da agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }
  return <Navigate to={session ? "/hoje" : "/auth"} replace />;
}

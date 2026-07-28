import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicReport } from "@/lib/ads.functions";
import { PerformanceView } from "@/components/performance-view";
import { Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/p/relatorio/$token")({
  head: () => ({
    meta: [
      { title: "Relatório de performance" },
      { name: "description", content: "Acompanhe em tempo real os resultados de mídia paga." },
      { property: "og:title", content: "Relatório de performance" },
      { property: "og:description", content: "Dashboard ao vivo de campanhas Meta Ads e Google Ads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicReportPage,
});

function PublicReportPage() {
  const { token } = Route.useParams();
  const fetchReport = useServerFn(getPublicReport);
  const q = useQuery({
    queryKey: ["public_report", token],
    queryFn: async () => fetchReport({ data: { token } }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
  });


  if (q.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
          <div className="font-semibold">Relatório indisponível</div>
          <div className="text-sm text-muted-foreground mt-1">
            {(q.error as any)?.message === "Failed to fetch"
              ? "Não foi possível conectar. Verifique sua internet e tente novamente."
              : (q.error as any)?.message || "Este link pode ter expirado ou sido desativado."}
          </div>
          <button
            onClick={() => q.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }


  const { client, agency, insights, creatives, geo, whatsapp, accounts, report, campaignInsights } = q.data as any;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg object-cover ring-1 ring-border"
              />
            ) : (
              <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {client.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground truncate">
                {report.title || "Relatório de performance"}
              </div>
              <div className="font-semibold text-sm sm:text-base truncate">{client.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block text-[10px] uppercase tracking-wide text-muted-foreground">Entregue por</div>
            {agency.agency_logo_url ? (
              <img
                src={agency.agency_logo_url}
                alt={agency.agency_name || "Agência"}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-7 sm:h-9 max-w-[120px] sm:max-w-[160px] object-contain"
              />
            ) : (
              <div className="font-semibold text-xs sm:text-sm">{agency.agency_name || "CloudOS"}</div>
            )}

          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-muted-foreground rounded-lg border bg-card px-3 py-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Ao vivo · atualização automática a cada 4h
          </span>
          {accounts?.length > 0 && accounts[0].last_sync_at && (
            <>
              <span className="hidden sm:inline">·</span>
              <span>Última sincronização: {new Date(accounts[0].last_sync_at).toLocaleString("pt-BR")}</span>
            </>
          )}
        </div>
        <PerformanceView publicToken={token} initialPeriod={report?.default_period || "current_month"} data={{ insights, creatives, geo, whatsapp, accounts, campaignInsights, clientType: client.type }} />
        <div className="text-center text-[11px] sm:text-xs text-muted-foreground pt-6 pb-4">
          Powered by <span className="font-medium text-foreground/70">{agency.agency_name || "CloudOS"}</span>
        </div>
      </main>
    </div>
  );
}

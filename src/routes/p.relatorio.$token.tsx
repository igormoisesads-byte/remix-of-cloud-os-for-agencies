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
    retry: false,
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
            {(q.error as any)?.message || "Este link pode ter expirado ou sido desativado."}
          </div>
        </div>
      </div>
    );
  }

  const { client, agency, insights, creatives, geo, whatsapp, accounts, report, campaignInsights } = q.data as any;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 rounded bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {client.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground truncate">{report.title || "Relatório de performance"}</div>
              <div className="font-semibold truncate">{client.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div className="text-xs text-muted-foreground">Entregue por</div>
            {agency.agency_logo_url ? (
              <img src={agency.agency_logo_url} alt={agency.agency_name || "Agência"} className="h-8 max-w-[140px] object-contain" />
            ) : (
              <div className="font-semibold text-sm">{agency.agency_name || "CloudOS"}</div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="text-xs text-muted-foreground">
          Últimos 30 dias · Atualização automática a cada 4h.
          {accounts?.length > 0 && accounts[0].last_sync_at && (
            <span> · Última sincronização: {new Date(accounts[0].last_sync_at).toLocaleString("pt-BR")}</span>
          )}
        </div>
        <PerformanceView data={{ insights, creatives, geo, whatsapp, accounts, campaignInsights }} />
        <div className="text-center text-xs text-muted-foreground pt-4">
          Powered by {agency.agency_name || "CloudOS"}
        </div>
      </main>
    </div>
  );
}

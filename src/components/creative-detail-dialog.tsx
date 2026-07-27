import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { CreativeThumb } from "@/components/creative-thumb";
import { scoreCreative, type ClientFocus, type ScoredMetric } from "@/lib/creative-metrics";

const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const intl = (n: number) => Math.round(Number(n) || 0).toLocaleString("pt-BR");
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : Number(n).toFixed(d));

function statusColor(s: ScoredMetric["status"]) {
  if (s === "good") return "bg-emerald-500";
  if (s === "ok") return "bg-amber-500";
  if (s === "bad") return "bg-rose-500";
  return "bg-muted";
}
function statusText(s: ScoredMetric["status"]) {
  if (s === "good") return "text-emerald-700";
  if (s === "ok") return "text-amber-700";
  if (s === "bad") return "text-rose-700";
  return "text-muted-foreground";
}

function MetricBar({ m }: { m: ScoredMetric }) {
  const width = Math.max(2, Math.min(100, m.value ?? 0));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground truncate">{m.label}</span>
        <span className={`font-semibold ${statusText(m.status)}`}>{pct(m.value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${statusColor(m.status)}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * Modal com todas as métricas de um criativo (Hook/Body/CTA + métricas cruas).
 * Usado na página de Criativos, no Performance do cliente e no relatório público.
 */
export function CreativeDetailDialog({
  creative,
  focus,
  onOpenChange,
}: {
  creative: any | null;
  focus: ClientFocus;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = creative;
  const isLocal = focus === "local";

  return (
    <Dialog open={!!selected} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {selected && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">{selected.name || "Criativo"}</DialogTitle>
              <div className="text-xs text-muted-foreground">
                {[selected.campaign_name, selected.adset_name].filter(Boolean).join(" · ")}
              </div>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                <CreativeThumb src={selected.preview_url || selected.thumbnail_url} fallbackSrc={selected.thumbnail_url} eager />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Hook / Body / CTA</div>
                {scoreCreative(selected, focus).map((m) => (
                  <div key={m.key} className="space-y-1">
                    <MetricBar m={m} />
                    <div className="text-[10px] text-muted-foreground pl-0.5">
                      {intl(m.numerator)} ÷ {intl(m.denominator)} — {m.hint}
                    </div>
                  </div>
                ))}
                {selected.destination_url && (
                  <a
                    href={selected.destination_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-2"
                  >
                    Abrir destino <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2">
              {(() => {
                const isVideo = Number(selected.video_plays) > 0 || Number(selected.video_p3s) > 0;
                const rows: Array<[string, any] | null> = [
                  ["Valor usado", brl(Number(selected.spend))],
                  ["Alcance", intl(Number(selected.reach))],
                  ["Impressões", intl(Number(selected.impressions))],
                  ["Frequência", num(selected.frequency, 2)],
                  ["CPP (mil alcançadas)", selected.cpp ? brl(Number(selected.cpp)) : "—"],
                  ["CPM", selected.cpm ? brl(Number(selected.cpm)) : "—"],
                  ["Cliques no link únicos", intl(Number(selected.unique_link_clicks))],
                  ["CTR único", pct(selected.unique_link_ctr ? Number(selected.unique_link_ctr) : null)],
                  ["CPC único", selected.unique_link_cpc ? brl(Number(selected.unique_link_cpc)) : "—"],
                  ["Cliques saída únicos", intl(Number(selected.unique_outbound_clicks))],
                  ["CTR saída único", pct(selected.unique_outbound_ctr ? Number(selected.unique_outbound_ctr) : null)],
                  ["CPC saída único", selected.unique_outbound_cpc ? brl(Number(selected.unique_outbound_cpc)) : "—"],
                  isLocal ? null : ["Visualizações página", intl(Number(selected.landing_page_views))],
                  isLocal ? null : ["Custo por LPV", selected.cost_per_landing_page_view ? brl(Number(selected.cost_per_landing_page_view)) : "—"],
                  isLocal ? null : ["Checkouts iniciados", intl(Number(selected.initiate_checkout))],
                  isLocal ? null : ["Custo por checkout", selected.cost_per_initiate_checkout ? brl(Number(selected.cost_per_initiate_checkout)) : "—"],
                  isLocal ? null : ["Valor checkouts", brl(Number(selected.initiate_checkout_value))],
                  Number(selected.purchases) > 0 ? ["Compras", intl(Number(selected.purchases))] : null,
                  Number(selected.purchases) > 0 && selected.cost_per_purchase ? ["Custo por compra", brl(Number(selected.cost_per_purchase))] : null,
                  Number(selected.purchase_value) > 0 ? ["Valor de conversão", brl(Number(selected.purchase_value))] : null,
                  Number(selected.purchase_value) > 0 ? ["ROAS", num(selected.roas, 2)] : null,
                  isVideo ? ["Reproduções vídeo", intl(Number(selected.video_plays))] : null,
                  isVideo ? ["Reprodução 3s", intl(Number(selected.video_p3s))] : null,
                  isVideo ? ["Reprodução 75%", intl(Number(selected.video_p75))] : null,
                  isLocal ? ["Conversas iniciadas (WA)", intl(Number(selected.messaging_conversations_started))] : null,
                ];
                return rows.filter(Boolean).map((row) => {
                  const [k, v] = row as [string, any];
                  return (
                    <div key={k} className="border rounded p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                      <div className="font-semibold text-sm">{v}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

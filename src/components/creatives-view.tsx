import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, ImageOff, Video, Search } from "lucide-react";
import { scoreCreative, aggregateScores, focusFromClientType, type ScoredMetric } from "@/lib/creative-metrics";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const intl = (n: number) => Math.round(n).toLocaleString("pt-BR");
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
  const value = m.value ?? 0;
  const width = Math.max(2, Math.min(100, value));
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

export function CreativesView({ clientId, clientType }: { clientId: string; clientType: string }) {
  const focus = focusFromClientType(clientType);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<string>("spend");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["ad_accounts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const accountIds = accounts.map((a: any) => a.id);

  const { data: creatives = [], isLoading } = useQuery({
    queryKey: ["ad_creatives", clientId, accountIds.join(",")],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("ad_creatives").select("*").in("ad_account_id", accountIds).order("spend", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let list = creatives as any[];
    if (status !== "all") list = list.filter((c) => (c.status || "").toUpperCase() === status);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((c) => (c.name || "").toLowerCase().includes(s) || (c.campaign_name || "").toLowerCase().includes(s));
    }
    list = [...list].sort((a, b) => {
      if (sort === "spend") return Number(b.spend) - Number(a.spend);
      if (sort === "roas") return Number(b.roas ?? 0) - Number(a.roas ?? 0);
      if (sort === "ctr") return Number(b.ctr ?? 0) - Number(a.ctr ?? 0);
      if (sort === "impressions") return Number(b.impressions) - Number(a.impressions);
      return 0;
    });
    return list;
  }, [creatives, q, status, sort]);

  const agg = useMemo(() => aggregateScores(filtered, focus), [filtered, focus]);

  if (accountsLoading) {
    return <div className="h-40 rounded-lg bg-muted animate-pulse" />;
  }

  if (accountIds.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma conta de anúncios conectada. Conecte uma conta Meta em Integrações para ver criativos.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome/campanha" className="pl-7 h-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">Ordem: Gasto</SelectItem>
              <SelectItem value="roas">Ordem: ROAS</SelectItem>
              <SelectItem value="ctr">Ordem: CTR</SelectItem>
              <SelectItem value="impressions">Ordem: Impressões</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">
            Foco: {focus === "local" ? "Cliente Local (WhatsApp)" : "Perpétuo/Lançamento (Site)"}
          </Badge>
        </div>
      </div>

      {/* Aggregated Hook/Body/CTA */}
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Hook · Body · CTA
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {agg.map((m) => (
            <div key={m.key} className="space-y-1.5">
              <div className="text-[11px] text-muted-foreground">{m.label}</div>
              <div className={`text-2xl font-bold ${statusText(m.status)}`}>{pct(m.value)}</div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${statusColor(m.status)}`} style={{ width: `${Math.min(100, m.value ?? 0)}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">{m.hint}</div>
            </div>
          ))}
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-72 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum criativo encontrado. Sincronize a conta em Performance.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c: any) => {
            const scored = scoreCreative(c, focus);
            return (
              <Card key={c.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(c)}>
                <div className="aspect-video bg-muted relative flex items-center justify-center">
                  {c.thumbnail_url || c.preview_url ? (
                    <img src={c.preview_url || c.thumbnail_url} alt={c.name || ""} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="h-8 w-8 text-muted-foreground" />
                  )}
                  {c.video_plays > 0 && (
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Video className="h-3 w-3" /> Vídeo
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2" variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status || "—"}</Badge>
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <div className="text-sm font-semibold truncate" title={c.name}>{c.name || "Sem nome"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.campaign_name || "—"}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    <div><div className="text-muted-foreground">Gasto</div><div className="font-semibold">{brl(Number(c.spend))}</div></div>
                    <div><div className="text-muted-foreground">ROAS</div><div className="font-semibold">{num(c.roas, 2)}</div></div>
                    <div><div className="text-muted-foreground">CTR</div><div className="font-semibold">{c.ctr ? Number(c.ctr).toFixed(2) + "%" : "—"}</div></div>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t">
                    {scored.map((m) => <MetricBar key={m.key} m={m} />)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selected.name || "Criativo"}</DialogTitle>
                <div className="text-xs text-muted-foreground">{selected.campaign_name} · {selected.adset_name}</div>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                  {selected.preview_url || selected.thumbnail_url ? (
                    <img src={selected.preview_url || selected.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : <ImageOff className="h-8 w-8 text-muted-foreground" />}
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
                    <a href={selected.destination_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-2">
                      Abrir destino <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2">
                {(() => {
                  const isVideo = Number(selected.video_plays) > 0 || Number(selected.video_p3s) > 0;
                  const isLocal = focus === "local";
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
    </div>
  );
}

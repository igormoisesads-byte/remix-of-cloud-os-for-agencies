import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { NewClientWizard } from "@/components/new-client-wizard";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — CloudOS" },
      { name: "description", content: "Carteira de clientes, contratos e status da agência no CloudOS." },
      { property: "og:title", content: "Clientes — CloudOS" },
      { property: "og:description", content: "Gerencie clientes, contratos e status da agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientesList,
});


const TYPE_LABEL: Record<string, string> = { local: "Local", perpetuo: "Perpétuo", lancamento: "Lançamento", autoria: "Autoria" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ativo: "default", pausado: "outline", onboarding: "secondary", churn: "destructive",
};

function ClientesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, type, status, niche, platform, site, monthly_fee_amount, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">Carteira, contratos e status.</p>
        </div>
        <NewClientWizard onCreated={() => { qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="pl-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Nenhum cliente cadastrado. Comece adicionando o primeiro.
                </TableCell></TableRow>
              )}
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate({ to: "/clientes/$id", params: { id: c.id } });
                    }
                  }}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/50"
                >
                  <TableCell>
                    <span className="font-medium hover:text-primary">
                      {c.name}
                    </span>
                    {c.site && <div className="text-xs text-muted-foreground">{c.site}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[c.type]}</Badge></TableCell>
                  <TableCell className="text-sm">{c.niche || "—"}</TableCell>
                  <TableCell className="text-sm">{c.platform || "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">
                    {c.monthly_fee_amount ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.monthly_fee_amount)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


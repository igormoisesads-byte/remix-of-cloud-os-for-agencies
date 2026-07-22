import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreativesView } from "@/components/creatives-view";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/criativos")({
  head: () => ({
    meta: [
      { title: "Criativos — CloudOS" },
      { name: "description", content: "Análise de criativos Meta Ads com Hook/Body/CTA por cliente." },
      { property: "og:title", content: "Criativos — CloudOS" },
      { property: "og:description", content: "Central de criativos com métricas de vídeo, retenção e conversão." },
    ],
  }),
  component: CriativosPage,
});

function CriativosPage() {
  const [clientId, setClientId] = useState<string>("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list-min"],
    queryFn: async () => (await supabase.from("clients").select("id, name, type").order("name")).data ?? [],
  });

  const current = (clients as any[]).find((c) => c.id === clientId);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Criativos</h1>
          <p className="text-sm text-muted-foreground">Métricas Meta Ads com Hook · Body · CTA por criativo.</p>
        </div>
        <div className="ml-auto min-w-[280px]">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {(clients as any[]).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {current ? (
        <CreativesView clientId={current.id} clientType={current.type} />
      ) : (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Selecione um cliente acima para ver os criativos.
        </Card>
      )}
    </div>
  );
}

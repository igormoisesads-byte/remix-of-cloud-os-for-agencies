import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Facebook, Chrome, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajustes/integracoes")({
  component: IntegracoesPage,
});

const integrations = [
  {
    name: "Meta Ads",
    desc: "Conecte a conta de anúncios pelo painel do cliente → Performance. Sync automático a cada 4h.",
    icon: Facebook,
    status: "Disponível",
    tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  {
    name: "Google Ads",
    desc: "Integração OAuth com Google Ads API. Em breve.",
    icon: Chrome,
    status: "Em breve",
    tone: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  {
    name: "IA (Projeções)",
    desc: "Análise preditiva de anúncios via IA. Configurada por cliente.",
    icon: Sparkles,
    status: "Em breve",
    tone: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
];

function IntegracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Integrações</h2>
        <p className="text-sm text-muted-foreground mt-1">APIs conectadas à agência.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((it) => (
          <Card key={it.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                  <it.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{it.name}</CardTitle>
              </div>
              <Badge variant="outline" className={it.tone}>{it.status}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{it.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/ajustes/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Meu perfil</h2>
        <p className="text-sm text-muted-foreground mt-1">Dados da sua conta.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Informações</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row k="Nome" v={profile?.full_name || "—"} />
          <Row k="E-mail" v={profile?.email || "—"} />
          <Row k="Papéis" v={roles.join(", ") || "—"} last />
        </CardContent>
      </Card>

      <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}>
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${last ? "" : "border-b"}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

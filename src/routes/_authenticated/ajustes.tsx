import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajustes")({
  component: AjustesPage,
});

function AjustesPage() {
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Meu perfil</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">Nome</span><span className="font-medium">{profile?.full_name || "—"}</span></div>
          <div className="flex justify-between border-b py-2"><span className="text-muted-foreground">E-mail</span><span className="font-medium">{profile?.email}</span></div>
          <div className="flex justify-between py-2"><span className="text-muted-foreground">Papéis</span><span className="font-medium">{roles.join(", ") || "—"}</span></div>
        </CardContent>
      </Card>
      <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/auth", replace: true }); }}>
        <LogOut className="h-4 w-4" /> Sair
      </Button>
    </div>
  );
}

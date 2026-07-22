import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Upload, Loader2, Bell, BellOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/upload-r2";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/use-push";

export const Route = createFileRoute("/_authenticated/ajustes/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { profile, roles, signOut, refresh, user } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const push = usePushNotifications();

  async function onFile(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    setBusy(true);
    try {
      const url = await uploadToR2(file, {
        folder: `avatars/${user.id}`,
        filename: file.name,
      });
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast.success("Foto de perfil atualizada.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Meu perfil</h2>
        <p className="text-sm text-muted-foreground mt-1">Dados da sua conta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto de perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/15 text-primary text-xl font-bold flex items-center justify-center overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-muted-foreground">
                PNG, JPG ou WEBP. Máximo 5MB.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {busy ? "Enviando…" : profile?.avatar_url ? "Trocar foto" : "Enviar foto"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Informações</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row k="Nome" v={profile?.full_name || "—"} />
          <Row k="E-mail" v={profile?.email || "—"} />
          <Row k="Papéis" v={roles.join(", ") || "—"} last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notificações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Receba alertas de saldo baixo em contas de anúncio, menções no chat e novas tarefas — direto no celular ou desktop, mesmo com o app fechado.
          </p>
          {push.permission === "unsupported" ? (
            <p className="text-sm text-destructive">Seu navegador não suporta notificações.</p>
          ) : push.subscribed ? (
            <Button variant="outline" size="sm" disabled={push.loading} onClick={push.disable}>
              <BellOff className="h-4 w-4" /> Desativar notificações
            </Button>
          ) : (
            <Button size="sm" disabled={push.loading} onClick={push.enable}>
              {push.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Ativar notificações
            </Button>
          )}
          {push.permission === "denied" && (
            <p className="text-xs text-muted-foreground">
              Permissão bloqueada no navegador. Habilite manualmente nas configurações do site.
            </p>
          )}
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
    <div className={`flex flex-wrap justify-between gap-2 py-2 ${last ? "" : "border-b"}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium break-all text-right">{v}</span>
    </div>
  );
}

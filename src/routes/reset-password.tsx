import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AGENCY_LOGO_URL = "https://cdn.clouddigital.com.br/agency/logo/2026/07/1164be74-089b-47a9-8a16-1d5a26b82830-Ativo_4_4x.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — CloudOS" },
      { name: "description", content: "Defina uma nova senha para sua conta CloudOS." },
      { property: "og:title", content: "Redefinir senha — CloudOS" },
      { property: "og:description", content: "Defina uma nova senha para sua conta CloudOS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setReady(Boolean(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return toast.error("Use uma senha com pelo menos 8 caracteres.");
    if (password !== confirmation) return toast.error("As senhas não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    navigate({ to: "/hoje", replace: true });
  }

  return (
    <main className="min-h-screen bg-background bg-grid flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={AGENCY_LOGO_URL} alt="CloudOS" className="h-14 object-contain" />
          <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {ready ? <KeyRound className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <h1 className="mt-3 text-2xl font-bold">Redefinir senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
        </div>

        {ready ? (
          <form onSubmit={finish} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-password">Nova senha</Label>
              <Input id="invite-password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-confirmation">Confirmar senha</Label>
              <Input id="invite-confirmation" type="password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Este link de recuperação expirou ou já foi utilizado.</p>
            <Button className="w-full" variant="outline" onClick={() => navigate({ to: "/auth" })}>Ir para o login</Button>
          </div>
        )}
      </section>
    </main>
  );
}
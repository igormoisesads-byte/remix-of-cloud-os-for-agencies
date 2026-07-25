import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
const AGENCY_LOGO_URL = "https://cdn.clouddigital.com.br/agency/logo/2026/07/1164be74-089b-47a9-8a16-1d5a26b82830-Ativo_4_4x.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CloudOS" },
      { name: "description", content: "Acesse o CloudOS para gerenciar clientes, operações e financeiro da agência." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  useEffect(() => {
    if (!loading && session) nav({ to: "/hoje", replace: true });
  }, [session, loading, nav]);

  return (
    <div className="min-h-screen w-full bg-background bg-grid relative flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-radial-fade pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border bg-card p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-3 mb-6">
            <img src={AGENCY_LOGO_URL} alt="CloudOS" className="h-16 object-contain" />
            <div className="text-center">
              <div className="text-2xl font-bold tracking-tight">CloudOS</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sistema operacional da agência</div>
            </div>
          </div>
          <SignInForm />
          <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
            Ao entrar, você concorda com os{" "}
            <a href="/termos" className="underline hover:text-foreground">Termos de Uso</a>{" "}
            e a{" "}
            <a href="/privacidade" className="underline hover:text-foreground">Política de Privacidade</a>{" "}
            do CloudOS.
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} CloudOS · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    nav({ to: "/hoje", replace: true });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="in-email">E-mail</Label>
        <Input id="in-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="in-pass">Senha</Label>
        <Input id="in-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
    </form>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import cloudosLogo from "@/assets/cloudos-logo.png.asset.json";

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
    <div className="min-h-screen w-full bg-background bg-grid relative flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-radial-fade pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="h-16 w-16 rounded-2xl bg-black flex items-center justify-center shadow-lg">
            <img src={cloudosLogo.url} alt="CloudOS" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-tight">CloudOS</div>
            <div className="text-xs text-muted-foreground">Sistema operacional da agência</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-2xl">
          <SignInForm />
        </div>
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

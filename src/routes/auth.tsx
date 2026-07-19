import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Cloud } from "lucide-react";

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
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Cloud className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">CloudOS</div>
            <div className="text-xs text-muted-foreground">Sistema operacional da agência</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-2xl">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin"><SignInForm /></TabsContent>
            <TabsContent value="signup"><SignUpForm /></TabsContent>
          </Tabs>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          O primeiro cadastro vira <span className="text-primary font-medium">admin</span> automaticamente.
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
    <form onSubmit={submit} className="space-y-4 mt-4">
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

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada!");
    nav({ to: "/hoje", replace: true });
  }
  return (
    <form onSubmit={submit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="up-name">Nome completo</Label>
        <Input id="up-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="up-email">E-mail</Label>
        <Input id="up-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="up-pass">Senha</Label>
        <Input id="up-pass" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
    </form>
  );
}

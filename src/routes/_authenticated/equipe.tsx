import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteTeamMember } from "@/lib/team.functions";

const ROLES = ["admin", "gestor", "operacional", "financeiro"] as const;

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});


function EquipePage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) || [] }));
    },
  });

  async function toggleRole(userId: string, role: string, has: boolean) {
    if (!isAdmin) return toast.error("Apenas admin pode alterar papéis.");
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    }
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground mt-1">Membros e papéis. {isAdmin ? "Você é admin." : "Só admin pode editar."}</p>
        </div>
        {isAdmin && <InviteDialog />}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Membros ({data?.length ?? 0})</CardTitle></CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                {ROLES.map((r) => <TableHead key={r} className="capitalize text-center">{r}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                  {ROLES.map((r) => {
                    const has = m.roles.includes(r);
                    return (
                      <TableCell key={r} className="text-center">
                        <Checkbox checked={has} disabled={!isAdmin} onCheckedChange={() => toggleRole(m.id, r, has)} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {(data ?? []).length === 0 && <TableRow><TableCell colSpan={2 + ROLES.length} className="text-center text-muted-foreground py-8">Nenhum membro ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Papéis atuais são só rótulos + regras de acesso ao financeiro. Ajustes finos por função virão nas próximas fases.</p>
    </div>
  );
}

function InviteDialog() {
  const invite = useServerFn(inviteTeamMember);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("operacional");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email) return toast.error("Informe o e-mail.");
    setLoading(true);
    try {
      await invite({ data: { email, full_name: fullName || undefined, role, origin: window.location.origin } });
      toast.success(`Convite enviado para ${email}`);
      setOpen(false);
      setEmail(""); setFullName(""); setRole("operacional");
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao convidar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="h-4 w-4 mr-2" />Convidar membro</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar novo membro</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Papel inicial</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Um e-mail de convite será enviado. A pessoa define a senha ao acessar o link.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Enviando…" : "Enviar convite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


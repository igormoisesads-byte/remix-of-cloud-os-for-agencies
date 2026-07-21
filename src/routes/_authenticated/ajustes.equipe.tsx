import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Pencil, DollarSign, Briefcase } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajustes/equipe")({
  component: EquipeConfigPage,
});

const CARGOS = [
  "Superadmin",
  "Admin",
  "Head da conta",
  "Gestor de Tráfego",
  "Especialista de Performance",
  "Sucesso do Cliente",
  "Financeiro",
];

type HR = {
  user_id: string;
  full_name: string;
  email: string;
  cargo: string | null;
  nivel: string | null;
  admissao: string | null;
  salario: number | null;
  obrigacoes: any;
};

function EquipeConfigPage() {
  const { hasRole, roles } = useAuth();
  const canSeeSalary = hasRole("admin") || roles.includes("superadmin" as any);

  if (!canSeeSalary) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <div className="font-semibold">Acesso restrito</div>
              <div className="text-sm text-muted-foreground mt-1">
                Somente <b>Superadmin</b> e <b>Admin</b> podem ver salários, admissão e obrigações da equipe.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["employees-hr"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_employees_hr");
      if (error) throw error;
      return (data ?? []) as HR[];
    },
  });

  const [editing, setEditing] = useState<HR | null>(null);

  const totalFolha = (list.data ?? []).reduce((acc, e) => acc + (Number(e.salario) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="h-5 w-5" /> Equipe & Cargos (RH/DP)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cargo, nível, admissão, salário e obrigações da equipe. Dados sensíveis visíveis apenas para Admin/Superadmin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Membros</div><div className="text-2xl font-semibold">{list.data?.length ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Folha mensal</div><div className="text-2xl font-semibold">{brl(totalFolha)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Custo anual estimado</div><div className="text-2xl font-semibold">{brl(totalFolha * 12)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="text-left px-4 py-3">Membro</th>
                <th className="text-left px-4 py-3">Cargo</th>
                <th className="text-left px-4 py-3">Nível</th>
                <th className="text-left px-4 py-3">Admissão</th>
                <th className="text-right px-4 py-3">Salário</th>
                <th className="w-10 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!list.isLoading && (list.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum membro cadastrado.</td></tr>
              )}
              {(list.data ?? []).map((e) => (
                <tr key={e.user_id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.full_name}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </td>
                  <td className="px-4 py-3">{e.cargo || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    {e.nivel ? <Badge variant="outline" className="capitalize">{e.nivel}</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">{e.admissao ? new Date(e.admissao).toLocaleDateString("pt-BR") : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-right font-mono">{e.salario ? brl(Number(e.salario)) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-3">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(e)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editing && (
        <EditHRDialog
          hr={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["employees-hr"] }); }}
        />
      )}
    </div>
  );
}

function EditHRDialog({ hr, onClose, onSaved }: { hr: HR; onClose: () => void; onSaved: () => void }) {
  const [cargo, setCargo] = useState(hr.cargo ?? "");
  const [nivel, setNivel] = useState<string>(hr.nivel ?? "pleno");
  const [admissao, setAdmissao] = useState(hr.admissao ?? "");
  const [salario, setSalario] = useState(hr.salario != null ? String(hr.salario) : "");
  const [obrigReunioes, setObrigReunioes] = useState<string>(hr.obrigacoes?.reunioes_semana ?? "");
  const [obrigRotinas, setObrigRotinas] = useState<string>(hr.obrigacoes?.rotinas_semana ?? "");
  const [obrigAnalises, setObrigAnalises] = useState<string>(hr.obrigacoes?.analises_semana ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const obrigacoes = {
      reunioes_semana: obrigReunioes ? Number(obrigReunioes) : null,
      rotinas_semana: obrigRotinas ? Number(obrigRotinas) : null,
      analises_semana: obrigAnalises ? Number(obrigAnalises) : null,
    };
    const { error } = await supabase.rpc("update_employee_hr", {
      _user_id: hr.user_id,
      _cargo: cargo || null,
      _nivel: nivel || null,
      _admissao: admissao || null,
      _salario: salario ? Number(salario) : null,
      _obrigacoes: obrigacoes,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> RH — {hr.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Cargo</Label>
              <Select value={cargo} onValueChange={setCargo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CARGOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={nivel} onValueChange={setNivel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Júnior</SelectItem>
                  <SelectItem value="pleno">Pleno</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Admissão</Label>
              <Input type="date" value={admissao} onChange={(e) => setAdmissao(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Salário (R$)</Label>
              <Input type="number" step="0.01" value={salario} onChange={(e) => setSalario(e.target.value)} />
            </div>
          </div>
          <div className="pt-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
              Obrigações semanais (para auditoria)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label className="text-xs">Reuniões</Label><Input type="number" value={obrigReunioes} onChange={(e) => setObrigReunioes(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-xs">Rotinas</Label><Input type="number" value={obrigRotinas} onChange={(e) => setObrigRotinas(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-xs">Análises</Label><Input type="number" value={obrigAnalises} onChange={(e) => setObrigAnalises(e.target.value)} /></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

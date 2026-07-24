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
import { ShieldAlert, Plus, Users, Trash2, Crown, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ajustes/squads")({
  component: SquadsPage,
});

type Squad = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  head_user_id: string | null;
};
type Profile = { id: string; full_name: string | null; email: string };
type Member = { id: string; squad_id: string; user_id: string; role: string };
type Client = { id: string; name: string; squad_id: string | null; codigo: string | null };

function SquadsPage() {
  const { hasRole, roles } = useAuth();
  const canManage = hasRole("admin") || hasRole("gestor") || roles.includes("superadmin" as any);

  if (!canManage) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <div className="font-semibold">Acesso restrito</div>
              <div className="text-sm text-muted-foreground mt-1">
                Somente <b>Admin</b> e <b>Gestor</b> podem gerenciar squads.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Squad | null>(null);

  const squads = useQuery({
    queryKey: ["squads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("squads").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Squad[];
    },
  });
  const profiles = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const members = useQuery({
    queryKey: ["squad-members-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("squad_members").select("*");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });
  const clients = useQuery({
    queryKey: ["clients-with-squad"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,squad_id,codigo").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  async function removeSquad(id: string) {
    if (!confirm("Excluir este squad? Os clientes ficarão sem squad.")) return;
    const { error } = await supabase.from("squads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Squad excluído");
    qc.invalidateQueries({ queryKey: ["squads"] });
    qc.invalidateQueries({ queryKey: ["clients-with-squad"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" /> Squads
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupe clientes por célula. Head + membros veem todos os clientes do squad.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Novo squad</Button>
      </div>

      {squads.isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : (squads.data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nenhum squad ainda. Crie o primeiro para organizar sua carteira.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(squads.data ?? []).map((s) => {
            const head = profiles.data?.find((p) => p.id === s.head_user_id);
            const squadMembers = (members.data ?? []).filter((m) => m.squad_id === s.id);
            const squadClients = (clients.data ?? []).filter((c) => c.squad_id === s.id);
            return (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color || "#3b82f6" }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        {s.description && <div className="text-xs text-muted-foreground truncate">{s.description}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Editar</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeSquad(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-muted-foreground">Head:</span>
                    <span className="font-medium">{head?.full_name || head?.email || <span className="text-muted-foreground italic">nenhum</span>}</span>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                      Membros ({squadMembers.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {squadMembers.length === 0 && <span className="text-xs text-muted-foreground italic">nenhum</span>}
                      {squadMembers.map((m) => {
                        const pr = profiles.data?.find((p) => p.id === m.user_id);
                        return (
                          <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
                            {pr?.full_name || pr?.email || "—"}
                            <button
                              className="ml-1 hover:text-destructive"
                              onClick={async () => {
                                await supabase.from("squad_members").delete().eq("id", m.id);
                                qc.invalidateQueries({ queryKey: ["squad-members-all"] });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                      Clientes ({squadClients.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {squadClients.length === 0 && <span className="text-xs text-muted-foreground italic">nenhum</span>}
                      {squadClients.slice(0, 8).map((c) => (
                        <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
                      ))}
                      {squadClients.length > 8 && (
                        <Badge variant="outline" className="text-xs">+{squadClients.length - 8}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <SquadEditor
          squad={null}
          profiles={profiles.data ?? []}
          clients={clients.data ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["squads"] });
            qc.invalidateQueries({ queryKey: ["squad-members-all"] });
            qc.invalidateQueries({ queryKey: ["clients-with-squad"] });
          }}
        />
      )}
      {editing && (
        <SquadEditor
          squad={editing}
          profiles={profiles.data ?? []}
          clients={clients.data ?? []}
          currentMembers={(members.data ?? []).filter((m) => m.squad_id === editing.id).map((m) => m.user_id)}
          currentClients={(clients.data ?? []).filter((c) => c.squad_id === editing.id).map((c) => c.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["squads"] });
            qc.invalidateQueries({ queryKey: ["squad-members-all"] });
            qc.invalidateQueries({ queryKey: ["clients-with-squad"] });
          }}
        />
      )}
    </div>
  );
}

function SquadEditor({
  squad, profiles, clients, currentMembers = [], currentClients = [], onClose, onSaved,
}: {
  squad: Squad | null;
  profiles: Profile[];
  clients: Client[];
  currentMembers?: string[];
  currentClients?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(squad?.name ?? "");
  const [description, setDescription] = useState(squad?.description ?? "");
  const [color, setColor] = useState(squad?.color ?? "#3b82f6");
  const [head, setHead] = useState<string>(squad?.head_user_id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(currentMembers);
  const [clientIds, setClientIds] = useState<string[]>(currentClients);
  const [addingMember, setAddingMember] = useState("");
  const [busy, setBusy] = useState(false);

  const availableMembers = profiles.filter((p) => !memberIds.includes(p.id));

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome");
    setBusy(true);
    try {
      let squadId = squad?.id;
      if (squad) {
        const { error } = await supabase.from("squads").update({
          name: name.trim(),
          description: description || null,
          color,
          head_user_id: head || null,
        }).eq("id", squad.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("squads").insert({
          name: name.trim(),
          description: description || null,
          color,
          head_user_id: head || null,
        }).select("id").single();
        if (error) throw error;
        squadId = data.id;
      }
      if (!squadId) throw new Error("sem id");

      // Sync members
      const toAdd = memberIds.filter((id) => !currentMembers.includes(id));
      const toRemove = currentMembers.filter((id) => !memberIds.includes(id));
      if (toAdd.length) {
        await supabase.from("squad_members").insert(toAdd.map((user_id) => ({ squad_id: squadId!, user_id })));
      }
      if (toRemove.length) {
        await supabase.from("squad_members").delete().eq("squad_id", squadId).in("user_id", toRemove);
      }

      // Sync clients
      const cAdd = clientIds.filter((id) => !currentClients.includes(id));
      const cRemove = currentClients.filter((id) => !clientIds.includes(id));
      if (cAdd.length) {
        await supabase.from("clients").update({ squad_id: squadId }).in("id", cAdd);
      }
      if (cRemove.length) {
        await supabase.from("clients").update({ squad_id: null }).in("id", cRemove);
      }

      toast.success(squad ? "Squad atualizado" : "Squad criado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{squad ? `Editar squad` : "Novo squad"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Squad Alpha" />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Foco/segmento (opcional)" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-amber-500" /> Head do squad</Label>
            <Select value={head} onValueChange={setHead}>
              <SelectTrigger><SelectValue placeholder="Selecione um líder" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Membros</Label>
            <div className="flex gap-2">
              <Select value={addingMember} onValueChange={setAddingMember}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar membro" /></SelectTrigger>
                <SelectContent>
                  {availableMembers.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (addingMember && !memberIds.includes(addingMember)) {
                    setMemberIds([...memberIds, addingMember]);
                    setAddingMember("");
                  }
                }}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {memberIds.length === 0 && <span className="text-xs text-muted-foreground italic">nenhum membro</span>}
              {memberIds.map((id) => {
                const p = profiles.find((x) => x.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {p?.full_name || p?.email || "—"}
                    <button className="ml-1 hover:text-destructive" onClick={() => setMemberIds(memberIds.filter((m) => m !== id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Clientes deste squad</Label>
            <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
              {clients.length === 0 && <div className="p-3 text-xs text-muted-foreground">Sem clientes cadastrados.</div>}
              {clients.map((c) => {
                const checked = clientIds.includes(c.id);
                const otherSquad = c.squad_id && c.squad_id !== squad?.id;
                return (
                  <label key={c.id} className="flex items-center gap-2 p-2.5 text-sm hover:bg-muted/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setClientIds(e.target.checked ? [...clientIds, c.id] : clientIds.filter((x) => x !== c.id));
                      }}
                    />
                    <span className="flex-1">{c.name}</span>
                    {c.codigo && <span className="text-xs text-muted-foreground">{c.codigo}</span>}
                    {otherSquad && !checked && <Badge variant="outline" className="text-[10px]">em outro squad</Badge>}
                  </label>
                );
              })}
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

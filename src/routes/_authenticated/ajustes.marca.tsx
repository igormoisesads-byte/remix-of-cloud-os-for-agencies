import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/upload-r2";


export const Route = createFileRoute("/_authenticated/ajustes/marca")({
  component: MarcaPage,
});

function MarcaPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [form, setForm] = useState({ agency_name: "", agency_logo_url: "", agency_primary_color: "" });
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("singleton", true).maybeSingle();
      if (data) {
        setId(data.id);
        setForm({
          agency_name: data.agency_name || "",
          agency_logo_url: data.agency_logo_url || "",
          agency_primary_color: data.agency_primary_color || "",
        });
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    const payload = { ...form, singleton: true };
    const { error } = id
      ? await supabase.from("app_settings").update(payload).eq("id", id)
      : await supabase.from("app_settings").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Marca da agência salva.");
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    setBusy(true);
    try {
      const url = await uploadToR2(file, { folder: "agency/logo", filename: file.name });
      setForm((f) => ({ ...f, agency_logo_url: url }));
      toast.success("Logo carregada.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Marca da agência</h2>
        <p className="text-sm text-muted-foreground mt-1">Aparece nos relatórios públicos enviados aos clientes.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div>
            <Label>Nome da agência</Label>
            <Input value={form.agency_name} onChange={(e) => setForm({ ...form, agency_name: e.target.value })} disabled={!isAdmin} />
          </div>
          <div>
            <Label>Logo (URL)</Label>
            <Input value={form.agency_logo_url} onChange={(e) => setForm({ ...form, agency_logo_url: e.target.value })} disabled={!isAdmin} placeholder="https://..." />
            {isAdmin && (
              <div className="mt-2">
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-xs" />
              </div>
            )}
            {form.agency_logo_url && (
              <img src={form.agency_logo_url} alt="Logo" className="mt-3 h-16 object-contain border rounded p-2 bg-white" />
            )}
          </div>
          <div>
            <Label>Cor primária (opcional)</Label>
            <Input value={form.agency_primary_color} onChange={(e) => setForm({ ...form, agency_primary_color: e.target.value })} disabled={!isAdmin} placeholder="#2563eb" />
          </div>
          {isAdmin && <Button onClick={save} disabled={busy}>Salvar</Button>}
        </CardContent>
      </Card>
    </div>
  );
}

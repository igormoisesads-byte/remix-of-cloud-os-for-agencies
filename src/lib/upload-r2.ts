import { supabase } from "@/integrations/supabase/client";

export async function uploadToR2(
  file: File | Blob,
  opts: { folder: string; filename: string }
): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  const resp = await fetch("/api/r2-upload", {
    method: "POST",
    headers: {
      "Content-Type": (file as any).type || "application/octet-stream",
      Authorization: `Bearer ${token}`,
      "x-folder": opts.folder,
      "x-filename": opts.filename,
    },
    body: file,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Falha no upload (${resp.status}) ${t.slice(0, 160)}`);
  }
  const { url } = await resp.json();
  return url as string;
}

import { createServerFn } from "@tanstack/react-start";

const OWNER_EMAIL = "igormoises.ads@gmail.com";

// One-time, idempotent: invites the owner account only while no superadmin exists.
export const bootstrapOwner = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles").select("id", { count: "exact", head: true }).eq("role", "superadmin");
  if ((count ?? 0) > 0) return { ok: true, skipped: true };
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(OWNER_EMAIL, {
    data: { full_name: "Igor Moises" },
    redirectTo: "https://sistema-gestor02.lovable.app/convite",
  });
  if (error) throw new Error(error.message);
  return { ok: true, invited: OWNER_EMAIL };
});

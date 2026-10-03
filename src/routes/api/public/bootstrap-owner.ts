import { createFileRoute } from "@tanstack/react-router";

const OWNER_EMAIL = "igormoises.ads@gmail.com";

// One-time, idempotent: invites the owner only while no superadmin exists.
export const Route = createFileRoute("/api/public/bootstrap-owner")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("user_roles").select("id", { count: "exact", head: true }).eq("role", "superadmin");
        if ((count ?? 0) > 0) return Response.json({ ok: true, skipped: true });
        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(OWNER_EMAIL, {
          data: { full_name: "Igor Moises" },
          redirectTo: "https://sistema-gestor02.lovable.app/convite",
        });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});

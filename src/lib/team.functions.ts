import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(120).optional(),
  role: z.enum(["admin", "gestor", "operacional", "financeiro"]).default("operacional"),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify caller is admin using the user's own supabase client (RLS applies)
    const { data: roles, error: rolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesErr) throw new Error(rolesErr.message);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Apenas admin pode convidar membros.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const siteUrl = process.env.SITE_URL || process.env.SUPABASE_URL || "";
    const redirectTo = siteUrl ? undefined : undefined;

    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: data.full_name ? { full_name: data.full_name } : undefined,
        ...(redirectTo ? { redirectTo } : {}),
      },
    );
    if (invErr) throw new Error(invErr.message);

    const newUserId = invited.user?.id;
    if (newUserId) {
      // handle_new_user trigger auto-inserts 'operacional'. If a different role
      // was requested, add it (unique(user_id, role) prevents duplicates).
      if (data.role !== "operacional") {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUserId, role: data.role });
      }
      if (data.full_name) {
        await supabaseAdmin
          .from("profiles")
          .update({ full_name: data.full_name })
          .eq("id", newUserId);
      }
    }

    return { ok: true, email: data.email };
  });

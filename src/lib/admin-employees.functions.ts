import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  email: z.string().trim().email("بريد غير صالح").max(255),
  password: z.string().min(8, "كلمة مرور قصيرة جداً").max(72),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  job_title: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.enum(["employee", "manager", "admin"]).default("employee"),
});

async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((r: any) => r.role === "admin" || r.role === "manager");
  if (!ok) throw new Error("Forbidden");
}

export const adminCreateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone || undefined,
        job_title: data.job_title || undefined,
      },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("فشل إنشاء المستخدم");

    if (data.role !== "employee") {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });
    }
    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      action: "create_employee",
      entity_type: "employee_profiles",
      entity_id: newUserId,
      details: { email: data.email, role: data.role },
    });
    return { id: newUserId };
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["employee", "manager", "admin"]),
  action: z.enum(["grant", "revoke"]),
});

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "grant") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.user_id, role: data.role },
        { onConflict: "user_id,role" },
      );
    } else {
      await supabaseAdmin.from("user_roles").delete()
        .eq("user_id", data.user_id).eq("role", data.role);
    }
    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      action: `${data.action}_role_${data.role}`,
      entity_type: "user_roles",
      entity_id: data.user_id,
    });
    return { ok: true };
  });

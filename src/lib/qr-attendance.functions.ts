import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  token: z.string().trim().min(8).max(200),
  lat: z.number().finite().min(-90).max(90).nullable().optional(),
  lng: z.number().finite().min(-180).max(180).nullable().optional(),
});

export const qrCheckAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tokenRows, error: tokenErr } = await supabaseAdmin
      .rpc("validate_qr_token", { p_token: data.token });
    if (tokenErr) throw new Error("تعذر التحقق من الكود");
    const tokenRow = Array.isArray(tokenRows) ? tokenRows[0] : tokenRows;
    if (!tokenRow) throw new Error("الكود غير صالح أو منتهي الصلاحية");

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("attendance")
      .select("id,check_in,check_out")
      .eq("employee_id", userId)
      .eq("work_date", today)
      .maybeSingle();
    if (exErr) throw new Error("تعذر قراءة سجل الحضور");

    if (!existing) {
      const { error } = await supabaseAdmin.from("attendance").insert({
        employee_id: userId,
        check_in_lat: data.lat ?? null,
        check_in_lng: data.lng ?? null,
        check_in_source: "qr",
        qr_token_id: tokenRow.id,
      });
      if (error) throw new Error("تعذر تسجيل الحضور");
      return { action: "in" as const };
    }

    if (!existing.check_out) {
      const { error } = await supabaseAdmin
        .from("attendance")
        .update({
          check_out: new Date().toISOString(),
          check_out_lat: data.lat ?? null,
          check_out_lng: data.lng ?? null,
          check_out_source: "qr",
        })
        .eq("id", existing.id);
      if (error) throw new Error("تعذر تسجيل الانصراف");
      return { action: "out" as const };
    }

    return { action: "done" as const };
  });

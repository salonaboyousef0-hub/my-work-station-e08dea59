// Edge Function: receive-booking-notification
// Called by the Booking app's sync-appointment function whenever a customer
// books, cancels, or an appointment status changes for a mapped employee.
// Auth: x-api-key header must match the BOOKING_INTEGRATION_API_KEY secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

interface RequestBody {
  staff_employee_id?: string;
  title?: string;
  body?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, 405);
  }

  const expectedKey = Deno.env.get("BOOKING_INTEGRATION_API_KEY");
  const providedKey = req.headers.get("x-api-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server not configured" }, 500);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const staffEmployeeId = body.staff_employee_id?.trim();
  const title = body.title?.trim();
  if (!staffEmployeeId || !title) {
    return json({ error: "staff_employee_id and title are required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Make sure the employee actually exists before writing a notification for them
  const { data: employee, error: empError } = await admin
    .from("employee_profiles")
    .select("id")
    .eq("id", staffEmployeeId)
    .maybeSingle();

  if (empError) {
    return json({ error: empError.message }, 500);
  }
  if (!employee) {
    return json({ error: "Employee not found" }, 404);
  }

  const { error: insertError } = await admin.from("notifications").insert({
    employee_id: staffEmployeeId,
    title,
    body: body.body || null,
    type: "booking",
  });

  if (insertError) {
    return json({ error: insertError.message }, 500);
  }

  return json({ ok: true });
});

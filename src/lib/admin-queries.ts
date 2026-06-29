import { supabase } from "@/integrations/supabase/client";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("not authed");
  return data.user.id;
}

export async function logActivity(action: string, entity_type?: string, entity_id?: string, details?: any) {
  const actor_id = await uid();
  await supabase.from("activity_log").insert({ actor_id, action, entity_type, entity_id, details });
}

export async function adminGetEmployees() {
  const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
    supabase.from("employee_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const roleMap = new Map<string, string[]>();
  (roles ?? []).forEach(r => {
    const arr = roleMap.get(r.user_id) ?? [];
    arr.push(r.role);
    roleMap.set(r.user_id, arr);
  });
  return (profiles ?? []).map(p => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
}

export async function adminGetAllLeaveRequests() {
  const { data, error } = await supabase.from("leave_requests")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminGetAllAdvanceRequests() {
  const { data, error } = await supabase.from("employee_requests")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminGetAllGeneralRequests() {
  const { data, error } = await supabase.from("general_requests")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminGetServiceSubmissions() {
  const { data, error } = await supabase.from("employee_services")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .eq("submitted_by_employee", true)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function adminGetTransactions() {
  const { data, error } = await supabase.from("employee_transactions")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .order("transaction_date", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function adminGetShifts() {
  const start = new Date(); start.setDate(start.getDate() - 14);
  const { data, error } = await supabase.from("shifts")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .gte("shift_date", start.toISOString().slice(0, 10))
    .order("shift_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function adminGetAnnouncements() {
  const { data, error } = await supabase.from("announcements")
    .select("*").order("published_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminGetTraining() {
  const { data, error } = await supabase.from("training_materials")
    .select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminGetGoals() {
  const { data, error } = await supabase.from("goals")
    .select("*, employee_profiles!inner(full_name, employee_code)")
    .order("period_month", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function adminGetActivityLog() {
  const { data, error } = await supabase.from("activity_log")
    .select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

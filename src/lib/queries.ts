import { supabase } from "@/integrations/supabase/client";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("not authed");
  return data.user.id;
}

export async function getMyProfile() {
  const id = await uid();
  const { data, error } = await supabase
    .from("employee_profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyRoles() {
  const id = await uid();
  const { data, error } = await supabase
    .from("user_roles").select("role").eq("user_id", id);
  if (error) throw error;
  return (data ?? []).map(r => r.role as string);
}

export async function getMonthAttendanceStats() {
  const start = new Date(); start.setDate(1);
  const { data, error } = await supabase
    .from("attendance").select("id, work_date, check_in, check_out")
    .gte("work_date", start.toISOString().slice(0, 10))
    .order("work_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTodayAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance").select("*").eq("work_date", today).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTransactions() {
  const { data, error } = await supabase
    .from("employee_transactions").select("*")
    .order("transaction_date", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getServices() {
  const { data, error } = await supabase
    .from("employee_services").select("*")
    .order("service_date", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getRequests() {
  const { data, error } = await supabase
    .from("employee_requests").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLeaveRequests() {
  const { data, error } = await supabase
    .from("leave_requests").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGeneralRequests() {
  const { data, error } = await supabase
    .from("general_requests").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getNotifications() {
  const { data, error } = await supabase
    .from("notifications").select("*")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getMyShifts() {
  const start = new Date(); start.setDate(start.getDate() - 7);
  const { data, error } = await supabase
    .from("shifts").select("*")
    .gte("shift_date", start.toISOString().slice(0, 10))
    .order("shift_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCurrentGoal() {
  const monthStart = new Date(); monthStart.setDate(1);
  const { data, error } = await supabase
    .from("goals").select("*")
    .eq("period_month", monthStart.toISOString().slice(0, 10))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyEvaluations() {
  const { data, error } = await supabase
    .from("evaluations").select("*")
    .order("period_month", { ascending: false }).limit(12);
  if (error) throw error;
  return data ?? [];
}

export async function getAnnouncements() {
  const { data, error } = await supabase
    .from("announcements").select("*")
    .order("published_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getTraining() {
  const [{ data: materials, error: e1 }, { data: progress, error: e2 }] = await Promise.all([
    supabase.from("training_materials").select("*").order("created_at", { ascending: false }),
    supabase.from("training_progress").select("material_id, completed_at"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const done = new Set((progress ?? []).map(p => p.material_id));
  return (materials ?? []).map(m => ({ ...m, completed: done.has(m.id) }));
}

export async function getMyAssets() {
  const { data, error } = await supabase
    .from("employee_assets").select("*")
    .order("received_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyBookings(range: "today" | "week" | "upcoming" = "week") {
  const id = await uid();
  const now = new Date();
  let from = new Date(now); from.setHours(0, 0, 0, 0);
  let to: Date | null = null;
  if (range === "today") {
    to = new Date(from); to.setDate(to.getDate() + 1);
  } else if (range === "week") {
    to = new Date(from); to.setDate(to.getDate() + 7);
  }
  let q = supabase.from("bookings").select("*")
    .eq("employee_id", id)
    .gte("starts_at", from.toISOString())
    .order("starts_at", { ascending: true });
  if (to) q = q.lt("starts_at", to.toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getNextBooking() {
  const id = await uid();
  const { data, error } = await supabase.from("bookings").select("*")
    .eq("employee_id", id)
    .gte("starts_at", new Date().toISOString())
    .in("status", ["scheduled", "confirmed"])
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}


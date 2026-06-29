import { supabase } from "@/integrations/supabase/client";

export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authed");
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .eq("id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMonthAttendanceStats() {
  const start = new Date();
  start.setDate(1);
  const startStr = start.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance")
    .select("id, work_date, check_in, check_out")
    .gte("work_date", startStr)
    .order("work_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTodayAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("work_date", today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTransactions() {
  const { data, error } = await supabase
    .from("employee_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getServices() {
  const { data, error } = await supabase
    .from("employee_services")
    .select("*")
    .order("service_date", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getRequests() {
  const { data, error } = await supabase
    .from("employee_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

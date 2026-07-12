// Read/write helpers for the cashier Supabase project, keyed by employee name.
// Every call swallows errors (logs to console) so the UI can render whatever
// data is available even when RLS blocks part of the response.
import { cashierClient } from "@/integrations/supabase/cashier-client";

function logErr(scope: string, err: unknown) {
  if (err) console.warn(`[cashier:${scope}]`, err);
}

export type CashierOperation = {
  id?: string | number;
  created_at?: string;
  date?: string;
  service?: string;
  service_name?: string;
  customer?: string;
  customer_name?: string;
  price?: number;
  amount?: number;
  total?: number;
  barber?: string;
  assistant?: string;
  barber_commission?: number;
  assistant_commission?: number;
  commission?: number;
  [k: string]: any;
};

export type CashierWithdrawal = {
  id?: string | number;
  created_at?: string;
  date?: string;
  employee_name?: string;
  amount?: number;
  note?: string;
  [k: string]: any;
};

/** All operations where the employee is either the barber or the assistant. */
export async function fetchCashierOperations(name: string): Promise<CashierOperation[]> {
  if (!name) return [];
  const { data, error } = await cashierClient
    .from("operations")
    .select("*")
    .or(`barber.eq.${name},assistant.eq.${name}`)
    .order("created_at", { ascending: false })
    .limit(200);
  logErr("operations", error);
  return (data as CashierOperation[]) ?? [];
}

/** Sum of the employee's share across all operations. */
export function computeEarnings(name: string, ops: CashierOperation[]): number {
  let total = 0;
  for (const o of ops) {
    const asBarber = o.barber === name;
    const asAssistant = o.assistant === name;
    if (asBarber && typeof o.barber_commission === "number") total += Number(o.barber_commission);
    else if (asAssistant && typeof o.assistant_commission === "number") total += Number(o.assistant_commission);
    else if (typeof o.commission === "number") total += Number(o.commission);
  }
  return total;
}

export async function fetchCashierWithdrawals(name: string): Promise<CashierWithdrawal[]> {
  if (!name) return [];
  const { data, error } = await cashierClient
    .from("withdrawals")
    .select("*")
    .eq("employee_name", name)
    .order("created_at", { ascending: false })
    .limit(100);
  logErr("withdrawals", error);
  return (data as CashierWithdrawal[]) ?? [];
}

export type CashierAttendance = {
  id?: string | number;
  employee_name?: string;
  attendance_date?: string;
  check_in?: string | null;
  check_out?: string | null;
  [k: string]: any;
};

export async function fetchCashierAttendance(name: string): Promise<CashierAttendance[]> {
  if (!name) return [];
  const { data, error } = await cashierClient
    .from("attendance")
    .select("*")
    .eq("employee_name", name)
    .order("attendance_date", { ascending: false })
    .limit(60);
  logErr("attendance:list", error);
  return (data as CashierAttendance[]) ?? [];
}

export type CashierAttendanceWrite = {
  employee_name: string;
  attendance_date: string; // YYYY-MM-DD
  check_in?: string | null; // ISO
  check_out?: string | null; // ISO
};

/**
 * Upsert-style attendance write to the cashier project.
 * - If no row exists for (employee_name, attendance_date) → insert check_in.
 * - If a row exists without check_out → update check_out.
 * Returns "in" | "out" | null.
 */
export async function writeCashierAttendance(name: string, action: "in" | "out"): Promise<"in" | "out" | null> {
  if (!name) return null;
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  try {
    const { data: existing, error: selErr } = await cashierClient
      .from("attendance")
      .select("id,check_in,check_out")
      .eq("employee_name", name)
      .eq("attendance_date", today)
      .maybeSingle();
    logErr("attendance:select", selErr);

    if (action === "in" && !existing) {
      const { error } = await cashierClient.from("attendance").insert({
        employee_name: name,
        attendance_date: today,
        check_in: nowIso,
      });
      logErr("attendance:insert", error);
      return error ? null : "in";
    }

    if (action === "out" && existing && !existing.check_out) {
      const { error } = await cashierClient
        .from("attendance")
        .update({ check_out: nowIso })
        .eq("id", existing.id);
      logErr("attendance:update", error);
      return error ? null : "out";
    }
  } catch (e) {
    logErr("attendance", e);
  }
  return null;
}

// Server-side proxy to the external Cashier Supabase project.
// - Uses only the publishable (anon) key stored in integration_settings.
// - Never uses service_role.
// - Validates the caller via requireSupabaseAuth, then looks up their
//   cashier_employee_id and forwards it to the cashier edge function.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ==================== Types ====================

export type CashierEmployeeStats = {
  services_count: number;
  clients_count: number;
  commissions_total: number;
  balance_due: number;
  requests: Array<{
    id: string;
    type: string;
    status: string;
    created_at: string;
    note?: string | null;
  }>;
  updated_at: string;
};

export type CashierStatsResult =
  | { ok: true; data: CashierEmployeeStats; source: "cashier" }
  | { ok: false; error: string; code: "not_configured" | "not_linked" | "upstream_error" | "network_error" };

export type WalletData = {
  current_balance: number;
  available_balance: number;
  pending_balance: number;
  monthly_income: number;
  daily_income: number;
  last_transactions: WalletTransaction[];
};

export type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string;
  created_at: string;
};

export type AttendanceSyncPayload = {
  action: "check_in" | "check_out";
  action_time: string;
  branch_id?: string;
  latitude?: number;
  longitude?: number;
  device_info?: string;
};

export type EmployeeMapping = {
  employee_id: string;
  cashier_employee_id: string;
  cashier_user_id?: string;
  branch_id?: string;
  active: boolean;
};

// ==================== Integration Settings ====================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ==================== Helper Functions ====================

async function getIntegrationSettings(supabase: any) {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getEmployeeCashierMapping(supabase: any, employeeId: string) {
  const { data, error } = await supabase
    .from("cashier_employee_mapping")
    .select("cashier_employee_id, branch_id")
    .eq("employee_id", employeeId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function logSyncActivity(
  supabase: any,
  syncType: string,
  direction: "to_cashier" | "from_cashier",
  employeeId: string | null,
  payload: any,
  response: any,
  status: "pending" | "success" | "failed",
  errorMessage?: string
) {
  try {
    await supabase.from("sync_audit_log").insert({
      sync_type: syncType,
      direction,
      employee_id: employeeId,
      payload,
      response,
      status,
      error_message: errorMessage || null,
      sent_at: direction === "to_cashier" ? new Date().toISOString() : null,
      received_at: direction === "from_cashier" && status === "success" ? new Date().toISOString() : null,
    });
  } catch (e) {
    console.error("Failed to log sync activity:", e);
  }
}

async function callCashierFunction(
  settings: any,
  functionPath: string,
  cashierEmployeeId: string,
  payload?: any
): Promise<{ ok: boolean; data?: any; error?: string; status?: number }> {
  const base = settings.cashier_url.replace(/\/+$/, "");
  const path = functionPath.startsWith("/") ? functionPath : `/functions/v1/${functionPath}`;
  const url = `${base}${path}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: settings.cashier_publishable_key,
        Authorization: `Bearer ${settings.cashier_publishable_key}`,
        "x-cashier-employee-id": cashierEmployeeId,
      },
      body: payload ? JSON.stringify({ ...payload, cashier_employee_id: cashierEmployeeId }) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `فشل الاتصال (${res.status})`, status: res.status };
    }

    const json = await res.json();
    return { ok: true, data: json };
  } catch (err) {
    console.error("[cashier] network error", err);
    return { ok: false, error: "تعذّر الوصول لخادم الكاشير" };
  }
}

// ==================== Get Cashier Employee Stats ====================

export const getCashierEmployeeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashierStatsResult> => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    if (!settings?.enabled || !settings.cashier_url || !settings.cashier_publishable_key) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل", code: "not_configured" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      // Fallback to profile's cashier_employee_id
      const { data: profileRow } = await supabase
        .from("employee_profiles")
        .select("cashier_employee_id")
        .eq("id", userId)
        .maybeSingle();
      const cashierEmployeeId = profileRow?.cashier_employee_id;
      if (!cashierEmployeeId) {
        return { ok: false, error: "لم يتم ربط حسابك برقم موظف في الكاشير", code: "not_linked" };
      }
    }

    const cashierEmployeeId = mapping?.cashier_employee_id ||
      (await supabase.from("employee_profiles").select("cashier_employee_id").eq("id", userId).maybeSingle())?.data?.cashier_employee_id;

    if (!cashierEmployeeId) {
      return { ok: false, error: "لم يتم ربط حسابك برقم موظف في الكاشير", code: "not_linked" };
    }

    const path = settings.stats_function_path || "/functions/v1/employee-stats";
    const result = await callCashierFunction(
      { ...settings },
      path,
      cashierEmployeeId,
      { action: "get_stats" }
    );

    await logSyncActivity(supabase, "stats", "from_cashier", userId, null, result.data, result.ok ? "success" : "failed", result.error);

    if (!result.ok) {
      return { ok: false, error: result.error || "فشل الاتصال", code: "upstream_error" };
    }

    const json = result.data;
    return {
      ok: true,
      source: "cashier",
      data: {
        services_count: Number(json.services_count ?? 0),
        clients_count: Number(json.clients_count ?? 0),
        commissions_total: Number(json.commissions_total ?? 0),
        balance_due: Number(json.balance_due ?? 0),
        requests: Array.isArray(json.requests) ? json.requests : [],
        updated_at: String(json.updated_at ?? new Date().toISOString()),
      },
    };
  });

// ==================== Sync Attendance to Cashier ====================

export const syncAttendanceToCashier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = data as AttendanceSyncPayload;

    const settings = await getIntegrationSettings(supabase);
    if (!settings?.enabled || !settings.cashier_url || !settings.cashier_publishable_key) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل", synced: false };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير", synced: false };
    }

    const functionPath = settings.attendance_function_path || "/functions/v1/attendance-sync";

    // Log pending
    await logSyncActivity(supabase, "attendance", "to_cashier", userId, payload, null, "pending");

    const result = await callCashierFunction(
      settings,
      functionPath,
      mapping.cashier_employee_id,
      {
        ...payload,
        branch_id: payload.branch_id || mapping.branch_id,
      }
    );

    if (result.ok) {
      // Log success
      await logSyncActivity(supabase, "attendance", "to_cashier", userId, payload, result.data, "success");

      // Update local attendance record with cashier sync status
      // The local attendance is already saved by the client

      // Create notification
      await supabase.from("notifications").insert({
        employee_id: userId,
        title: payload.action === "check_in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف",
        body: `تمت المزامنة مع الكاشير بنجاح`,
        type: "system",
      });

      return { ok: true, synced: true, data: result.data };
    } else {
      // Log failure
      await logSyncActivity(supabase, "attendance", "to_cashier", userId, payload, null, "failed", result.error);
      return { ok: false, error: result.error, synced: false };
    }
  });

// ==================== Fetch Wallet from Cashier ====================

export const fetchWalletFromCashier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    if (!settings?.enabled || !settings.cashier_url || !settings.cashier_publishable_key) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const functionPath = settings.wallet_function_path || "/functions/v1/wallet-sync";

    // Log pending
    await logSyncActivity(supabase, "wallet", "from_cashier", userId, null, null, "pending");

    const result = await callCashierFunction(
      settings,
      functionPath,
      mapping.cashier_employee_id,
      { action: "get_wallet" }
    );

    if (result.ok && result.data) {
      await logSyncActivity(supabase, "wallet", "from_cashier", userId, null, result.data, "success");

      // Update connection status
      await supabase
        .from("integration_settings")
        .update({
          connection_status: "connected",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      return {
        ok: true,
        data: {
          current_balance: Number(result.data.current_balance ?? 0),
          available_balance: Number(result.data.available_balance ?? 0),
          pending_balance: Number(result.data.pending_balance ?? 0),
          monthly_income: Number(result.data.monthly_income ?? 0),
          daily_income: Number(result.data.daily_income ?? 0),
          last_transactions: result.data.transactions || [],
        } as WalletData,
      };
    }

    await logSyncActivity(supabase, "wallet", "from_cashier", userId, null, null, "failed", result.error);
    return { ok: false, error: result.error };
  });

// ==================== Test Connection ====================

export const testCashierConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    if (!settings?.cashier_url || !settings.cashier_publishable_key) {
      return { ok: false, error: "إعدادات الربط غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const startTime = Date.now();
    const path = settings.stats_function_path || "/functions/v1/employee-stats";
    const result = await callCashierFunction(settings, path, mapping.cashier_employee_id, { test: true });
    const latency = Date.now() - startTime;

    const connectionStatus = result.ok ? "connected" : "disconnected";
    await supabase
      .from("integration_settings")
      .update({
        connection_status: connectionStatus,
        last_sync_at: result.ok ? new Date().toISOString() : null,
      })
      .eq("id", settings.id);

    return {
      ok: result.ok,
      latency,
      error: result.error,
    };
  });

// ==================== Get Wallet History ====================

export const getWalletHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("employee_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      data: data?.map((t: any) => ({
        id: t.id,
        type: t.transaction_type,
        amount: Number(t.amount),
        balance_after: Number(t.balance_after || 0),
        description: t.description,
        reference_id: t.reference_id,
        created_at: t.created_at,
        cashier_synced: t.cashier_synced,
      })),
    };
  });

// ==================== Add Wallet Transaction (for webhook/sync) ====================

export const addWalletTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { type, amount, description, reference_id, reference_type, metadata, cashier_transaction_id } = data as any;

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from("wallet_transactions")
      .insert({
        employee_id: userId,
        transaction_type: type,
        amount,
        description,
        reference_id,
        reference_type,
        metadata: metadata || {},
        cashier_synced: !!cashier_transaction_id,
        cashier_transaction_id,
        synced_at: cashier_transaction_id ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    // Create notification
    const notificationTitles: Record<string, string> = {
      attendance_reward: "تم إضافة يومية",
      commission: "تم إضافة عمولة",
      salary: "تم صرف راتب",
      bonus: "تم إضافة مكافأة",
      advance: "تم اعتماد سلفة",
      deduction: "تم خصم مبلغ",
      withdrawal: "تم صرف مبلغ",
      refund: "تم استرداد مبلغ",
      adjustment: "تم تعديل الرصيد",
    };

    await supabase.from("notifications").insert({
      employee_id: userId,
      title: notificationTitles[type] || "تحديث الرصيد",
      body: `${description || "عملية مالية"} - المبلغ: ${Number(amount).toLocaleString("ar-EG")} ج.م`,
      type: "transaction",
    });

    return { ok: true, data: transaction };
  });

// ==================== Get Employee Mappings (Admin) ====================

export const getEmployeeMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isAdmin) {
      return { ok: false, error: "غير مصرح" };
    }

    const { data, error } = await supabase
      .from("cashier_employee_mapping")
      .select("*, employee_profiles(full_name, employee_code)")
      .order("created_at", { ascending: false });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data };
  });

// ==================== Upsert Employee Mapping (Admin) ====================

export const upsertEmployeeMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { employee_id, cashier_employee_id, cashier_user_id, branch_id, active } = data as any;

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isAdmin) {
      return { ok: false, error: "غير مصرح" };
    }

    const { data: mapping, error } = await supabase
      .from("cashier_employee_mapping")
      .upsert(
        {
          employee_id,
          cashier_employee_id,
          cashier_user_id,
          branch_id,
          active: active ?? true,
        },
        { onConflict: "employee_id" }
      )
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data: mapping };
  });

// ==================== Get Sync Audit Log (Admin) ====================

export const getSyncAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isAdmin) {
      return { ok: false, error: "غير مصرح" };
    }

    const { data, error } = await supabase
      .from("sync_audit_log")
      .select("*, employee_profiles(full_name, employee_code)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data };
  });

// ==================== Update Integration Settings ====================

export const updateIntegrationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isAdmin) {
      return { ok: false, error: "غير مصرح" };
    }

    const settings = data as any;

    const { data: existing } = await supabase
      .from("integration_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      result = await supabase
        .from("integration_settings")
        .update({
          cashier_url: settings.cashier_url,
          cashier_publishable_key: settings.cashier_publishable_key,
          stats_function_path: settings.stats_function_path,
          attendance_function_path: settings.attendance_function_path,
          wallet_function_path: settings.wallet_function_path,
          commission_function_path: settings.commission_function_path,
          sync_interval_seconds: settings.sync_interval_seconds,
          auto_sync_enabled: settings.auto_sync_enabled,
          enabled: settings.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("integration_settings")
        .insert({
          cashier_url: settings.cashier_url,
          cashier_publishable_key: settings.cashier_publishable_key,
          stats_function_path: settings.stats_function_path,
          attendance_function_path: settings.attendance_function_path,
          wallet_function_path: settings.wallet_function_path,
          commission_function_path: settings.commission_function_path,
          sync_interval_seconds: settings.sync_interval_seconds,
          auto_sync_enabled: settings.auto_sync_enabled,
          enabled: settings.enabled,
        })
        .select()
        .single();
    }

    if (result.error) {
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data };
  });

// ==================== Get Offline Queue ====================

export const getOfflineAttendanceQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("offline_attendance_queue")
      .select("*")
      .eq("employee_id", userId)
      .eq("synced", false)
      .order("created_at", { ascending: true });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data };
  });

// ==================== Process Offline Queue ====================

export const processOfflineQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Get pending items
    const { data: queue, error: queueError } = await supabase
      .from("offline_attendance_queue")
      .select("*")
      .eq("employee_id", userId)
      .eq("synced", false)
      .order("created_at", { ascending: true });

    if (queueError || !queue?.length) {
      return { ok: true, processed: 0, failed: 0 };
    }

    // Get settings and mapping
    const settings = await getIntegrationSettings(supabase);
    if (!settings?.enabled) {
      return { ok: false, error: "التكامل غير مفعل" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط" };
    }

    const functionPath = settings.attendance_function_path || "/functions/v1/attendance-sync";
    let processed = 0;
    let failed = 0;

    for (const item of queue) {
      const payload: AttendanceSyncPayload = {
        action: item.action,
        action_time: item.action_time,
        branch_id: item.branch_id || mapping.branch_id,
        latitude: item.latitude,
        longitude: item.longitude,
        device_info: item.device_info,
      };

      const result = await callCashierFunction(
        settings,
        functionPath,
        mapping.cashier_employee_id,
        payload
      );

      if (result.ok) {
        await supabase
          .from("offline_attendance_queue")
          .update({ synced: true, last_sync_attempt: new Date().toISOString() })
          .eq("id", item.id);
        processed++;
      } else {
        await supabase
          .from("offline_attendance_queue")
          .update({
            last_sync_attempt: new Date().toISOString(),
            sync_attempts: item.sync_attempts + 1,
            error_message: result.error,
          })
          .eq("id", item.id);
        failed++;
      }
    }

    return { ok: true, processed, failed };
  });

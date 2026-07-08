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

function getCashierEnvCredentials() {
  const url = process.env.CASHIER_SUPABASE_URL;
  const publishableKey = process.env.CASHIER_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.CASHIER_SERVICE_ROLE_KEY;

  return {
    url,
    publishableKey,
    serviceRoleKey,
    configured: !!(url && publishableKey),
  };
}

async function getIntegrationSettings(supabase: any) {
  const envCreds = getCashierEnvCredentials();

  const { data, error } = await supabase
    .from("integration_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  // Use environment variables for credentials, fallback to DB for backward compatibility
  return {
    ...data,
    cashier_url: envCreds.url || data?.cashier_url,
    cashier_publishable_key: envCreds.publishableKey || data?.cashier_publishable_key,
    has_env_credentials: envCreds.configured,
  };
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
  const base = (settings.cashier_url || "").replace(/\/+$/, "");
  const path = functionPath.startsWith("/") ? functionPath : `/functions/v1/${functionPath}`;
  const url = `${base}${path}`;

  const apiKey = settings.cashier_publishable_key;

  if (!base || !apiKey) {
    return { ok: false, error: "بيانات الاتصال بالكاشير غير مكتملة" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "x-cashier-employee-id": cashierEmployeeId,
      },
      body: payload ? JSON.stringify({ ...payload, cashier_employee_id: cashierEmployeeId }) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[cashier] error response:", res.status, text);
      return { ok: false, error: `فشل الاتصال (${res.status}): ${text.slice(0, 100)}`, status: res.status };
    }

    const json = await res.json();
    return { ok: true, data: json };
  } catch (err) {
    console.error("[cashier] network error", err);
    return { ok: false, error: "تعذّر الوصول لخادم الكاشير" };
  }
}

// Direct Cashier API call using service role for admin operations
async function callCashierServiceRole(
  endpoint: string,
  payload?: any
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const envCreds = getCashierEnvCredentials();

  if (!envCreds.configured || !envCreds.serviceRoleKey) {
    return { ok: false, error: "بيانات الاتصال بالكاشير غير مكتملة" };
  }

  const url = `${envCreds.url}/rest/v1/${endpoint}`;

  try {
    const res = await fetch(url, {
      method: payload ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: envCreds.serviceRoleKey,
        Authorization: `Bearer ${envCreds.serviceRoleKey}`,
        Prefer: payload ? "return=representation" : undefined,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `فشل الاتصال (${res.status})` };
    }

    const json = await res.json();
    return { ok: true, data: json };
  } catch (err) {
    console.error("[cashier] service role error", err);
    return { ok: false, error: "حدث خطأ في الاتصال" };
  }
}

// ==================== Get Cashier Employee Stats ====================

export const getCashierEmployeeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashierStatsResult> => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);

    // Check if integration is enabled or if env credentials are available
    const envCreds = getCashierEnvCredentials();
    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل", code: "not_configured" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال بالكاشير غير مكتملة", code: "not_configured" };
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
      settings,
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
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل", synced: false };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال بالكاشير غير مكتملة", synced: false };
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
      await logSyncActivity(supabase, "attendance", "to_cashier", userId, payload, result.data, "success");

      await supabase.from("notifications").insert({
        employee_id: userId,
        title: payload.action === "check_in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف",
        body: "تمت المزامنة مع الكاشير بنجاح",
        type: "system",
      });

      return { ok: true, synced: true, data: result.data };
    } else {
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
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال بالكاشير غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const functionPath = settings.wallet_function_path || "/functions/v1/wallet-sync";

    await logSyncActivity(supabase, "wallet", "from_cashier", userId, null, null, "pending");

    const result = await callCashierFunction(
      settings,
      functionPath,
      mapping.cashier_employee_id,
      { action: "get_wallet" }
    );

    if (result.ok && result.data) {
      await logSyncActivity(supabase, "wallet", "from_cashier", userId, null, result.data, "success");

      if (settings?.id) {
        await supabase
          .from("integration_settings")
          .update({
            connection_status: "connected",
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", settings.id);
      }

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
    const envCreds = getCashierEnvCredentials();

    if (!envCreds.configured && (!settings?.cashier_url || !settings?.cashier_publishable_key)) {
      return { ok: false, error: "إعدادات الربط غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const startTime = Date.now();
    const path = settings?.stats_function_path || "/functions/v1/employee-stats";
    const result = await callCashierFunction(settings, path, mapping.cashier_employee_id, { test: true });
    const latency = Date.now() - startTime;

    const connectionStatus = result.ok ? "connected" : "disconnected";

    if (settings?.id) {
      await supabase
        .from("integration_settings")
        .update({
          connection_status: connectionStatus,
          last_sync_at: result.ok ? new Date().toISOString() : null,
        })
        .eq("id", settings.id);
    }

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

    const { data: queue, error: queueError } = await supabase
      .from("offline_attendance_queue")
      .select("*")
      .eq("employee_id", userId)
      .eq("synced", false)
      .order("created_at", { ascending: true });

    if (queueError || !queue?.length) {
      return { ok: true, processed: 0, failed: 0 };
    }

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "التكامل غير مفعل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال غير مكتملة" };
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

      const result = await callCashierFunction(settings, functionPath, mapping.cashier_employee_id, payload);

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

// ==================== Sync Commissions from Cashier ====================

export const syncCommissionsFromCashier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const functionPath = settings.commission_function_path || "/functions/v1/commission-sync";

    const result = await callCashierFunction(settings, functionPath, mapping.cashier_employee_id, {
      action: "get_commissions",
    });

    if (result.ok && result.data?.commissions) {
      await logSyncActivity(supabase, "commission", "from_cashier", userId, null, result.data, "success");

      // Insert commissions as transactions
      for (const comm of result.data.commissions || []) {
        await supabase.from("wallet_transactions").upsert(
          {
            employee_id: userId,
            transaction_type: "commission",
            amount: comm.amount,
            description: comm.description || `عمولة خدمة ${comm.service_name || ""}`,
            reference_id: comm.id,
            reference_type: "cashier_commission",
            metadata: { service_name: comm.service_name, client_name: comm.client_name },
            cashier_synced: true,
            cashier_transaction_id: comm.id,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "reference_id,reference_type" }
        );
      }

      return { ok: true, count: result.data.commissions?.length || 0 };
    }

    await logSyncActivity(supabase, "commission", "from_cashier", userId, null, null, "failed", result.error);
    return { ok: false, error: result.error };
  });

// ==================== Sync Salary from Cashier ====================

export const syncSalaryFromCashier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const result = await callCashierFunction(settings, "/functions/v1/salary-sync", mapping.cashier_employee_id, {
      action: "get_salary",
    });

    if (result.ok && result.data) {
      await logSyncActivity(supabase, "salary", "from_cashier", userId, null, result.data, "success");

      return {
        ok: true,
        data: {
          base_salary: Number(result.data.base_salary ?? 0),
          allowances: Number(result.data.allowances ?? 0),
          deductions: Number(result.data.deductions ?? 0),
          net_salary: Number(result.data.net_salary ?? 0),
          payment_date: result.data.payment_date,
          payment_status: result.data.payment_status,
        },
      };
    }

    await logSyncActivity(supabase, "salary", "from_cashier", userId, null, null, "failed", result.error);
    return { ok: false, error: result.error };
  });

// ==================== Sync Advances from Cashier ====================

export const syncAdvancesFromCashier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const result = await callCashierFunction(settings, "/functions/v1/advance-sync", mapping.cashier_employee_id, {
      action: "get_advances",
    });

    if (result.ok && result.data?.advances) {
      await logSyncActivity(supabase, "advance", "from_cashier", userId, null, result.data, "success");

      for (const adv of result.data.advances || []) {
        await supabase.from("wallet_transactions").upsert(
          {
            employee_id: userId,
            transaction_type: "advance",
            amount: adv.amount,
            description: adv.description || "سلفة",
            reference_id: adv.id,
            reference_type: "cashier_advance",
            metadata: { approved_by: adv.approved_by, status: adv.status },
            cashier_synced: true,
            cashier_transaction_id: adv.id,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "reference_id,reference_type" }
        );
      }

      return { ok: true, count: result.data.advances?.length || 0 };
    }

    await logSyncActivity(supabase, "advance", "from_cashier", userId, null, null, "failed", result.error);
    return { ok: false, error: result.error };
  });

// ==================== Sync Withdrawals from Cashier ====================

export const syncWithdrawalsFromCashier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!settings?.enabled && !envCreds.configured) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال غير مكتملة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);
    if (!mapping) {
      return { ok: false, error: "الموظف غير مرتبط بالكاشير" };
    }

    const result = await callCashierFunction(settings, "/functions/v1/withdrawal-sync", mapping.cashier_employee_id, {
      action: "get_withdrawals",
    });

    if (result.ok && result.data?.withdrawals) {
      await logSyncActivity(supabase, "withdrawal", "from_cashier", userId, null, result.data, "success");

      for (const wd of result.data.withdrawals || []) {
        await supabase.from("wallet_transactions").upsert(
          {
            employee_id: userId,
            transaction_type: "withdrawal",
            amount: wd.amount,
            description: wd.description || "صرف",
            reference_id: wd.id,
            reference_type: "cashier_withdrawal",
            metadata: { approved_by: wd.approved_by, method: wd.method },
            cashier_synced: true,
            cashier_transaction_id: wd.id,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "reference_id,reference_type" }
        );
      }

      return { ok: true, count: result.data.withdrawals?.length || 0 };
    }

    await logSyncActivity(supabase, "withdrawal", "from_cashier", userId, null, null, "failed", result.error);
    return { ok: false, error: result.error };
  });

// ==================== Get Cashier Employee Info ====================

export const getCashierEmployeeInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!envCreds.configured) {
      return { ok: false, error: "بيانات الكاشير غير مُعدة" };
    }

    const mapping = await getEmployeeCashierMapping(supabase, userId);

    return {
      ok: true,
      data: {
        mapping,
        cashier_url: envCreds.url,
        is_configured: envCreds.configured,
      },
    };
  });

// ==================== Full Sync (Admin) ====================

export const runFullSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!isAdmin) {
      return { ok: false, error: "غير مصرح" };
    }

    const settings = await getIntegrationSettings(supabase);
    const envCreds = getCashierEnvCredentials();

    if (!envCreds.configured && !settings?.enabled) {
      return { ok: false, error: "التكامل غير مُفعّل" };
    }

    if (!settings?.cashier_url || !settings?.cashier_publishable_key) {
      return { ok: false, error: "بيانات الاتصال غير مكتملة" };
    }

    const { data: mappings } = await supabase
      .from("cashier_employee_mapping")
      .select("employee_id, cashier_employee_id")
      .eq("active", true);

    const results = {
      wallet: { success: 0, failed: 0 },
      total_employees: mappings?.length || 0,
    };

    for (const m of mappings || []) {
      const result = await callCashierFunction(
        settings,
        settings.wallet_function_path || "/functions/v1/wallet-sync",
        m.cashier_employee_id,
        { action: "get_wallet" }
      );

      if (result.ok) {
        results.wallet.success++;
      } else {
        results.wallet.failed++;
      }
    }

    await supabase
      .from("integration_settings")
      .update({
        last_sync_at: new Date().toISOString(),
        connection_status: "connected",
      })
      .eq("id", settings.id);

    return { ok: true, results };
  });

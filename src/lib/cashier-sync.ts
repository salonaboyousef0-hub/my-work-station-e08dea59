// Cashier Sync Utilities
// These functions handle syncing between Staff Hub and Cashier systems

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export type SyncDirection = 'to_cashier' | 'from_cashier';
export type SyncStatus = 'pending' | 'success' | 'failed';
export type TransactionType =
  | 'attendance_reward'
  | 'commission'
  | 'salary'
  | 'bonus'
  | 'advance'
  | 'deduction'
  | 'withdrawal'
  | 'refund'
  | 'adjustment';

export interface IntegrationSettings {
  id?: string;
  cashier_url: string;
  cashier_publishable_key: string;
  stats_function_path: string;
  attendance_function_path: string;
  wallet_function_path: string;
  commission_function_path: string;
  sync_interval_seconds: number;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  connection_status: string;
  enabled: boolean;
}

export interface WalletData {
  current_balance: number;
  available_balance: number;
  pending_balance: number;
  last_transactions: WalletTransaction[];
  monthly_income: number;
  daily_income: number;
}

export interface WalletTransaction {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string;
  created_at: string;
  cashier_synced: boolean;
}

export interface AttendanceSyncPayload {
  employee_id: string;
  cashier_employee_id: string;
  action: 'check_in' | 'check_out';
  action_time: string;
  branch_id?: string;
  latitude?: number;
  longitude?: number;
  device_info?: string;
}

// Get integration settings
export async function getIntegrationSettings(): Promise<IntegrationSettings | null> {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationSettings | null;
}

// Get employee mapping
export async function getEmployeeMapping(employeeId: string): Promise<{
  cashier_employee_id: string;
  branch_id?: string;
} | null> {
  const { data, error } = await supabase
    .from("cashier_employee_mapping")
    .select("cashier_employee_id, branch_id")
    .eq("employee_id", employeeId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Log sync activity
export async function logSyncActivity(
  syncType: string,
  direction: SyncDirection,
  employeeId?: string,
  payload?: any,
  response?: any,
  status: SyncStatus = 'pending',
  errorMessage?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('log_sync_activity', {
    p_sync_type: syncType,
    p_direction: direction,
    p_employee_id: employeeId || null,
    p_payload: payload || null,
    p_response: response || null,
    p_status: status,
    p_error_message: errorMessage || null
  });

  if (error) {
    console.error('Failed to log sync activity:', error);
    return '';
  }
  return data || '';
}

// Call cashier edge function
async function callCashierFunction(
  functionName: string,
  payload: any,
  cashierEmployeeId: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const settings = await getIntegrationSettings();

  if (!settings?.enabled || !settings.cashier_url || !settings.cashier_publishable_key) {
    return { ok: false, error: "التكامل غير مفعل" };
  }

  const functionPath = functionName.startsWith('/') ? functionName : `/functions/v1/${functionName}`;
  const url = `${settings.cashier_url.replace(/\/+$/, '')}${functionPath}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.cashier_publishable_key,
        'Authorization': `Bearer ${settings.cashier_publishable_key}`,
        'x-cashier-employee-id': cashierEmployeeId,
      },
      body: JSON.stringify({ ...payload, cashier_employee_id: cashierEmployeeId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `فشل الاتصال (${res.status})` };
    }

    const json = await res.json();
    return { ok: true, data: json };
  } catch (err) {
    console.error('[cashier-sync] network error', err);
    return { ok: false, error: "تعذّر الوصول لخادم الكاشير" };
  }
}

// Sync attendance to cashier
export async function syncAttendanceToCashier(
  employeeId: string,
  action: 'check_in' | 'check_out',
  actionTime: Date,
  latitude?: number,
  longitude?: number,
  branchId?: string
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  // Get mapping
  const mapping = await getEmployeeMapping(employeeId);
  if (!mapping) {
    return { ok: false, synced: false, error: "الموظف غير مرتبط بالكاشير" };
  }

  const payload: AttendanceSyncPayload = {
    employee_id: employeeId,
    cashier_employee_id: mapping.cashier_employee_id,
    action,
    action_time: actionTime.toISOString(),
    branch_id: branchId || mapping.branch_id,
    latitude,
    longitude,
    device_info: navigator?.userAgent || 'Unknown',
  };

  const settings = await getIntegrationSettings();
  const functionPath = settings?.attendance_function_path || '/functions/v1/attendance-sync';

  // Log pending
  await logSyncActivity('attendance', 'to_cashier', employeeId, payload, null, 'pending');

  const result = await callCashierFunction(functionPath, payload, mapping.cashier_employee_id);

  if (result.ok) {
    // Log success
    await logSyncActivity('attendance', 'to_cashier', employeeId, payload, result.data, 'success');

    // Create notification
    await supabase.from('notifications').insert({
      employee_id: employeeId,
      title: action === 'check_in' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف',
      body: `تمت المزامنة مع الكاشير بنجاح - ${actionTime.toLocaleTimeString('ar-EG')}`,
      type: 'system',
    });

    return { ok: true, synced: true };
  } else {
    // Log failure
    await logSyncActivity('attendance', 'to_cashier', employeeId, payload, null, 'failed', result.error);

    // Queue offline if network error
    if (result.error?.includes('تعذّر')) {
      await queueOfflineAttendance(employeeId, action, actionTime, latitude, longitude, branchId);
      toast.info('تم الحفظ محلياً وسيتم الإرسال عند توفر الاتصال');
    }

    return { ok: false, synced: false, error: result.error };
  }
}

// Queue offline attendance
export async function queueOfflineAttendance(
  employeeId: string,
  action: 'check_in' | 'check_out',
  actionTime: Date,
  latitude?: number,
  longitude?: number,
  branchId?: string
): Promise<void> {
  await supabase.from('offline_attendance_queue').insert({
    employee_id: employeeId,
    action,
    action_time: actionTime.toISOString(),
    branch_id: branchId,
    latitude,
    longitude,
    device_info: navigator?.userAgent || 'Unknown',
    synced: false,
  });
}

// Process offline queue
export async function processOfflineQueue(): Promise<{ processed: number; failed: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { processed: 0, failed: 0 };

  const { data: queue, error } = await supabase
    .from('offline_attendance_queue')
    .select('*')
    .eq('employee_id', user.id)
    .eq('synced', false)
    .order('created_at', { ascending: true });

  if (error || !queue?.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    const result = await syncAttendanceToCashier(
      item.employee_id,
      item.action,
      new Date(item.action_time),
      item.latitude,
      item.longitude,
      item.branch_id
    );

    if (result.synced) {
      await supabase
        .from('offline_attendance_queue')
        .update({ synced: true, last_sync_attempt: new Date().toISOString() })
        .eq('id', item.id);
      processed++;
    } else {
      await supabase
        .from('offline_attendance_queue')
        .update({
          last_sync_attempt: new Date().toISOString(),
          sync_attempts: item.sync_attempts + 1,
          error_message: result.error
        })
        .eq('id', item.id);
      failed++;
    }
  }

  return { processed, failed };
}

// Fetch wallet from cashier
export async function fetchWalletFromCashier(
  employeeId: string
): Promise<WalletData | null> {
  const mapping = await getEmployeeMapping(employeeId);
  if (!mapping) return null;

  const settings = await getIntegrationSettings();
  const functionPath = settings?.wallet_function_path || '/functions/v1/wallet-sync';

  const result = await callCashierFunction(
    functionPath,
    { action: 'get_wallet' },
    mapping.cashier_employee_id
  );

  if (result.ok && result.data) {
    // Update local wallet transactions
    await syncWalletTransactions(employeeId, result.data.transactions || []);

    return {
      current_balance: Number(result.data.current_balance ?? 0),
      available_balance: Number(result.data.available_balance ?? 0),
      pending_balance: Number(result.data.pending_balance ?? 0),
      last_transactions: result.data.transactions?.slice(0, 10) || [],
      monthly_income: Number(result.data.monthly_income ?? 0),
      daily_income: Number(result.data.daily_income ?? 0),
    };
  }

  return null;
}

// Sync wallet transactions from cashier
async function syncWalletTransactions(
  employeeId: string,
  transactions: any[]
): Promise<void> {
  if (!transactions?.length) return;

  // Get existing transaction IDs
  const { data: existing } = await supabase
    .from('wallet_transactions')
    .select('cashier_transaction_id')
    .eq('employee_id', employeeId)
    .not('cashier_transaction_id', 'is', null);

  const existingIds = new Set(existing?.map(t => t.cashier_transaction_id) || []);

  // Filter new transactions
  const newTransactions = transactions.filter(t => !existingIds.has(t.id));

  if (newTransactions.length === 0) return;

  // Insert new transactions
  const inserts = newTransactions.map(t => ({
    employee_id: employeeId,
    transaction_type: t.type,
    amount: Number(t.amount),
    balance_after: Number(t.balance_after),
    reference_id: t.reference_id,
    reference_type: t.reference_type,
    description: t.description,
    metadata: t.metadata || {},
    cashier_synced: true,
    cashier_transaction_id: t.id,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('wallet_transactions')
    .insert(inserts);

  if (error) {
    console.error('Failed to sync wallet transactions:', error);
  }
}

// Add wallet transaction (for incoming sync from cashier)
export async function addWalletTransaction(
  employeeId: string,
  transactionType: TransactionType,
  amount: number,
  description: string,
  referenceId?: string,
  referenceType?: string,
  metadata?: any,
  cashierTransactionId?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert({
      employee_id: employeeId,
      transaction_type: transactionType,
      amount,
      description,
      reference_id: referenceId,
      reference_type: referenceType,
      metadata: metadata || {},
      cashier_synced: !!cashierTransactionId,
      cashier_transaction_id: cashierTransactionId,
      synced_at: cashierTransactionId ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  // Create notification
  const notificationTitles: Record<TransactionType, string> = {
    attendance_reward: 'تم إضافة يومية',
    commission: 'تم إضافة عمولة',
    salary: 'تم صرف راتب',
    bonus: 'تم إضافة مكافأة',
    advance: 'تم اعتماد سلفة',
    deduction: 'تم خصم مبلغ',
    withdrawal: 'تم صرف مبلغ',
    refund: 'تم استرداد مبلغ',
    adjustment: 'تم تعديل الرصيد',
  };

  await supabase.from('notifications').insert({
    employee_id: employeeId,
    title: notificationTitles[transactionType] || 'تحديث الرصيد',
    body: `${description} - المبلغ: ${amount.toLocaleString('ar-EG')} ج.م`,
    type: 'transaction',
  });

  return { ok: true, id: data.id };
}

// Get wallet history
export async function getWalletHistory(
  employeeId: string,
  limit: number = 50
): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(t => ({
    id: t.id,
    transaction_type: t.transaction_type as TransactionType,
    amount: Number(t.amount),
    balance_after: Number(t.balance_after || 0),
    description: t.description || '',
    reference_id: t.reference_id || '',
    created_at: t.created_at,
    cashier_synced: t.cashier_synced || false,
  }));
}

// Test connection
export async function testCashierConnection(): Promise<{
  ok: boolean;
  latency?: number;
  error?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "غير مسجل الدخول" };

  const mapping = await getEmployeeMapping(user.id);
  if (!mapping) return { ok: false, error: "الموظف غير مرتبط بالكاشير" };

  const settings = await getIntegrationSettings();
  if (!settings?.enabled) return { ok: false, error: "التكامل غير مفعل" };

  const start = Date.now();
  const result = await callCashierFunction(
    '/functions/v1/employee-stats',
    { test: true },
    mapping.cashier_employee_id
  );
  const latency = Date.now() - start;

  if (result.ok) {
    // Update connection status
    await supabase
      .from('integration_settings')
      .update({
        connection_status: 'connected',
        last_sync_at: new Date().toISOString()
      })
      .eq('id', settings.id);

    return { ok: true, latency };
  }

  // Update connection status
  await supabase
    .from('integration_settings')
    .update({ connection_status: 'disconnected' })
    .eq('id', settings.id);

  return { ok: false, error: result.error };
}

// Subscribe to wallet changes
export function subscribeToWalletChanges(
  employeeId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel('wallet-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'wallet_transactions',
        filter: `employee_id=eq.${employeeId}`
      },
      callback
    )
    .subscribe();
}

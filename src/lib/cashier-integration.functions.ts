// Server-side proxy to the external Cashier Supabase project.
// - Uses only the publishable (anon) key stored in integration_settings.
// - Never uses service_role.
// - Validates the caller via requireSupabaseAuth, then looks up their
//   cashier_employee_id and forwards it to the cashier edge function.
// - The cashier edge function is responsible for returning only that
//   employee's own aggregated data (services count, clients count,
//   commissions, balance, own requests).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const getCashierEmployeeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CashierStatsResult> => {
    const { supabase, userId } = context;

    const { data: settingsRow } = await supabase
      .from("integration_settings" as any)
      .select("cashier_url, cashier_publishable_key, stats_function_path, enabled")
      .limit(1)
      .maybeSingle();
    const settings = settingsRow as
      | { cashier_url: string | null; cashier_publishable_key: string | null; stats_function_path: string | null; enabled: boolean }
      | null;

    if (!settings || !settings.enabled || !settings.cashier_url || !settings.cashier_publishable_key) {
      return { ok: false, error: "الربط مع الكاشير غير مفعّل", code: "not_configured" };
    }

    const { data: profileRow } = await supabase
      .from("employee_profiles")
      .select("cashier_employee_id" as any)
      .eq("id", userId)
      .maybeSingle();
    const cashierEmployeeId = (profileRow as any)?.cashier_employee_id as string | null | undefined;

    if (!cashierEmployeeId) {
      return { ok: false, error: "لم يتم ربط حسابك برقم موظف في الكاشير", code: "not_linked" };
    }

    const base = settings.cashier_url.replace(/\/+$/, "");
    const path = (settings.stats_function_path || "/functions/v1/employee-stats").replace(/^\/*/, "/");
    const url = `${base}${path}?employee_id=${encodeURIComponent(cashierEmployeeId)}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          apikey: settings.cashier_publishable_key,
          Authorization: `Bearer ${settings.cashier_publishable_key}`,
          "x-employee-id": cashierEmployeeId,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[cashier] upstream ${res.status}: ${text}`);
        return { ok: false, error: `فشل الاتصال بالكاشير (${res.status})`, code: "upstream_error" };
      }

      const json = (await res.json()) as Partial<CashierEmployeeStats>;
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
    } catch (err) {
      console.error("[cashier] network error", err);
      return { ok: false, error: "تعذّر الوصول لخادم الكاشير", code: "network_error" };
    }
  });

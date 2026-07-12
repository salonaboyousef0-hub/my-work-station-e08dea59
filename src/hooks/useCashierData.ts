import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCashierOperations,
  fetchCashierWithdrawals,
  fetchCashierAttendance,
  computeEarnings,
  type CashierOperation,
  type CashierWithdrawal,
  type CashierAttendance,
} from "@/lib/cashier";

/**
 * Reads `cashier_name` from the signed-in employee's profile, then pulls
 * operations, withdrawals, and attendance from the cashier project keyed by
 * that name. All errors are swallowed (see `src/lib/cashier.ts`) so the UI
 * always renders whatever is available.
 */
export function useCashierData() {
  const [cashierName, setCashierName] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { if (!cancelled) setLoadingName(false); return; }
      const { data } = await supabase
        .from("employee_profiles")
        .select("cashier_name")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!cancelled) {
        setCashierName(((data as any)?.cashier_name ?? "").trim() || null);
        setLoadingName(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enabled = !!cashierName;

  const opsQ = useQuery<CashierOperation[]>({
    queryKey: ["cashier-data", "operations", cashierName],
    queryFn: () => fetchCashierOperations(cashierName!),
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const wdQ = useQuery<CashierWithdrawal[]>({
    queryKey: ["cashier-data", "withdrawals", cashierName],
    queryFn: () => fetchCashierWithdrawals(cashierName!),
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const attQ = useQuery<CashierAttendance[]>({
    queryKey: ["cashier-data", "attendance", cashierName],
    queryFn: () => fetchCashierAttendance(cashierName!),
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const operations = opsQ.data ?? [];
  const withdrawals = wdQ.data ?? [];
  const attendance = attQ.data ?? [];
  const earnings = cashierName ? computeEarnings(cashierName, operations) : 0;
  const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount ?? 0), 0);
  const netBalance = earnings - totalWithdrawn;

  return {
    cashierName,
    isLinked: enabled,
    isLoading: loadingName || opsQ.isLoading || wdQ.isLoading || attQ.isLoading,
    operations,
    withdrawals,
    attendance,
    earnings,
    totalWithdrawn,
    netBalance,
  };
}

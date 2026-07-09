import { useQuery } from "@tanstack/react-query";
import {
  fetchCashierOperations,
  fetchCashierWithdrawals,
  computeEarnings,
  type CashierOperation,
  type CashierWithdrawal,
} from "@/lib/cashier";

/**
 * Fetches everything the cashier project exposes for the given employee name.
 * All errors are swallowed inside the fetchers — this hook always resolves,
 * returning empty arrays when RLS blocks a table.
 */
export function useCashierByName(name?: string | null) {
  const enabled = !!name;

  const opsQ = useQuery<CashierOperation[]>({
    queryKey: ["cashier", "operations", name],
    queryFn: () => fetchCashierOperations(name!),
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const wdQ = useQuery<CashierWithdrawal[]>({
    queryKey: ["cashier", "withdrawals", name],
    queryFn: () => fetchCashierWithdrawals(name!),
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const operations = opsQ.data ?? [];
  const withdrawals = wdQ.data ?? [];
  const earnings = name ? computeEarnings(name, operations) : 0;
  const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount ?? 0), 0);
  const netBalance = earnings - totalWithdrawn;

  return {
    operations,
    withdrawals,
    earnings,
    totalWithdrawn,
    netBalance,
    isLoading: opsQ.isLoading || wdQ.isLoading,
  };
}

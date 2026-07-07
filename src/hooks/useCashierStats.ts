import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCashierEmployeeStats } from "@/lib/cashier-integration.functions";

/**
 * Polls the cashier project every 10 seconds for the current employee's stats.
 * Auth + employee mapping happen server-side; the client never sees the cashier keys.
 */
export function useCashierStats() {
  const fetchStats = useServerFn(getCashierEmployeeStats);
  return useQuery({
    queryKey: ["cashier-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

// Wallet sync hook with real-time updates
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchWalletFromCashier,
  getWalletHistory,
  type WalletData,
  type WalletTransaction,
} from "@/lib/cashier-integration.functions";

// Fetch wallet data from cashier
export function useWalletData() {
  const fetchWallet = useServerFn(fetchWalletFromCashier);

  const query = useQuery({
    queryKey: ["wallet-data"],
    queryFn: () => fetchWallet(),
    refetchInterval: 10_000, // Poll every 10 seconds
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  return {
    ...query,
    wallet: query.data?.data as WalletData | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.data?.ok === false ? query.data.error : null,
  };
}

// Fetch wallet history
export function useWalletHistory(limit: number = 50) {
  const fetchHistory = useServerFn(getWalletHistory);

  const query = useQuery({
    queryKey: ["wallet-history"],
    queryFn: () => fetchHistory(),
    staleTime: 30_000,
  });

  return {
    ...query,
    transactions: (query.data?.data || []) as WalletTransaction[],
    isLoading: query.isLoading,
  };
}

// Subscribe to real-time wallet changes
export function useWalletRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      // Subscribe to wallet_transactions changes
      const channel = supabase
        .channel("wallet-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `employee_id=eq.${user.id}`,
          },
          (payload) => {
            // Invalidate queries to refetch
            queryClient.invalidateQueries({ queryKey: ["wallet-data"] });
            queryClient.invalidateQueries({ queryKey: ["wallet-history"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, [queryClient]);
}

// Combined hook for wallet with realtime
export function useWallet() {
  const walletData = useWalletData();
  const walletHistory = useWalletHistory();

  useWalletRealtime();

  return {
    ...walletData,
    ...walletHistory,
    refresh: () => {
      walletData.refetch();
      walletHistory.refetch();
    },
  };
}

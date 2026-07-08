// Attendance sync hook with offline queue support
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  syncAttendanceToCashier,
  getOfflineAttendanceQueue,
  processOfflineQueue,
} from "@/lib/cashier-integration.functions";

// Check if online
function isOnline() {
  return navigator.onLine;
}

// Get current position
function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: true }
    );
  });
}

// Hook for single attendance sync operation
export function useAttendanceSync() {
  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: syncAttendanceToCashier,
  });

  // Check for offline queue on mount and when coming online
  const checkOfflineQueue = useCallback(async () => {
    if (!isOnline()) return;

    // Use processOfflineQueue server function
    const processQueue = useServerFn(processOfflineQueue);
    try {
      const result = (await processQueue()) as any;
      if ((result?.processed ?? 0) > 0) {
        toast.success(`تم إرسال ${result.processed} عملية حضور محفوظة`);
        queryClient.invalidateQueries({ queryKey: ["attendance"] });
        queryClient.invalidateQueries({ queryKey: ["wallet-data"] });
      }
    } catch (e) {
      console.error("Failed to process offline queue:", e);
    }
  }, [queryClient]);

  // Process offline queue when coming online
  useEffect(() => {
    const handleOnline = () => {
      checkOfflineQueue();
    };

    window.addEventListener("online", handleOnline);
    checkOfflineQueue(); // Check on mount

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [checkOfflineQueue]);

  // Sync attendance to cashier
  const syncAttendance = useCallback(
    async (
      action: "check_in" | "check_out",
      actionTime: Date,
      branchId?: string
    ): Promise<{ success: boolean; cached?: boolean }> => {
      const pos = await getPosition();

      // If offline, queue locally
      if (!isOnline()) {
        await (supabase as any).from("offline_attendance_queue").insert({
          employee_id: (await supabase.auth.getUser()).data.user?.id,
          action,
          action_time: actionTime.toISOString(),
          branch_id: branchId,
          latitude: pos?.coords.latitude,
          longitude: pos?.coords.longitude,
          device_info: navigator.userAgent,
          synced: false,
        });

        toast.info("تم الحفظ محلياً - سيتم الإرسال عند توفر الاتصال");
        return { success: true, cached: true };
      }

      // Try to sync
      try {
        const result = await syncMutation.mutateAsync({
          data: {
            action,
            action_time: actionTime.toISOString(),
            branch_id: branchId,
            latitude: pos?.coords.latitude,
            longitude: pos?.coords.longitude,
            device_info: navigator.userAgent,
          },
        });

        if (result?.ok) {
          return { success: true };
        } else {
          // Queue locally if sync failed
          await (supabase as any).from("offline_attendance_queue").insert({
            employee_id: (await supabase.auth.getUser()).data.user?.id,
            action,
            action_time: actionTime.toISOString(),
            branch_id: branchId,
            latitude: pos?.coords.latitude,
            longitude: pos?.coords.longitude,
            device_info: navigator.userAgent,
            synced: false,
            error_message: result?.error,
          });

          toast.error(result?.error || "فشل الإرسال - تم الحفظ محلياً");
          return { success: true, cached: true };
        }
      } catch (e: any) {
        toast.error(e.message || "حدث خطأ");
        return { success: false };
      }
    },
    [syncMutation]
  );

  return {
    syncAttendance,
    isSyncing: syncMutation.isPending,
    processOfflineQueue: checkOfflineQueue,
  };
}

// Hook to fetch offline queue status
export function useOfflineQueue() {
  const fetchQueue = useServerFn(getOfflineAttendanceQueue);

  const query = useQuery({
    queryKey: ["offline-attendance-queue"],
    queryFn: () => fetchQueue(),
    refetchInterval: 30_000, // Check every 30 seconds
  });

  return {
    ...query,
    pendingItems: (query.data?.data || []) as any[],
    pendingCount: (query.data?.data || []).length,
  };
}

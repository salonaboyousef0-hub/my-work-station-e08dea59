import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, MapPin, QrCode, Wifi, WifiOff, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMonthAttendanceStats, getTodayAttendance } from "@/lib/queries";
import { syncAttendanceToCashier, getOfflineAttendanceQueue } from "@/lib/cashier-integration.functions";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "الحضور والانصراف" }] }),
  component: AttendancePage,
});

function fmtTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function AttendancePage() {
  const qc = useQueryClient();
  const { data: today, refetch: refetchToday } = useQuery({ queryKey: ["att-today"], queryFn: getTodayAttendance });
  const { data: month = [], refetch: refetchMonth } = useQuery({ queryKey: ["att-month"], queryFn: getMonthAttendanceStats });
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Get offline queue status
  const fetchOfflineQueue = useServerFn(getOfflineAttendanceQueue);
  const { data: offlineData } = useQuery({
    queryKey: ["offline-queue"],
    queryFn: () => fetchOfflineQueue(),
  });
  const pendingCount = (offlineData?.data || []).length;

  // Integration settings check
  const { data: settings } = useQuery({
    queryKey: ["integration_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("integration_settings").select("enabled").limit(1).maybeSingle();
      return data;
    },
  });
  const cashierEnabled = settings?.enabled;

  function getPosition(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(p => resolve(p), () => resolve(null), { timeout: 5000 });
    });
  }

  // Sync attendance to cashier
  async function syncToCashier(action: "check_in" | "check_out", branchId?: string) {
    if (!cashierEnabled) return;

    setSyncing(true);
    try {
      const pos = await getPosition();
      const syncFn = useServerFn(syncAttendanceToCashier);
      await (syncFn as any)({
        data: {
          action,
          action_time: new Date().toISOString(),
          branch_id: branchId,
          latitude: pos?.coords.latitude,
          longitude: pos?.coords.longitude,
          device_info: navigator.userAgent,
        },
      });
      // Refresh wallet data
      qc.invalidateQueries({ queryKey: ["wallet-data"] });
    } catch (e) {
      console.error("Cashier sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }

  async function checkIn() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مصرح");
      const pos = await getPosition();
      const { error } = await supabase.from("attendance").insert({
        employee_id: u.user.id,
        check_in_lat: pos?.coords.latitude ?? null,
        check_in_lng: pos?.coords.longitude ?? null,
      });
      if (error) {
        if (error.code === "23505") toast.error("تم تسجيل حضورك اليوم بالفعل");
        else throw error;
      } else {
        toast.success("تم تسجيل الحضور بنجاح");
        await Promise.all([refetchToday(), refetchMonth(), qc.invalidateQueries({ queryKey: ["att-month"] })]);
        // Sync to cashier in background
        syncToCashier("check_in");
      }
    } catch (e: any) { toast.error(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  }

  async function checkOut() {
    if (!today) return;
    setBusy(true);
    try {
      const pos = await getPosition();
      const { error } = await supabase.from("attendance").update({
        check_out: new Date().toISOString(),
        check_out_lat: pos?.coords.latitude ?? null,
        check_out_lng: pos?.coords.longitude ?? null,
      }).eq("id", today.id);
      if (error) throw error;
      toast.success("تم تسجيل الانصراف");
      await Promise.all([refetchToday(), refetchMonth()]);
      // Sync to cashier in background
      syncToCashier("check_out");
    } catch (e: any) { toast.error(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  }

  const checkedIn = !!today;
  const checkedOut = !!today?.check_out;

  return (
    <div>
      <PageHeader title="الحضور والانصراف" subtitle="سجل حضورك وانصرافك اليومي" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-elevated p-5 border border-border">
          <div className="flex items-center justify-center flex-col text-center py-2">
            <Clock className="size-10 text-primary" />
            <p className="text-3xl font-bold mt-2">{new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">حضور</p>
              <p className="text-lg font-bold text-success mt-1">{fmtTime(today?.check_in)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">انصراف</p>
              <p className="text-lg font-bold text-primary mt-1">{fmtTime(today?.check_out)}</p>
            </div>
          </div>

          {/* Offline queue indicator */}
          {pendingCount > 0 && (
            <div className="mt-4 bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-center gap-2">
              <WifiOff className="size-4 text-warning" />
              <p className="text-xs text-warning font-medium flex-1">
                {pendingCount} عملية حضور في انتظار المزامنة
              </p>
              <Upload className="size-4 text-warning animate-pulse" />
            </div>
          )}

          {/* Cashier sync status */}
          {cashierEnabled && syncing && (
            <div className="mt-3 text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Wifi className="size-3 animate-pulse" /> جاري المزامنة مع الكاشير...
              </p>
            </div>
          )}

          {!checkedIn && (
            <button onClick={checkIn} disabled={busy}
              className="mt-5 w-full bg-gradient-primary text-primary-foreground rounded-xl py-4 font-bold text-base shadow-card flex items-center justify-center gap-2 disabled:opacity-60">
              {syncing ? <Wifi className="size-5 animate-pulse" /> : <LogIn className="size-5" />} تسجيل حضور
            </button>
          )}
          {checkedIn && !checkedOut && (
            <button onClick={checkOut} disabled={busy}
              className="mt-5 w-full bg-warning text-warning-foreground rounded-xl py-4 font-bold text-base shadow-card flex items-center justify-center gap-2 disabled:opacity-60">
              {syncing ? <Wifi className="size-5 animate-pulse" /> : <LogOut className="size-5" />} تسجيل انصراف
            </button>
          )}
          {checkedOut && (
            <div className="mt-5 text-center p-4 bg-success/10 text-success rounded-xl font-semibold">
              تم إكمال يومك. شكراً لك!
            </div>
          )}
        </div>

        <Link to="/scan"
          className="flex items-center justify-center gap-2 bg-card border-2 border-primary/40 text-primary rounded-2xl py-4 font-bold shadow-card hover:bg-primary/5 transition">
          <QrCode className="size-5" /> مسح QR للحضور السريع
        </Link>

        <section>
          <h2 className="text-lg font-bold mb-3">سجل الشهر</h2>
          <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
            {month.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا يوجد سجل بعد</p>}
            {month.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-sm">{new Date(r.work_date).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" })}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="size-3" /> {fmtTime(r.check_in)} — {fmtTime(r.check_out)}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.check_out ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {r.check_out ? "مكتمل" : "حاضر"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

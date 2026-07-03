import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Bell, Wallet, CheckCircle2, XCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, getMonthAttendanceStats, getTransactions, getNotifications, getMyRoles } from "@/lib/queries";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "الرئيسية - تطبيق الموظفين" }] }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const { data: att = [] } = useQuery({ queryKey: ["att-month"], queryFn: getMonthAttendanceStats });
  const { data: tx = [] } = useQuery({ queryKey: ["tx"], queryFn: getTransactions });
  const { data: notifs = [] } = useQuery({ queryKey: ["notifs"], queryFn: getNotifications });
  const { data: roles = [] } = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const isStaff = roles.includes("admin") || roles.includes("manager");

  useEffect(() => {
    if (isStaff) navigate({ to: "/admin", replace: true });
  }, [isStaff, navigate]);


  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const todayDay = new Date().getDate();
  const presentDays = att.length;
  const absentDays = Math.max(0, todayDay - presentDays);
  const unreadCount = notifs.filter((n: any) => !n.is_read).length;

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.full_name ?? "م").trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("");

  return (
    <div>
      <header className="bg-gradient-primary text-primary-foreground px-5 pt-12 pb-20 rounded-b-[2rem] shadow-elevated relative">
        <div className="flex items-center justify-between">
          <Link to="/notifications" className="relative size-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 size-5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
          <button onClick={handleSignOut} className="size-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center" aria-label="تسجيل الخروج">
            <LogOut className="size-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
          <div>
            <p className="text-sm opacity-85">مرحباً بك</p>
            <h1 className="text-2xl font-bold">{profile?.full_name ?? "..."}</h1>
            <p className="text-sm opacity-85 mt-0.5">{profile?.job_title ?? ""} · {profile?.employee_code ?? ""}</p>
          </div>
        </div>
      </header>

      <main className="px-5 -mt-12 space-y-5 max-w-md mx-auto">
        {/* Balance card */}
        <div className="bg-card rounded-2xl shadow-elevated p-5 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
              <p className="text-3xl font-bold mt-1 text-primary">
                {Number(profile?.balance ?? 0).toLocaleString("ar-EG")} <span className="text-base font-medium">ج.م</span>
              </p>
            </div>
            <div className="size-14 rounded-2xl bg-gradient-gold flex items-center justify-center">
              <Wallet className="size-7 text-white" />
            </div>
          </div>
          <Link to="/financial" className="mt-4 flex items-center justify-between text-sm text-primary font-semibold">
            عرض التفاصيل <ArrowLeft className="size-4" />
          </Link>
        </div>

        {isStaff && (
          <Link to="/admin" className="bg-gradient-gold text-white rounded-2xl shadow-elevated p-4 flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ShieldCheck className="size-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold">لوحة الإدارة</p>
              <p className="text-xs opacity-90">دخول كصلاحية {roles.includes("admin") ? "Admin" : "Manager"}</p>
            </div>
            <ArrowLeft className="size-5" />
          </Link>
        )}


        {/* Attendance stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<CheckCircle2 className="size-5" />} label="أيام الحضور" value={presentDays} tone="success" />
          <StatCard icon={<XCircle className="size-5" />} label="أيام الغياب" value={absentDays} tone="destructive" />
        </div>
        <p className="text-xs text-muted-foreground text-center -mt-2">من أصل {daysInMonth} يوم في الشهر الحالي</p>

        {/* Recent transactions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">آخر العمليات</h2>
            <Link to="/financial" className="text-sm text-primary font-semibold">الكل</Link>
          </div>
          <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
            {tx.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد عمليات بعد</p>}
            {tx.slice(0, 5).map((t: any) => <TxRow key={t.id} tx={t} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "success" | "destructive" }) {
  const cls = tone === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border">
      <div className={`size-10 rounded-xl flex items-center justify-center ${cls}`}>{icon}</div>
      <p className="text-2xl font-bold mt-3">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function TxRow({ tx }: { tx: any }) {
  const meta = {
    earning: { label: "مستحقات", sign: "+", cls: "text-success" },
    payment: { label: "دفعة مستلمة", sign: "+", cls: "text-success" },
    advance: { label: "سلفة", sign: "−", cls: "text-warning" },
    deduction: { label: "خصم", sign: "−", cls: "text-destructive" },
  }[tx.type as "earning" | "payment" | "advance" | "deduction"];
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="font-semibold text-sm">{meta.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{new Date(tx.transaction_date).toLocaleDateString("ar-EG")}</p>
        {tx.notes && <p className="text-xs text-muted-foreground mt-1">{tx.notes}</p>}
      </div>
      <p className={`font-bold ${meta.cls}`}>{meta.sign} {Number(tx.amount).toLocaleString("ar-EG")}</p>
    </div>
  );
}

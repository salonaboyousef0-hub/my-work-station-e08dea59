import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Inbox, Clock, Sparkles } from "lucide-react";
import {
  adminGetEmployees, adminGetAllLeaveRequests, adminGetAllAdvanceRequests,
  adminGetAllGeneralRequests, adminGetServiceSubmissions,
} from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "لوحة الإدارة" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: emps = [] } = useQuery({ queryKey: ["admin-emps"], queryFn: adminGetEmployees });
  const { data: leave = [] } = useQuery({ queryKey: ["admin-leave"], queryFn: adminGetAllLeaveRequests });
  const { data: adv = [] } = useQuery({ queryKey: ["admin-adv"], queryFn: adminGetAllAdvanceRequests });
  const { data: gen = [] } = useQuery({ queryKey: ["admin-gen"], queryFn: adminGetAllGeneralRequests });
  const { data: services = [] } = useQuery({ queryKey: ["admin-services"], queryFn: adminGetServiceSubmissions });

  const activeEmps = emps.filter((e: any) => e.is_active).length;
  const pendingLeave = leave.filter((r: any) => r.status === "pending").length;
  const pendingAdv = adv.filter((r: any) => r.status === "pending").length;
  const pendingGen = gen.filter((r: any) => r.status === "pending").length;
  const pendingSvc = services.filter((s: any) => s.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Users className="size-5" />} label="موظفون نشطون" value={activeEmps} sub={`${emps.length} إجمالي`} />
        <Stat icon={<Inbox className="size-5" />} label="طلبات إجازة معلّقة" value={pendingLeave} tone="warning" />
        <Stat icon={<Clock className="size-5" />} label="طلبات سلف/عامة" value={pendingAdv + pendingGen} tone="warning" />
        <Stat icon={<Sparkles className="size-5" />} label="خدمات بانتظار الاعتماد" value={pendingSvc} tone="warning" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <QuickAction to="/admin/requests" title="مراجعة الطلبات" desc="موافقة أو رفض طلبات الموظفين" />
        <QuickAction to="/admin/finance" title="الحركات المالية" desc="إضافة مكافآت/خصومات واعتماد خدمات" />
        <QuickAction to="/admin/shifts" title="جدولة الشيفتات" desc="تعيين شيفت لكل موظف" />
        <QuickAction to="/admin/content" title="نشر إعلان/تدريب/هدف" desc="إدارة المحتوى للموظفين" />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone = "primary" }: { icon: React.ReactNode; label: string; value: number; sub?: string; tone?: "primary" | "warning" }) {
  const cls = tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary";
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border">
      <div className={`size-10 rounded-xl flex items-center justify-center ${cls}`}>{icon}</div>
      <p className="text-2xl font-bold mt-3">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function QuickAction({ to, title, desc }: { to: any; title: string; desc: string }) {
  return (
    <Link to={to} className="bg-card rounded-2xl p-4 shadow-card border border-border block hover:border-primary transition">
      <p className="font-bold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </Link>
  );
}

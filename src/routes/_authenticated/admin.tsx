import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Users, Inbox, Wallet, Calendar, Megaphone, ScrollText, LayoutDashboard, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user.id);
    const staff = (roles ?? []).some(r => r.role === "admin" || r.role === "manager");
    if (!staff) throw redirect({ to: "/home" });
    return { user: u.user };
  },
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "لوحة", icon: LayoutDashboard, exact: true },
  { to: "/admin/employees", label: "الموظفون", icon: Users },
  { to: "/admin/requests", label: "الطلبات", icon: Inbox },
  { to: "/admin/finance", label: "المالية", icon: Wallet },
  { to: "/admin/shifts", label: "الشيفتات", icon: Calendar },
  { to: "/admin/content", label: "المحتوى", icon: Megaphone },
  { to: "/admin/activity", label: "السجل", icon: ScrollText },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-primary text-primary-foreground px-5 pt-10 pb-6 shadow-elevated">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">لوحة الإدارة</h1>
            <p className="text-xs opacity-85">إدارة الموظفين والعمليات</p>
          </div>
          <Link to="/home" className="text-sm bg-white/15 backdrop-blur px-3 py-2 rounded-xl flex items-center gap-1">
            <ArrowRight className="size-4" /> تطبيق الموظف
          </Link>
        </div>
      </header>

      <nav className="bg-card border-b border-border sticky top-0 z-30 overflow-x-auto">
        <ul className="flex max-w-5xl mx-auto px-2">
          {TABS.map(t => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <li key={t.to}>
                <Link to={t.to} className={`flex items-center gap-1.5 px-3 py-3 text-sm font-semibold whitespace-nowrap border-b-2 ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
                  <t.icon className="size-4" /> {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="max-w-5xl mx-auto p-4 pb-24">
        <Outlet />
      </main>
    </div>
  );
}

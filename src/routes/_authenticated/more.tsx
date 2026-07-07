import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Plane, Sparkles, Target, Star, Megaphone, GraduationCap, Package, Wallet, ChartBar as BarChart3, Bell, MessageSquare, LogOut, ChevronLeft, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({ meta: [{ title: "المزيد" }] }),
  component: MorePage,
});

const SECTIONS: { title: string; items: { to: any; label: string; icon: any; cls: string }[] }[] = [
  {
    title: "العمل والجدولة",
    items: [
      { to: "/shifts", label: "جدول الشيفتات", icon: Calendar, cls: "bg-primary/10 text-primary" },
      { to: "/leave", label: "طلبات الإجازة", icon: Plane, cls: "bg-info/10 text-info" },
      { to: "/service-log", label: "تسجيل الخدمات", icon: Sparkles, cls: "bg-warning/15 text-warning" },
    ],
  },
  {
    title: "الأداء والمكافآت",
    items: [
      { to: "/financial", label: "حسابي المالي", icon: Wallet, cls: "bg-success/15 text-success" },
      { to: "/wallet-history", label: "سجل المحفظة", icon: Receipt, cls: "bg-primary/10 text-primary" },
      { to: "/performance", label: "أدائي", icon: BarChart3, cls: "bg-primary/10 text-primary" },
      { to: "/goals", label: "الأهداف والمكافآت", icon: Target, cls: "bg-warning/15 text-warning" },
      { to: "/evaluations", label: "تقييمي", icon: Star, cls: "bg-info/10 text-info" },
    ],
  },
  {
    title: "الموارد والاتصال",
    items: [
      { to: "/announcements", label: "إعلانات الإدارة", icon: Megaphone, cls: "bg-info/10 text-info" },
      { to: "/training", label: "مركز التدريب", icon: GraduationCap, cls: "bg-primary/10 text-primary" },
      { to: "/assets", label: "العهد والأدوات", icon: Package, cls: "bg-success/15 text-success" },
      { to: "/requests", label: "مركز الطلبات", icon: MessageSquare, cls: "bg-warning/15 text-warning" },
      { to: "/notifications", label: "الإشعارات", icon: Bell, cls: "bg-destructive/10 text-destructive" },
    ],
  },
];

function MorePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div>
      <PageHeader title="القائمة الكاملة" subtitle="كل ما تحتاجه في مكان واحد" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto pb-4">
        {SECTIONS.map(sec => (
          <section key={sec.title}>
            <h2 className="text-sm font-bold text-muted-foreground mb-2 px-1">{sec.title}</h2>
            <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border overflow-hidden">
              {sec.items.map(it => (
                <Link key={it.label} to={it.to} className="flex items-center gap-3 p-4 active:bg-muted">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${it.cls}`}>
                    <it.icon className="size-5" />
                  </div>
                  <span className="flex-1 font-semibold text-sm">{it.label}</span>
                  <ChevronLeft className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <button onClick={signOut}
          className="w-full bg-destructive/10 text-destructive rounded-2xl py-4 font-bold flex items-center justify-center gap-2 mt-4">
          <LogOut className="size-5" /> تسجيل الخروج
        </button>
      </main>
    </div>
  );
}

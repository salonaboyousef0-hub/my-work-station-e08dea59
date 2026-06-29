import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getServices } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { Users, Sparkles, Coins } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({ meta: [{ title: "الأداء" }] }),
  component: PerfPage,
});

function PerfPage() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const today = services.filter((s: any) => s.service_date === todayStr);
  const month = services.filter((s: any) => s.service_date >= monthStartStr);

  const totalClients = month.reduce((s: number, x: any) => s + (x.client_count ?? 0), 0);
  const totalServices = month.length;
  const totalValue = month.reduce((s: number, x: any) => s + Number(x.service_value), 0);

  return (
    <div>
      <PageHeader title="أدائي" subtitle="إحصائيات عملك الشخصية" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Users className="size-5" />} value={totalClients} label="عميل" />
          <Stat icon={<Sparkles className="size-5" />} value={totalServices} label="خدمة" />
          <Stat icon={<Coins className="size-5" />} value={totalValue} label="ج.م" />
        </div>

        <Section title="اليوم" items={today} />
        <Section title="هذا الشهر" items={month} />
      </main>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border text-center">
      <div className="size-10 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">{icon}</div>
      <p className="text-xl font-bold mt-2">{value.toLocaleString("ar-EG")}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد خدمات</p>}
        {items.map((s: any) => (
          <div key={s.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{s.service_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(s.service_date).toLocaleDateString("ar-EG")} · {s.client_count} عميل
              </p>
            </div>
            <p className="font-bold text-primary">{Number(s.service_value).toLocaleString("ar-EG")} ج.م</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, getTransactions } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { TxRow } from "@/routes/_authenticated/home";
import { useCashierByName } from "@/hooks/useCashierByName";

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "الحساب المالي" }] }),
  component: FinancialPage,
});

function sumBy(arr: any[], type: string) {
  return arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
}

function FinancialPage() {
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const { data: tx = [] } = useQuery({ queryKey: ["tx"], queryFn: getTransactions });
  const cashier = useCashierByName(profile?.full_name);

  const earnings = sumBy(tx, "earning");
  const advances = sumBy(tx, "advance");
  const deductions = sumBy(tx, "deduction");
  const payments = sumBy(tx, "payment");

  return (
    <div>
      <PageHeader title="حسابي المالي" subtitle="جميع حركاتك المالية في مكان واحد" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-elevated p-5 border border-border text-center">
          <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
          <p className="text-4xl font-bold text-primary mt-2">
            {Number(profile?.balance ?? 0).toLocaleString("ar-EG")} <span className="text-lg">ج.م</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile label="إجمالي المستحقات" value={earnings} tone="success" />
          <Tile label="الدفعات المستلمة" value={payments} tone="primary" />
          <Tile label="السلف" value={advances} tone="warning" />
          <Tile label="الخصومات" value={deductions} tone="destructive" />
        </div>

        {/* Cashier project (live) */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center justify-between">
            <span>من الكاشير (مباشر)</span>
            <span className="text-xs text-muted-foreground font-normal">تحديث كل 10 ثوانٍ</span>
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="أرباح الكاشير" value={cashier.earnings} tone="success" />
            <Tile label="السحوبات" value={cashier.totalWithdrawn} tone="warning" />
            <Tile label="الصافي" value={cashier.netBalance} tone="primary" />
          </div>

          <div className="bg-card rounded-2xl shadow-card border border-border">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">آخر السحوبات</div>
            {cashier.withdrawals.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد سحوبات</p>
            )}
            <ul className="divide-y divide-border">
              {cashier.withdrawals.slice(0, 10).map((w, i) => (
                <li key={w.id ?? i} className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(w.created_at ?? w.date ?? "").toString().slice(0, 10)}
                  </span>
                  <span className="font-bold text-warning">
                    {Number(w.amount ?? 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card rounded-2xl shadow-card border border-border">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">آخر العمليات</div>
            {cashier.operations.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد عمليات</p>
            )}
            <ul className="divide-y divide-border">
              {cashier.operations.slice(0, 15).map((o, i) => {
                const price = Number(o.price ?? o.amount ?? o.total ?? 0);
                const isBarber = o.barber === profile?.full_name;
                const role = isBarber ? "حلاق" : o.assistant === profile?.full_name ? "مساعد" : "";
                return (
                  <li key={o.id ?? i} className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {o.service ?? o.service_name ?? "خدمة"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(o.customer ?? o.customer_name ?? "")} · {role}
                      </p>
                    </div>
                    <span className="font-bold text-primary shrink-0">
                      {price.toLocaleString("ar-EG")} ج.م
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">تفاصيل الحركات</h2>
          <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
            {tx.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد حركات</p>}
            {tx.map((t: any) => <TxRow key={t.id} tx={t} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "success" | "primary" | "warning" | "destructive" }) {
  const cls = {
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card border border-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-2 ${cls}`}>{value.toLocaleString("ar-EG")} <span className="text-xs">ج.م</span></p>
    </div>
  );
}

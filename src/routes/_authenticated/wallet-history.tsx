// Wallet History page - displays financial timeline from cashier
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, TrendingUp, Clock, Gift, DollarSign, CircleArrowDown as ArrowDownCircle, CircleArrowUp as ArrowUpCircle, RefreshCw, CircleAlert as AlertCircle, Sparkles } from "lucide-react";
import { useWallet, useWalletRealtime } from "@/hooks/useWalletSync";
import { PageHeader } from "@/components/PageHeader";
import { getWalletHistory, type WalletTransaction } from "@/lib/cashier-integration.functions";

export const Route = createFileRoute("/_authenticated/wallet-history")({
  head: () => ({ meta: [{ title: "سجل المحفظة" }] }),
  component: WalletHistoryPage,
});

// Transaction type labels and icons
const TX_META: Record<
  string,
  { label: string; icon: any; color: string; bgColor: string; sign: string }
> = {
  attendance_reward: {
    label: "يومية حضور",
    icon: Clock,
    color: "text-success",
    bgColor: "bg-success/15",
    sign: "+",
  },
  commission: {
    label: "عمولة",
    icon: Sparkles,
    color: "text-primary",
    bgColor: "bg-primary/15",
    sign: "+",
  },
  salary: {
    label: "راتب",
    icon: DollarSign,
    color: "text-success",
    bgColor: "bg-success/15",
    sign: "+",
  },
  bonus: {
    label: "مكافأة",
    icon: Gift,
    color: "text-warning",
    bgColor: "bg-warning/15",
    sign: "+",
  },
  advance: {
    label: "سلفة",
    icon: TrendingUp,
    color: "text-warning",
    bgColor: "bg-warning/15",
    sign: "-",
  },
  deduction: {
    label: "خصم",
    icon: ArrowDownCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/15",
    sign: "-",
  },
  withdrawal: {
    label: "صرف",
    icon: ArrowUpCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/15",
    sign: "-",
  },
  refund: {
    label: "استرداد",
    icon: RefreshCw,
    color: "text-success",
    bgColor: "bg-success/15",
    sign: "+",
  },
  adjustment: {
    label: "تعديل",
    icon: AlertCircle,
    color: "text-primary",
    bgColor: "bg-primary/15",
    sign: "±",
  },
};

function WalletHistoryPage() {
  const wallet = useWallet();
  const fetchHistory = useServerFn(getWalletHistory);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["wallet-history"],
    queryFn: () => fetchHistory(),
  });

  const transactions = (historyData?.data || []) as WalletTransaction[];

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => ["attendance_reward", "commission", "salary", "bonus", "refund"].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalDeductions = transactions
    .filter((t) => ["advance", "deduction", "withdrawal"].includes(t.type))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div>
      <PageHeader title="سجل المحفظة" subtitle="جميع العمليات المالية من الكاشير" />

      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto pb-4">
        {/* Balance Card */}
        <div className="bg-gradient-primary text-primary-foreground rounded-2xl shadow-elevated p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-85">الرصيد الحالي</p>
              <p className="text-3xl font-bold mt-1">
                {Number(wallet.wallet?.current_balance || 0).toLocaleString("ar-EG")}{" "}
                <span className="text-base font-medium">ج.م</span>
              </p>
            </div>
            <div className="size-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Wallet className="size-7" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-80">متاح للصرف</p>
              <p className="text-lg font-bold mt-1">
                {Number(wallet.wallet?.available_balance || 0).toLocaleString("ar-EG")}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-xs opacity-80">قيد الانتظار</p>
              <p className="text-lg font-bold mt-1">
                {Number(wallet.wallet?.pending_balance || 0).toLocaleString("ar-EG")}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border text-center">
            <p className="text-xs text-muted-foreground">دخل الشهر</p>
            <p className="text-lg font-bold text-success mt-1">
              {Number(wallet.wallet?.monthly_income || 0).toLocaleString("ar-EG")}
            </p>
          </div>
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border text-center">
            <p className="text-xs text-muted-foreground">دخل اليوم</p>
            <p className="text-lg font-bold text-primary mt-1">
              {Number(wallet.wallet?.daily_income || 0).toLocaleString("ar-EG")}
            </p>
          </div>
          <div className="bg-card rounded-2xl p-4 shadow-card border border-border text-center">
            <p className="text-xs text-muted-foreground">عدد العمليات</p>
            <p className="text-lg font-bold mt-1">{transactions.length}</p>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الدخل</p>
              <p className="text-lg font-bold text-success">+{totalIncome.toLocaleString("ar-EG")} ج.م</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">إجمالي الخصومات</p>
              <p className="text-lg font-bold text-destructive">-{totalDeductions.toLocaleString("ar-EG")} ج.م</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">سجل العمليات</h2>
            {wallet.isFetching && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
          </div>

          {isLoading ? (
            <div className="bg-card rounded-2xl p-8 text-center border border-border">
              <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 text-center border border-border">
              <Wallet className="size-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">لا توجد عمليات بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx, idx) => {
                const meta = TX_META[tx.type] || TX_META.adjustment;
                const Icon = meta.icon;
                const isIncome = ["attendance_reward", "commission", "salary", "bonus", "refund"].includes(
                  tx.type
                );

                return (
                  <div
                    key={tx.id}
                    className="bg-card rounded-2xl p-4 shadow-card border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-11 rounded-xl flex items-center justify-center ${meta.bgColor} ${meta.color}`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{meta.label}</p>
                          <p className={`font-bold ${isIncome ? "text-success" : "text-destructive"}`}>
                            {meta.sign}
                            {Number(tx.amount).toLocaleString("ar-EG")} ج.م
                          </p>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{tx.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString("ar-EG", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {tx.cashier_synced && (
                            <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full">
                              من الكاشير
                            </span>
                          )}
                        </div>
                        {tx.balance_after > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            الرصيد بعد العملية: {tx.balance_after.toLocaleString("ar-EG")} ج.م
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sync Note */}
        <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
          <p>• البيانات تُحَدَّث تلقائياً كل 10 ثوانٍ.</p>
          <p>• جميع العمليات تأتي مباشرة من نظام الكاشير.</p>
          <p>• للحضور اليومي: يتم إضافة اليومية تلقائياً داخل المحفظة.</p>
        </div>
      </main>
    </div>
  );
}

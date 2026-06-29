import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target, Trophy } from "lucide-react";
import { getCurrentGoal, getServices } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "الأهداف والمكافآت" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { data: goal } = useQuery({ queryKey: ["goal"], queryFn: getCurrentGoal });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });

  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthServices = services.filter((s: any) => s.service_date >= monthStartStr && (s.status ?? "approved") === "approved");
  const doneCount = monthServices.length;
  const doneValue = monthServices.reduce((s: number, x: any) => s + Number(x.service_value), 0);

  const tgtCount = goal?.target_services ?? 0;
  const tgtValue = Number(goal?.target_value ?? 0);
  const pctCount = tgtCount ? Math.min(100, Math.round((doneCount / tgtCount) * 100)) : 0;
  const pctValue = tgtValue ? Math.min(100, Math.round((doneValue / tgtValue) * 100)) : 0;
  const achieved = pctCount >= 100 && pctValue >= 100;

  return (
    <div>
      <PageHeader title="هدف الشهر" subtitle="تتبّع إنجازك ومكافآتك" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        {!goal && (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <Target className="size-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">لم تحدد الإدارة هدفاً لهذا الشهر بعد</p>
          </div>
        )}
        {goal && (
          <>
            <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-5 shadow-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-85">مكافأة هذا الشهر</p>
                  <p className="text-3xl font-bold mt-1">{Number(goal.bonus_amount).toLocaleString("ar-EG")} <span className="text-base">ج.م</span></p>
                </div>
                <Trophy className="size-12 opacity-80" />
              </div>
              {goal.description && <p className="text-sm opacity-90 mt-3">{goal.description}</p>}
              {achieved && <p className="mt-3 bg-white/20 rounded-lg p-2 text-center text-sm font-bold">🎉 لقد حققت الهدف!</p>}
            </div>

            <ProgressCard label="عدد الخدمات" current={doneCount} target={tgtCount} pct={pctCount} unit="خدمة" />
            <ProgressCard label="قيمة الخدمات" current={doneValue} target={tgtValue} pct={pctValue} unit="ج.م" />
          </>
        )}
      </main>
    </div>
  );
}

function ProgressCard({ label, current, target, pct, unit }: { label: string; current: number; target: number; pct: number; unit: string }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold text-primary">{pct}%</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        {current.toLocaleString("ar-EG")} من {target.toLocaleString("ar-EG")} {unit}
      </p>
    </div>
  );
}

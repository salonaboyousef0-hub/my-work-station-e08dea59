import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getMyEvaluations } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({ meta: [{ title: "تقييمي" }] }),
  component: EvalPage,
});

const CRITERIA = [
  { key: "commitment", label: "الالتزام" },
  { key: "quality", label: "جودة العمل" },
  { key: "attitude", label: "التعامل" },
  { key: "hygiene", label: "النظافة" },
  { key: "customer_satisfaction", label: "رضا العملاء" },
] as const;

function EvalPage() {
  const { data: items = [] } = useQuery({ queryKey: ["evals"], queryFn: getMyEvaluations });

  const avg = (key: string) => {
    if (items.length === 0) return 0;
    return items.reduce((s: number, x: any) => s + Number(x[key] ?? 0), 0) / items.length;
  };
  const overall = items.length ? CRITERIA.reduce((s, c) => s + avg(c.key), 0) / CRITERIA.length : 0;

  return (
    <div>
      <PageHeader title="تقييم الأداء" subtitle="متوسط تقييمك من الإدارة" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-elevated p-6 border border-border text-center">
          <p className="text-sm text-muted-foreground">التقييم العام</p>
          <p className="text-5xl font-bold text-primary mt-2">{overall.toFixed(1)}<span className="text-2xl text-muted-foreground">/5</span></p>
          <div className="flex justify-center gap-1 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`size-6 ${i < Math.round(overall) ? "fill-warning text-warning" : "text-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">بناءً على {items.length} تقييم</p>
        </div>

        {items.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <p className="text-sm text-muted-foreground">لم يتم تقييمك بعد</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-card p-5 border border-border space-y-3">
            <h2 className="font-bold mb-2">تفاصيل المعايير</h2>
            {CRITERIA.map(c => {
              const v = avg(c.key);
              return (
                <div key={c.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{c.label}</span>
                    <span className="font-bold text-primary">{v.toFixed(1)}/5</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${(v / 5) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

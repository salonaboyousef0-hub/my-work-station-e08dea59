import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyShifts } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { Calendar, Coffee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shifts")({
  head: () => ({ meta: [{ title: "جدول العمل" }] }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const { data: shifts = [] } = useQuery({ queryKey: ["shifts"], queryFn: getMyShifts });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="جدول الشيفتات" subtitle="مواعيد العمل وأيام الراحة" />
      <main className="px-5 -mt-10 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
          {shifts.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">لم يتم جدولة أي شيفت بعد</p>}
          {shifts.map((s: any) => {
            const isToday = s.shift_date === today;
            return (
              <div key={s.id} className={`flex items-center justify-between p-4 ${isToday ? "bg-primary/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className={`size-11 rounded-xl flex items-center justify-center ${s.is_day_off ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {s.is_day_off ? <Coffee className="size-5" /> : <Calendar className="size-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{new Date(s.shift_date).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "short" })}</p>
                    {isToday && <span className="text-[10px] font-bold text-primary">اليوم</span>}
                    {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                  </div>
                </div>
                {s.is_day_off ? (
                  <span className="text-xs font-bold text-muted-foreground">راحة</span>
                ) : (
                  <span className="text-sm font-bold text-primary">{s.start_time?.slice(0,5)} — {s.end_time?.slice(0,5)}</span>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

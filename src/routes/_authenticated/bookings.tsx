import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, User, Scissors, Phone } from "lucide-react";
import { getMyBookings } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "حجوزاتي" }] }),
  component: BookingsPage,
});

type Range = "today" | "week" | "upcoming";

function BookingsPage() {
  const [range, setRange] = useState<Range>("today");
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", range],
    queryFn: () => getMyBookings(range),
  });

  const tabs: { key: Range; label: string }[] = [
    { key: "today", label: "اليوم" },
    { key: "week", label: "هذا الأسبوع" },
    { key: "upcoming", label: "القادمة" },
  ];

  return (
    <div>
      <PageHeader title="حجوزاتي" subtitle="مواعيد الزبائن الخاصة بك" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-card border border-border p-1 grid grid-cols-3 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setRange(t.key)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition ${
                range === t.key ? "bg-gradient-primary text-primary-foreground shadow-card" : "text-muted-foreground"
              }`}
            >{t.label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-8">جاري التحميل…</p>}
          {!isLoading && bookings.length === 0 && (
            <div className="bg-card rounded-2xl shadow-card border border-border p-8 text-center">
              <CalendarDays className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد حجوزات في هذه الفترة</p>
              <p className="text-xs text-muted-foreground mt-2">سيتم عرض الحجوزات هنا بمجرد ربط نظام الحجز الخارجي</p>
            </div>
          )}
          {bookings.map((b: any) => <BookingCard key={b.id} b={b} />)}
        </div>
      </main>
    </div>
  );
}

function BookingCard({ b }: { b: any }) {
  const start = new Date(b.starts_at);
  const statusMap: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "مجدول", cls: "bg-info/10 text-info" },
    confirmed: { label: "مؤكد", cls: "bg-success/10 text-success" },
    completed: { label: "منتهي", cls: "bg-muted text-muted-foreground" },
    cancelled: { label: "ملغي", cls: "bg-destructive/10 text-destructive" },
    no_show: { label: "لم يحضر", cls: "bg-warning/10 text-warning" },
  };
  const s = statusMap[b.status] ?? statusMap.scheduled;

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-primary">
            <Clock className="size-4" />
            <p className="font-bold text-base">
              {start.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <span className="text-xs text-muted-foreground">
              · {start.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            <p className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> {b.customer_name ?? "زبون"}</p>
            {b.customer_phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4" /> {b.customer_phone}</p>}
            <p className="flex items-center gap-2"><Scissors className="size-4 text-muted-foreground" /> {b.service_name ?? "خدمة"}</p>
          </div>
        </div>
        <div className="text-left">
          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>
          {b.price != null && (
            <p className="text-sm font-bold mt-2">{Number(b.price).toLocaleString("ar-EG")} <span className="text-xs">ج.م</span></p>
          )}
        </div>
      </div>
      {b.notes && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">{b.notes}</p>}
    </div>
  );
}

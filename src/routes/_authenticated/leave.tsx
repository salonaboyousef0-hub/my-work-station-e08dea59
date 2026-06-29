import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLeaveRequests } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "طلبات الإجازة" }] }),
  component: LeavePage,
});

const LEAVE_LABEL: Record<string, string> = { vacation: "إجازة عادية", sick: "إجازة مرضية", personal: "ظرف شخصي", other: "أخرى" };
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-warning/15 text-warning" },
  approved: { label: "مقبولة", cls: "bg-success/15 text-success" },
  rejected: { label: "مرفوضة", cls: "bg-destructive/15 text-destructive" },
};

const schema = z.object({
  leave_type: z.enum(["vacation", "sick", "personal", "other"]),
  start_date: z.string().min(1, "اختر تاريخ البداية"),
  end_date: z.string().min(1, "اختر تاريخ النهاية"),
  reason: z.string().trim().max(500, "السبب طويل جداً").optional(),
}).refine(d => d.end_date >= d.start_date, { message: "تاريخ النهاية قبل البداية", path: ["end_date"] });

function LeavePage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["leave"], queryFn: getLeaveRequests });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "vacation" as const, start_date: "", end_date: "", reason: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مصرح");
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: u.user.id,
        ...parsed.data,
      });
      if (error) throw error;
      toast.success("تم إرسال طلب الإجازة");
      setOpen(false);
      setForm({ leave_type: "vacation", start_date: "", end_date: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["leave"] });
    } catch (e: any) { toast.error(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="طلبات الإجازة" subtitle="قدّم طلب إجازة وتابع حالته" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <button onClick={() => setOpen(true)}
          className="w-full bg-gradient-primary text-primary-foreground rounded-2xl py-4 font-bold shadow-elevated flex items-center justify-center gap-2">
          <Plus className="size-5" /> طلب إجازة جديد
        </button>

        <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
          {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات إجازة</p>}
          {items.map((r: any) => {
            const days = Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1;
            return (
              <div key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{LEAVE_LABEL[r.leave_type]}</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  من {new Date(r.start_date).toLocaleDateString("ar-EG")} إلى {new Date(r.end_date).toLocaleDateString("ar-EG")} · <span className="font-bold text-primary">{days} يوم</span>
                </p>
                {r.reason && <p className="text-sm mt-1">{r.reason}</p>}
                {r.admin_notes && <p className="text-xs mt-2 p-2 bg-muted rounded-lg">رد الإدارة: {r.admin_notes}</p>}
              </div>
            );
          })}
        </div>
      </main>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full bg-card rounded-t-3xl p-6 max-w-md mx-auto">
            <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">طلب إجازة</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <span className="text-sm font-medium block mb-1.5">نوع الإجازة</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["vacation", "sick", "personal", "other"] as const).map(t => (
                    <button type="button" key={t} onClick={() => setForm(f => ({ ...f, leave_type: t as any }))}
                      className={`py-3 rounded-xl text-sm font-semibold border ${form.leave_type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}>
                      {LEAVE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">من تاريخ</span>
                <input type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-3 border border-border focus:border-primary" />
              </label>
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">إلى تاريخ</span>
                <input type="date" required value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-3 border border-border focus:border-primary" />
              </label>
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">السبب (اختياري)</span>
                <textarea rows={3} maxLength={500} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-3 border border-border focus:border-primary" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl bg-muted font-semibold">إلغاء</button>
                <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold disabled:opacity-60">إرسال</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

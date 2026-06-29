import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getServices } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/service-log")({
  head: () => ({ meta: [{ title: "تسجيل خدمة" }] }),
  component: ServiceLogPage,
});

const schema = z.object({
  service_name: z.string().trim().min(2, "اسم الخدمة قصير").max(120),
  service_date: z.string().min(1, "اختر التاريخ"),
  client_count: z.number().int().min(1).max(100),
  service_value: z.number().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional(),
});

const STATUS_ICON: Record<string, { icon: any; cls: string; label: string }> = {
  pending: { icon: Clock, cls: "text-warning", label: "قيد الاعتماد" },
  approved: { icon: CheckCircle2, cls: "text-success", label: "معتمدة" },
  rejected: { icon: XCircle, cls: "text-destructive", label: "مرفوضة" },
};

function ServiceLogPage() {
  const qc = useQueryClient();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ service_name: "", service_date: today, client_count: 1, service_value: 0, notes: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مصرح");
      const { error } = await supabase.from("employee_services").insert({
        employee_id: u.user.id,
        ...parsed.data,
        status: "pending",
        submitted_by_employee: true,
      });
      if (error) throw error;
      toast.success("تم إرسال الخدمة للاعتماد");
      setOpen(false);
      setForm({ service_name: "", service_date: today, client_count: 1, service_value: 0, notes: "" });
      qc.invalidateQueries({ queryKey: ["services"] });
    } catch (e: any) { toast.error(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="تسجيل الخدمات" subtitle="سجّل خدماتك للاعتماد من الإدارة" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <button onClick={() => setOpen(true)}
          className="w-full bg-gradient-primary text-primary-foreground rounded-2xl py-4 font-bold shadow-elevated flex items-center justify-center gap-2">
          <Plus className="size-5" /> تسجيل خدمة جديدة
        </button>

        <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
          {services.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد خدمات</p>}
          {services.map((s: any) => {
            const st = STATUS_ICON[s.status ?? "approved"];
            const Icon = st.icon;
            return (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Icon className={`size-5 mt-0.5 ${st.cls}`} />
                  <div>
                    <p className="font-semibold text-sm">{s.service_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.service_date).toLocaleDateString("ar-EG")} · {s.client_count} عميل · <span className={st.cls}>{st.label}</span>
                    </p>
                    {s.admin_notes && <p className="text-xs mt-1 p-1.5 bg-muted rounded">{s.admin_notes}</p>}
                  </div>
                </div>
                <p className="font-bold text-primary text-sm">{Number(s.service_value).toLocaleString("ar-EG")} ج.م</p>
              </div>
            );
          })}
        </div>
      </main>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full bg-card rounded-t-3xl p-6 max-w-md mx-auto">
            <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">تسجيل خدمة</h2>
            <form onSubmit={submit} className="space-y-3">
              <Input label="اسم الخدمة" value={form.service_name} onChange={v => setForm(f => ({ ...f, service_name: v }))} />
              <Input label="التاريخ" type="date" value={form.service_date} onChange={v => setForm(f => ({ ...f, service_date: v }))} />
              <Input label="عدد العملاء" type="number" value={String(form.client_count)} onChange={v => setForm(f => ({ ...f, client_count: Number(v) || 1 }))} />
              <Input label="قيمة الخدمة (ج.م)" type="number" value={String(form.service_value)} onChange={v => setForm(f => ({ ...f, service_value: Number(v) || 0 }))} />
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">ملاحظات</span>
                <textarea rows={2} maxLength={500} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-3 border border-border focus:border-primary" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl bg-muted font-semibold">إلغاء</button>
                <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold disabled:opacity-60">إرسال للاعتماد</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1.5">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required
        className="w-full bg-input rounded-xl px-4 py-3 border border-border focus:border-primary" />
    </label>
  );
}

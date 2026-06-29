import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Coffee, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminGetEmployees, adminGetShifts, logActivity } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/shifts")({
  head: () => ({ meta: [{ title: "الشيفتات - الإدارة" }] }),
  component: ShiftsAdmin,
});

function ShiftsAdmin() {
  const qc = useQueryClient();
  const { data: emps = [] } = useQuery({ queryKey: ["admin-emps"], queryFn: adminGetEmployees });
  const { data: shifts = [] } = useQuery({ queryKey: ["admin-shifts"], queryFn: adminGetShifts });
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", shift_date: today, start_time: "10:00", end_time: "22:00", is_day_off: false, notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) { toast.error("اختر موظف"); return; }
    const payload: any = {
      employee_id: form.employee_id,
      shift_date: form.shift_date,
      is_day_off: form.is_day_off,
      notes: form.notes || null,
      start_time: form.is_day_off ? null : form.start_time,
      end_time: form.is_day_off ? null : form.end_time,
    };
    const { data, error } = await supabase.from("shifts").upsert(payload, { onConflict: "employee_id,shift_date" }).select().single();
    if (error) { toast.error(error.message); return; }
    await logActivity("upsert_shift", "shifts", data.id, payload);
    toast.success("تم حفظ الشيفت");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-shifts"] });
  }

  async function del(s: any) {
    if (!confirm("حذف الشيفت؟")) return;
    const { error } = await supabase.from("shifts").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await logActivity("delete_shift", "shifts", s.id);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["admin-shifts"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">الشيفتات ({shifts.length})</h2>
        <button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm">
          <Plus className="size-4" /> شيفت جديد
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {shifts.map((s: any) => (
          <div key={s.id} className={`flex items-center justify-between p-4 ${s.shift_date === today ? "bg-primary/5" : ""}`}>
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-xl flex items-center justify-center ${s.is_day_off ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                {s.is_day_off ? <Coffee className="size-5" /> : <Calendar className="size-5" />}
              </div>
              <div>
                <p className="font-semibold text-sm">{s.employee_profiles.full_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.shift_date).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" })} · {s.is_day_off ? "راحة" : `${s.start_time?.slice(0,5)} - ${s.end_time?.slice(0,5)}`}</p>
              </div>
            </div>
            <button onClick={() => del(s)} className="text-destructive p-2">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">شيفت جديد</h2>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium block mb-1">الموظف</span>
                <select required value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
                  <option value="">اختر</option>
                  {emps.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium block mb-1">التاريخ</span>
                <input type="date" required value={form.shift_date} onChange={e => setForm(f => ({ ...f, shift_date: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_day_off} onChange={e => setForm(f => ({ ...f, is_day_off: e.target.checked }))} />
                <span className="text-sm font-medium">يوم راحة</span>
              </label>
              {!form.is_day_off && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-sm font-medium block mb-1">من</span>
                    <input type="time" required value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full bg-input rounded-xl px-3 py-2.5 border border-border" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium block mb-1">إلى</span>
                    <input type="time" required value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full bg-input rounded-xl px-3 py-2.5 border border-border" />
                  </label>
                </div>
              )}
              <label className="block">
                <span className="text-sm font-medium block mb-1">ملاحظات</span>
                <input value={form.notes} maxLength={200} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-muted font-semibold">إلغاء</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

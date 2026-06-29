import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminGetAnnouncements, adminGetTraining, adminGetGoals, adminGetEmployees, logActivity,
} from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({ meta: [{ title: "المحتوى - الإدارة" }] }),
  component: ContentPage,
});

function ContentPage() {
  const [tab, setTab] = useState<"ann" | "train" | "goals">("ann");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        {[["ann", "إعلانات"], ["train", "تدريب"], ["goals", "أهداف"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-card shadow-card" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {tab === "ann" && <AnnTab />}
      {tab === "train" && <TrainTab />}
      {tab === "goals" && <GoalsTab />}
    </div>
  );
}

function AnnTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-ann"], queryFn: adminGetAnnouncements });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "general" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { data: row, error } = await supabase.from("announcements").insert({
      title: form.title.trim(), body: form.body.trim(), category: form.category, created_by: u.user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await logActivity("create_announcement", "announcements", row.id, { title: form.title });
    // Send notification to all employees
    const { data: emps } = await supabase.from("employee_profiles").select("id");
    if (emps && emps.length > 0) {
      await supabase.from("notifications").insert(emps.map(e => ({
        employee_id: e.id, title: `إعلان جديد: ${form.title}`, body: form.body.slice(0, 200), type: "announcement",
      })));
    }
    toast.success("تم النشر");
    setOpen(false); setForm({ title: "", body: "", category: "general" });
    qc.invalidateQueries({ queryKey: ["admin-ann"] });
  }

  async function del(id: string) {
    if (!confirm("حذف الإعلان؟")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logActivity("delete_announcement", "announcements", id);
    qc.invalidateQueries({ queryKey: ["admin-ann"] });
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm">
        <Plus className="size-4" /> إعلان جديد
      </button>
      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {data.map((a: any) => (
          <div key={a.id} className="p-4 flex justify-between gap-3">
            <div>
              <p className="font-bold">{a.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(a.published_at).toLocaleString("ar-EG")}</p>
            </div>
            <button onClick={() => del(a.id)} className="text-destructive p-2"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      {open && (
        <Modal close={() => setOpen(false)} title="نشر إعلان" onSubmit={submit}>
          <Field label="العنوان" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} required />
          <label className="block">
            <span className="text-sm font-medium block mb-1">التصنيف</span>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
              <option value="general">عام</option>
              <option value="news">خبر</option>
              <option value="instruction">تعليمات</option>
              <option value="alert">تنبيه</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium block mb-1">النص</span>
            <textarea required rows={4} value={form.body} maxLength={2000} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
          </label>
        </Modal>
      )}
    </div>
  );
}

function TrainTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-train"], queryFn: adminGetTraining });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", media_type: "video", media_url: "", is_required: false });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: row, error } = await supabase.from("training_materials").insert({
      title: form.title.trim(), description: form.description || null, media_type: form.media_type,
      media_url: form.media_url || null, is_required: form.is_required,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await logActivity("create_training", "training_materials", row.id);
    toast.success("تمت الإضافة");
    setOpen(false); setForm({ title: "", description: "", media_type: "video", media_url: "", is_required: false });
    qc.invalidateQueries({ queryKey: ["admin-train"] });
  }

  async function del(id: string) {
    if (!confirm("حذف المادة؟")) return;
    const { error } = await supabase.from("training_materials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logActivity("delete_training", "training_materials", id);
    qc.invalidateQueries({ queryKey: ["admin-train"] });
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm">
        <Plus className="size-4" /> مادة تدريب
      </button>
      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {data.map((m: any) => (
          <div key={m.id} className="p-4 flex justify-between gap-3">
            <div>
              <p className="font-bold">{m.title} {m.is_required && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning mr-2">مطلوب</span>}</p>
              {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
              <p className="text-xs text-muted-foreground mt-1">{m.media_type}{m.media_url ? ` · ${m.media_url}` : ""}</p>
            </div>
            <button onClick={() => del(m.id)} className="text-destructive p-2"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      {open && (
        <Modal close={() => setOpen(false)} title="مادة تدريبية" onSubmit={submit}>
          <Field label="العنوان" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} required />
          <label className="block">
            <span className="text-sm font-medium block mb-1">النوع</span>
            <select value={form.media_type} onChange={e => setForm(f => ({ ...f, media_type: e.target.value }))}
              className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
              <option value="video">فيديو</option>
              <option value="pdf">PDF</option>
              <option value="text">نص</option>
              <option value="link">رابط</option>
            </select>
          </label>
          <Field label="رابط المحتوى" value={form.media_url} onChange={v => setForm(f => ({ ...f, media_url: v }))} placeholder="https://..." />
          <label className="block">
            <span className="text-sm font-medium block mb-1">الوصف</span>
            <textarea rows={3} value={form.description} maxLength={500} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
            <span className="text-sm font-medium">مادة إلزامية</span>
          </label>
        </Modal>
      )}
    </div>
  );
}

function GoalsTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-goals"], queryFn: adminGetGoals });
  const { data: emps = [] } = useQuery({ queryKey: ["admin-emps"], queryFn: adminGetEmployees });
  const [open, setOpen] = useState(false);
  const monthStart = new Date(); monthStart.setDate(1);
  const [form, setForm] = useState({
    employee_id: "", period_month: monthStart.toISOString().slice(0, 10),
    target_services: 0, target_value: 0, bonus_amount: 0, description: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, target_services: Number(form.target_services), target_value: Number(form.target_value), bonus_amount: Number(form.bonus_amount), description: form.description || null };
    const { data: row, error } = await supabase.from("goals").upsert(payload, { onConflict: "employee_id,period_month" }).select().single();
    if (error) { toast.error(error.message); return; }
    await logActivity("upsert_goal", "goals", row.id, payload);
    toast.success("تم");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-goals"] });
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm">
        <Plus className="size-4" /> هدف جديد
      </button>
      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {data.map((g: any) => (
          <div key={g.id} className="p-4">
            <p className="font-bold">{g.employee_profiles.full_name}</p>
            <p className="text-xs text-muted-foreground">{new Date(g.period_month).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}</p>
            <p className="text-sm mt-1">هدف: {g.target_services} خدمة · {Number(g.target_value).toLocaleString("ar-EG")} ج.م · مكافأة: <span className="font-bold text-primary">{Number(g.bonus_amount).toLocaleString("ar-EG")} ج.م</span></p>
          </div>
        ))}
      </div>
      {open && (
        <Modal close={() => setOpen(false)} title="هدف شهري" onSubmit={submit}>
          <label className="block">
            <span className="text-sm font-medium block mb-1">الموظف</span>
            <select required value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
              <option value="">اختر</option>
              {emps.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </label>
          <Field label="الشهر" type="date" value={form.period_month} onChange={v => setForm(f => ({ ...f, period_month: v }))} required />
          <Field label="عدد الخدمات المستهدف" type="number" value={String(form.target_services)} onChange={v => setForm(f => ({ ...f, target_services: Number(v) }))} />
          <Field label="القيمة المستهدفة (ج.م)" type="number" value={String(form.target_value)} onChange={v => setForm(f => ({ ...f, target_value: Number(v) }))} />
          <Field label="قيمة المكافأة (ج.م)" type="number" value={String(form.bonus_amount)} onChange={v => setForm(f => ({ ...f, bonus_amount: Number(v) }))} />
          <Field label="وصف" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, close, title, onSubmit }: { children: React.ReactNode; close: () => void; title: string; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={close}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          {children}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={close} className="flex-1 py-2.5 rounded-xl bg-muted font-semibold">إلغاء</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold">حفظ</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
    </label>
  );
}

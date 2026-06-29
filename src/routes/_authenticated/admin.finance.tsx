import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminGetEmployees, adminGetTransactions, adminGetServiceSubmissions, logActivity,
} from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  head: () => ({ meta: [{ title: "المالية - الإدارة" }] }),
  component: FinPage,
});

function FinPage() {
  const [tab, setTab] = useState<"tx" | "services">("tx");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        <button onClick={() => setTab("tx")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === "tx" ? "bg-card shadow-card" : "text-muted-foreground"}`}>الحركات المالية</button>
        <button onClick={() => setTab("services")} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === "services" ? "bg-card shadow-card" : "text-muted-foreground"}`}>اعتماد الخدمات</button>
      </div>
      {tab === "tx" && <TxTab />}
      {tab === "services" && <ServicesTab />}
    </div>
  );
}

function TxTab() {
  const qc = useQueryClient();
  const { data: emps = [] } = useQuery({ queryKey: ["admin-emps"], queryFn: adminGetEmployees });
  const { data: tx = [] } = useQuery({ queryKey: ["admin-tx"], queryFn: adminGetTransactions });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", type: "earning" as "earning" | "payment" | "advance" | "deduction", amount: "", notes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id || !form.amount) { toast.error("اكمل البيانات"); return; }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("مبلغ غير صالح"); return; }
    const { data, error } = await supabase.from("employee_transactions").insert({
      employee_id: form.employee_id, type: form.type, amount, notes: form.notes || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await logActivity("create_transaction", "employee_transactions", data.id, { type: form.type, amount });
    toast.success("تم تسجيل الحركة");
    setOpen(false); setForm({ employee_id: "", type: "earning", amount: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["admin-tx"] });
  }

  const TYPE_LBL: Record<string, string> = { earning: "مستحقات", payment: "دفعة", advance: "سلفة", deduction: "خصم" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">الحركات المالية</h2>
        <button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm">
          <Plus className="size-4" /> حركة جديدة
        </button>
      </div>
      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {tx.map((t: any) => (
          <div key={t.id} className="p-3 flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">{t.employee_profiles.full_name} · <span className="text-xs text-muted-foreground">{TYPE_LBL[t.type]}</span></p>
              <p className="text-xs text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString("ar-EG")}{t.notes ? ` · ${t.notes}` : ""}</p>
            </div>
            <p className={`font-bold ${t.type === "earning" || t.type === "payment" ? "text-success" : "text-destructive"}`}>
              {t.type === "earning" || t.type === "payment" ? "+" : "−"} {Number(t.amount).toLocaleString("ar-EG")}
            </p>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">حركة مالية</h2>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium block mb-1">الموظف</span>
                <select required value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
                  <option value="">اختر موظف</option>
                  {emps.map((e: any) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium block mb-1">النوع</span>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
                  <option value="earning">مستحقات/مكافأة</option>
                  <option value="payment">دفعة مستلمة</option>
                  <option value="advance">سلفة</option>
                  <option value="deduction">خصم</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium block mb-1">المبلغ (ج.م)</span>
                <input type="number" required min="1" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
              </label>
              <label className="block">
                <span className="text-sm font-medium block mb-1">ملاحظات</span>
                <input value={form.notes} maxLength={500} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
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

function ServicesTab() {
  const qc = useQueryClient();
  const { data: services = [] } = useQuery({ queryKey: ["admin-services"], queryFn: adminGetServiceSubmissions });

  async function review(s: any, status: "approved" | "rejected") {
    const notes = window.prompt(status === "approved" ? "ملاحظات (اختياري):" : "سبب الرفض:") ?? "";
    const { error } = await supabase.from("employee_services").update({
      status, admin_notes: notes || null, reviewed_at: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await logActivity(`service_${status}`, "employee_services", s.id);
    toast.success("تم");
    qc.invalidateQueries({ queryKey: ["admin-services"] });
  }

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
      {services.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد خدمات مسجلة من الموظفين</p>}
      {services.map((s: any) => (
        <div key={s.id} className="p-4">
          <div className="flex justify-between items-start flex-wrap gap-2">
            <div>
              <p className="font-bold">{s.employee_profiles.full_name} · <span className="text-xs text-muted-foreground">{s.employee_profiles.employee_code}</span></p>
              <p className="text-sm mt-1">{s.service_name} · {s.client_count} عميل · <span className="font-bold text-primary">{Number(s.service_value).toLocaleString("ar-EG")} ج.م</span></p>
              <p className="text-xs text-muted-foreground">{new Date(s.service_date).toLocaleDateString("ar-EG")}</p>
              {s.notes && <p className="text-xs mt-1">{s.notes}</p>}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === "pending" ? "bg-warning/15 text-warning" : s.status === "approved" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {s.status === "pending" ? "قيد الاعتماد" : s.status === "approved" ? "معتمدة" : "مرفوضة"}
            </span>
          </div>
          {s.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => review(s, "approved")} className="px-3 py-1.5 rounded-lg bg-success/15 text-success font-semibold text-xs flex items-center gap-1">
                <Check className="size-3" /> اعتماد
              </button>
              <button onClick={() => review(s, "rejected")} className="px-3 py-1.5 rounded-lg bg-destructive/15 text-destructive font-semibold text-xs flex items-center gap-1">
                <X className="size-3" /> رفض
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

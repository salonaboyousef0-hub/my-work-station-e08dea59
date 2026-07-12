import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Shield, ShieldCheck, UserCheck, UserX, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminGetEmployees, logActivity } from "@/lib/admin-queries";
import { adminCreateEmployee, adminSetRole } from "@/lib/admin-employees.functions";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({ meta: [{ title: "الموظفون - الإدارة" }] }),
  component: EmpsPage,
});

function EmpsPage() {
  const qc = useQueryClient();
  const { data: emps = [] } = useQuery({ queryKey: ["admin-emps"], queryFn: adminGetEmployees });
  const [open, setOpen] = useState(false);
  const create = useServerFn(adminCreateEmployee);
  const setRole = useServerFn(adminSetRole);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", job_title: "", role: "employee" as "employee" | "manager" | "admin" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: form });
      toast.success("تم إنشاء الموظف");
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", job_title: "", role: "employee" });
      qc.invalidateQueries({ queryKey: ["admin-emps"] });
    } catch (e: any) { toast.error(e.message ?? "خطأ"); }
    finally { setBusy(false); }
  }

  async function toggleActive(emp: any) {
    const next = !emp.is_active;
    const { error } = await supabase.from("employee_profiles").update({ is_active: next }).eq("id", emp.id);
    if (error) { toast.error(error.message); return; }
    await logActivity(next ? "activate_employee" : "deactivate_employee", "employee_profiles", emp.id);
    toast.success(next ? "تم التفعيل" : "تم التعطيل");
    qc.invalidateQueries({ queryKey: ["admin-emps"] });
  }

  async function toggleRole(emp: any, role: "manager" | "admin") {
    const has = emp.roles.includes(role);
    try {
      await setRole({ data: { user_id: emp.id, role, action: has ? "revoke" : "grant" } });
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["admin-emps"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">قائمة الموظفين ({emps.length})</h2>
        <button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 font-semibold flex items-center gap-2 text-sm">
          <Plus className="size-4" /> موظف جديد
        </button>
      </div>

      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {emps.map((e: any) => (
          <div key={e.id} className="p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">{e.full_name}</p>
                  {!e.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">معطّل</span>}
                  {e.roles.includes("admin") && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">Admin</span>}
                  {e.roles.includes("manager") && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info/15 text-info">Manager</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{e.employee_code} · {e.job_title} · رصيد: {Number(e.balance).toLocaleString("ar-EG")} ج.م</p>
                {e.phone && <p className="text-xs text-muted-foreground">{e.phone}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleRole(e, "manager")} className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 ${e.roles.includes("manager") ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
                  <Shield className="size-3" /> Manager
                </button>
                <button onClick={() => toggleRole(e, "admin")} className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 ${e.roles.includes("admin") ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <ShieldCheck className="size-3" /> Admin
                </button>
                <button onClick={() => toggleActive(e)} className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 ${e.is_active ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success"}`}>
                  {e.is_active ? <UserX className="size-3" /> : <UserCheck className="size-3" />}
                  {e.is_active ? "تعطيل" : "تفعيل"}
                </button>
              </div>
            </div>
            <CashierNameEditor emp={e} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-emps"] })} />
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-card rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">إضافة موظف</h2>
            <form onSubmit={submit} className="space-y-3">
              {[
                ["full_name", "الاسم الكامل", "text"],
                ["email", "البريد الإلكتروني", "email"],
                ["password", "كلمة المرور (8+ حروف)", "password"],
                ["phone", "الهاتف", "tel"],
                ["job_title", "الوظيفة", "text"],
              ].map(([k, l, t]) => (
                <label key={k} className="block">
                  <span className="text-sm font-medium block mb-1">{l}</span>
                  <input type={t} value={(form as any)[k]} onChange={ev => setForm(f => ({ ...f, [k]: ev.target.value }))}
                    required={k === "full_name" || k === "email" || k === "password"}
                    minLength={k === "password" ? 8 : undefined}
                    className="w-full bg-input rounded-xl px-4 py-2.5 border border-border" />
                </label>
              ))}
              <label className="block">
                <span className="text-sm font-medium block mb-1">الدور</span>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                  className="w-full bg-input rounded-xl px-4 py-2.5 border border-border">
                  <option value="employee">موظف</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-muted font-semibold">إلغاء</button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60">إنشاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CashierNameEditor({ emp, onSaved }: { emp: any; onSaved: () => void }) {
  const [value, setValue] = useState<string>(emp.cashier_name ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = (value ?? "").trim() !== (emp.cashier_name ?? "").trim();

  async function save() {
    setSaving(true);
    const next = value.trim() || null;
    const { error } = await supabase.from("employee_profiles").update({ cashier_name: next }).eq("id", emp.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logActivity("set_cashier_name", "employee_profiles", emp.id);
    toast.success("تم حفظ اسم الكاشير");
    onSaved();
  }

  return (
    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
      <Link2 className="size-4 text-muted-foreground shrink-0" />
      <label className="text-xs font-semibold text-muted-foreground shrink-0">اسم الكاشير:</label>
      <input
        dir="ltr"
        value={value}
        onChange={ev => setValue(ev.target.value)}
        placeholder="Exact name in cashier operations"
        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-1 text-sm"
      />
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-40"
      >{saving ? "..." : "حفظ"}</button>
    </div>
  );
}

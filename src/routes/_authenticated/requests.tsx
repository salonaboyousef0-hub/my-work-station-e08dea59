import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRequests } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "الطلبات" }] }),
  component: RequestsPage,
});

const TYPE_LABEL: Record<string, string> = { advance: "طلب سلفة", leave: "طلب إجازة", other: "طلب آخر" };
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-warning/15 text-warning" },
  approved: { label: "مقبول", cls: "bg-success/15 text-success" },
  rejected: { label: "مرفوض", cls: "bg-destructive/15 text-destructive" },
};

function RequestsPage() {
  const qc = useQueryClient();
  const { data: requests = [] } = useQuery({ queryKey: ["requests"], queryFn: getRequests });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"advance" | "leave" | "other">("advance");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مصرح");
      const { error } = await supabase.from("employee_requests").insert({
        employee_id: u.user.id,
        type, amount: amount ? Number(amount) : null, description,
      });
      if (error) throw error;
      toast.success("تم إرسال الطلب");
      setOpen(false); setAmount(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["requests"] });
    } catch (e: any) { toast.error(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="طلباتي" subtitle="أرسل طلباتك وتابع حالتها" />
      <main className="px-5 -mt-10 space-y-5 max-w-md mx-auto">
        <button onClick={() => setOpen(true)}
          className="w-full bg-gradient-primary text-primary-foreground rounded-2xl py-4 font-bold shadow-elevated flex items-center justify-center gap-2">
          <Plus className="size-5" /> طلب جديد
        </button>

        <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
          {requests.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات</p>}
          {requests.map((r: any) => (
            <div key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{TYPE_LABEL[r.type]}</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS[r.status].cls}`}>
                  {STATUS[r.status].label}
                </span>
              </div>
              {r.amount != null && <p className="text-sm mt-1">المبلغ: <span className="font-bold text-primary">{Number(r.amount).toLocaleString("ar-EG")} ج.م</span></p>}
              {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
              <p className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleDateString("ar-EG")}</p>
              {r.admin_notes && <p className="text-xs mt-2 p-2 bg-muted rounded-lg">رد الإدارة: {r.admin_notes}</p>}
            </div>
          ))}
        </div>
      </main>

      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full bg-card rounded-t-3xl p-6 max-w-md mx-auto">
            <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">طلب جديد</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <span className="text-sm font-medium block mb-1.5">نوع الطلب</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["advance", "leave", "other"] as const).map(t => (
                    <button type="button" key={t} onClick={() => setType(t)}
                      className={`py-3 rounded-xl text-sm font-semibold border ${type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              {type === "advance" && (
                <label className="block">
                  <span className="text-sm font-medium block mb-1.5">المبلغ (ج.م)</span>
                  <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required min="1"
                    className="w-full bg-input rounded-xl px-4 py-3 border border-border focus:border-primary" />
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium block mb-1.5">التفاصيل</span>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
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

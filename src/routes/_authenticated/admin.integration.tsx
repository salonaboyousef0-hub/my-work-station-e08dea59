import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link as LinkIcon, ShieldAlert, PlugZap, RefreshCw } from "lucide-react";
import { useCashierStats } from "@/hooks/useCashierStats";

export const Route = createFileRoute("/_authenticated/admin/integration")({
  head: () => ({ meta: [{ title: "ربط الكاشير" }] }),
  component: IntegrationSettingsPage,
});

type Settings = {
  id?: string;
  cashier_url: string;
  cashier_publishable_key: string;
  stats_function_path: string;
  enabled: boolean;
};

const DEFAULTS: Settings = {
  cashier_url: "",
  cashier_publishable_key: "",
  stats_function_path: "/functions/v1/employee-stats",
  enabled: false,
};

function IntegrationSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["integration_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULTS, ...data });
  }, [data]);

  async function save() {
    if (!form.cashier_url.startsWith("https://")) {
      toast.error("رابط الكاشير يجب أن يبدأ بـ https://");
      return;
    }
    if (!form.cashier_publishable_key || form.cashier_publishable_key.length < 20) {
      toast.error("المفتاح العام غير صحيح");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cashier_url: form.cashier_url.trim(),
        cashier_publishable_key: form.cashier_publishable_key.trim(),
        stats_function_path: form.stats_function_path.trim() || DEFAULTS.stats_function_path,
        enabled: form.enabled,
      };
      const client = supabase.from("integration_settings" as any);
      const res = form.id
        ? await client.update(payload).eq("id", form.id)
        : await client.insert(payload);
      if (res.error) throw res.error;
      toast.success("تم حفظ إعدادات الربط");
      qc.invalidateQueries({ queryKey: ["integration_settings"] });
      qc.invalidateQueries({ queryKey: ["cashier-stats"] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <PlugZap className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">ربط مع مشروع الكاشير</h2>
          <p className="text-xs text-muted-foreground">اتصال آمن للقراءة فقط عبر Edge Function — بدون Service Role.</p>
        </div>
      </header>

      <div className="bg-warning/10 border border-warning/30 text-warning-foreground rounded-2xl p-4 flex gap-3 text-sm">
        <ShieldAlert className="size-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-warning">تنبيه أمني</p>
          <p>لا تدخل أبداً <b>Service Role Key</b>. استخدم فقط <b>Publishable / Anon key</b>. الطلبات تمر عبر دالة سيرفر آمنة داخل هذا التطبيق ويتم تمرير <code>employee_id</code> الخاص بالمستخدم فقط.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-card">
        <Field label="Cashier Supabase URL" placeholder="https://xxxx.supabase.co"
          value={form.cashier_url} onChange={v => setForm({ ...form, cashier_url: v })} />
        <Field label="Cashier Publishable Key (anon)" placeholder="eyJhbGciOi..."
          value={form.cashier_publishable_key} onChange={v => setForm({ ...form, cashier_publishable_key: v })} monospace />
        <Field label="مسار دالة الإحصائيات" placeholder="/functions/v1/employee-stats"
          value={form.stats_function_path} onChange={v => setForm({ ...form, stats_function_path: v })} monospace />

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50">
          <span className="text-sm font-semibold">تفعيل الربط</span>
          <input type="checkbox" checked={form.enabled}
            onChange={e => setForm({ ...form, enabled: e.target.checked })}
            className="size-5 accent-primary" />
        </label>

        <button onClick={save} disabled={saving || isLoading}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          <LinkIcon className="size-4" /> {saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
        </button>
      </div>

      <TestConnectionCard />

      <div className="bg-card border border-border rounded-2xl p-5 text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">ملاحظات مهمة</p>
        <ul className="list-disc pr-5 space-y-1">
          <li>يجب أن تنشر Edge Function على مشروع الكاشير باسم <code>employee-stats</code>. الكود المرجعي موجود في <code>docs/CASHIER_INTEGRATION.md</code>.</li>
          <li>الدالة تُرجع <b>فقط</b> بيانات الموظف المطلوب: عدد الخدمات، عدد العملاء، العمولات، الرصيد المستحق، وطلباته.</li>
          <li>يجب ربط كل موظف في قائمة "الموظفون" عبر عمود <code>cashier_employee_id</code>.</li>
          <li>البيانات تُحدَّث تلقائياً كل 10 ثوانٍ.</li>
        </ul>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, monospace }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; monospace?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
      <input dir="ltr" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-muted rounded-xl px-3 py-2.5 border border-border focus:border-primary outline-none text-sm ${monospace ? "font-mono" : ""}`} />
    </div>
  );
}

function TestConnectionCard() {
  const { data, refetch, isFetching } = useCashierStats();
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">اختبار الاتصال (كحسابك)</h3>
        <button onClick={() => refetch()} disabled={isFetching}
          className="text-sm text-primary font-semibold flex items-center gap-1">
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> تحديث
        </button>
      </div>
      {!data && <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>}
      {data && data.ok && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="خدمات" value={data.data.services_count} />
          <Stat label="عملاء" value={data.data.clients_count} />
          <Stat label="عمولات" value={data.data.commissions_total} suffix="ج.م" />
          <Stat label="رصيد مستحق" value={data.data.balance_due} suffix="ج.م" />
        </div>
      )}
      {data && !data.ok && (
        <p className="text-sm text-destructive">{data.error}</p>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{Number(value).toLocaleString("ar-EG")} {suffix && <span className="text-xs">{suffix}</span>}</p>
    </div>
  );
}

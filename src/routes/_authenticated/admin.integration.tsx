import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link as LinkIcon, ShieldAlert, PlugZap, RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle, Clock, Users, Database, Settings, Activity } from "lucide-react";
import { useCashierStats } from "@/hooks/useCashierStats";
import {
  getEmployeeMappings,
  upsertEmployeeMapping,
  testCashierConnection,
  getSyncAuditLog,
  type EmployeeMapping,
} from "@/lib/cashier-integration.functions";

export const Route = createFileRoute("/_authenticated/admin/integration")({
  head: () => ({ meta: [{ title: "ربط الكاشير" }] }),
  component: IntegrationSettingsPage,
});

type Settings = {
  id?: string;
  cashier_url: string;
  cashier_publishable_key: string;
  stats_function_path: string;
  attendance_function_path: string;
  wallet_function_path: string;
  commission_function_path: string;
  sync_interval_seconds: number;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  connection_status: string;
  enabled: boolean;
};

const DEFAULTS: Settings = {
  cashier_url: "",
  cashier_publishable_key: "",
  stats_function_path: "/functions/v1/employee-stats",
  attendance_function_path: "/functions/v1/attendance-sync",
  wallet_function_path: "/functions/v1/wallet-sync",
  commission_function_path: "/functions/v1/commission-sync",
  sync_interval_seconds: 10,
  auto_sync_enabled: true,
  last_sync_at: null,
  connection_status: "disconnected",
  enabled: false,
};

function IntegrationSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<"settings" | "mapping" | "audit">("settings");

  const { data, isLoading } = useQuery({
    queryKey: ["integration_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_settings")
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
      // Update settings
      if (data?.id) {
        const { error } = await (supabase as any)
          .from("integration_settings")
          .update({
            cashier_url: form.cashier_url.trim(),
            cashier_publishable_key: form.cashier_publishable_key.trim(),
            stats_function_path: form.stats_function_path.trim() || DEFAULTS.stats_function_path,
            attendance_function_path: form.attendance_function_path.trim() || DEFAULTS.attendance_function_path,
            wallet_function_path: form.wallet_function_path.trim() || DEFAULTS.wallet_function_path,
            commission_function_path: form.commission_function_path.trim() || DEFAULTS.commission_function_path,
            sync_interval_seconds: form.sync_interval_seconds,
            auto_sync_enabled: form.auto_sync_enabled,
            enabled: form.enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("integration_settings").insert({
          cashier_url: form.cashier_url.trim(),
          cashier_publishable_key: form.cashier_publishable_key.trim(),
          stats_function_path: form.stats_function_path.trim() || DEFAULTS.stats_function_path,
          attendance_function_path: form.attendance_function_path.trim() || DEFAULTS.attendance_function_path,
          wallet_function_path: form.wallet_function_path.trim() || DEFAULTS.wallet_function_path,
          commission_function_path: form.commission_function_path.trim() || DEFAULTS.commission_function_path,
          sync_interval_seconds: form.sync_interval_seconds,
          auto_sync_enabled: form.auto_sync_enabled,
          enabled: form.enabled,
        });
        if (error) throw error;
      }

      toast.success("تم حفظ إعدادات الربط");
      qc.invalidateQueries({ queryKey: ["integration_settings"] });
      qc.invalidateQueries({ queryKey: ["cashier-stats"] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const testFn = useServerFn(testCashierConnection);
      const result = await testFn();
      if (result?.ok) {
        toast.success(`الاتصال ناجح (${result.latency}ms)`);
      } else {
        toast.error(result?.error || "فشل الاتصال");
      }
    } catch (e: any) {
      toast.error(e.message || "فشل الاتصال");
    } finally {
      setTesting(false);
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
          <p className="text-xs text-muted-foreground">اتصال آمن عبر Edge Functions — بدون Service Role</p>
        </div>
      </header>

      {/* Status Card */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-xl flex items-center justify-center ${
                form.connection_status === "connected"
                  ? "bg-success/15 text-success"
                  : form.enabled
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {form.connection_status === "connected" ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <XCircle className="size-5" />
              )}
            </div>
            <div>
              <p className="font-semibold">
                {form.connection_status === "connected"
                  ? "متصل"
                  : form.enabled
                  ? "في انتظار الاتصال"
                  : "غير مفعل"}
              </p>
              {form.last_sync_at && (
                <p className="text-xs text-muted-foreground">
                  آخر مزامنة: {new Date(form.last_sync_at).toLocaleString("ar-EG")}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={testConnection}
            disabled={testing || !form.enabled}
            className="px-4 py-2 bg-muted rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${testing ? "animate-spin" : ""}`} />
            اختبار الاتصال
          </button>
        </div>
      </div>

      {/* Security Warning */}
      <div className="bg-warning/10 border border-warning/30 text-warning-foreground rounded-2xl p-4 flex gap-3 text-sm">
        <ShieldAlert className="size-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-warning">تنبيه أمني</p>
          <p>
            لا تدخل أبداً <b>Service Role Key</b>. استخدم فقط <b>Publishable / Anon key</b>. الطلبات تمر عبر دالة سيرفر آمنة داخل هذا التطبيق ويتم تمرير <code>employee_id</code> الخاص بالمستخدم فقط.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        {([
          ["settings", "الإعدادات", Settings],
          ["mapping", "ربط الموظفين", Users],
          ["audit", "سجل المزامنة", Activity],
        ] as const).map(([k, l, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${
              tab === k ? "bg-card shadow-card text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" /> {l}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "settings" && <SettingsTab form={form} setForm={setForm} save={save} saving={saving} />}
      {tab === "mapping" && <EmployeeMappingTab />}
      {tab === "audit" && <AuditLogTab />}

      {/* Test Connection Card */}
      <TestConnectionCard />
    </div>
  );
}

function SettingsTab({
  form,
  setForm,
  save,
  saving,
}: {
  form: Settings;
  setForm: (f: Settings) => void;
  save: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-card">
      <Field
        label="Cashier Supabase URL"
        placeholder="https://xxxx.supabase.co"
        value={form.cashier_url}
        onChange={(v) => setForm({ ...form, cashier_url: v })}
      />
      <Field
        label="Cashier Publishable Key (anon)"
        placeholder="eyJhbGciOi..."
        value={form.cashier_publishable_key}
        onChange={(v) => setForm({ ...form, cashier_publishable_key: v })}
        monospace
      />

      {/* Function Paths */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground">مسارات Edge Functions</p>
        <Field
          label="دالة الإحصائيات"
          placeholder="/functions/v1/employee-stats"
          value={form.stats_function_path}
          onChange={(v) => setForm({ ...form, stats_function_path: v })}
          monospace
        />
        <Field
          label="دالة مزامنة الحضور"
          placeholder="/functions/v1/attendance-sync"
          value={form.attendance_function_path}
          onChange={(v) => setForm({ ...form, attendance_function_path: v })}
          monospace
        />
        <Field
          label="دالة المحفظة"
          placeholder="/functions/v1/wallet-sync"
          value={form.wallet_function_path}
          onChange={(v) => setForm({ ...form, wallet_function_path: v })}
          monospace
        />
        <Field
          label="دالة العمولات"
          placeholder="/functions/v1/commission-sync"
          value={form.commission_function_path}
          onChange={(v) => setForm({ ...form, commission_function_path: v })}
          monospace
        />
      </div>

      {/* Sync Settings */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground">إعدادات المزامنة</p>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50">
          <div>
            <span className="text-sm font-semibold">تفعيل الربط</span>
            <p className="text-xs text-muted-foreground">تفعيل الاتصال مع الكاشير</p>
          </div>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="size-5 accent-primary"
          />
        </label>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50">
          <div>
            <span className="text-sm font-semibold">مزامنة تلقائية</span>
            <p className="text-xs text-muted-foreground">تحديث الرصيد والبيانات تلقائياً</p>
          </div>
          <input
            type="checkbox"
            checked={form.auto_sync_enabled}
            onChange={(e) => setForm({ ...form, auto_sync_enabled: e.target.checked })}
            className="size-5 accent-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">فاصل المزامنة (ثواني)</span>
          <input
            type="number"
            min={5}
            max={300}
            value={form.sync_interval_seconds}
            onChange={(e) => setForm({ ...form, sync_interval_seconds: Number(e.target.value) || 10 })}
            className="w-full bg-muted rounded-xl px-3 py-2.5 border border-border mt-1"
          />
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <LinkIcon className="size-4" /> {saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
      </button>
    </div>
  );
}

function EmployeeMappingTab() {
  const qc = useQueryClient();
  const upsertMapping = useServerFn(upsertEmployeeMapping);

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["employee-mappings"],
    queryFn: async () => {
      const fn = useServerFn(getEmployeeMappings);
      return fn();
    },
  });

  // Get employees for dropdown
  const { data: employees } = useQuery({
    queryKey: ["admin-emps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("id, full_name, employee_code")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    cashier_employee_id: "",
    branch_id: "",
  });

  async function saveMapping() {
    if (!form.employee_id || !form.cashier_employee_id) {
      toast.error("جميع الحقول مطلوبة");
      return;
    }

    try {
      const result = await upsertMapping({ data: form });
      if (result?.ok) {
        toast.success("تم حفظ الربط");
        setShowForm(false);
        setForm({ employee_id: "", cashier_employee_id: "", branch_id: "" });
        qc.invalidateQueries({ queryKey: ["employee-mappings"] });
      } else {
        toast.error(result?.error || "فشل الحفظ");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">ربط الموظفين</h3>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold"
        >
          + ربط موظف جديد
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {isLoading && <p className="text-center text-sm text-muted-foreground py-8">جارٍ التحميل...</p>}
        {!isLoading && (!mappings?.data || mappings.data.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-8">لا يوجد ربط بعد</p>
        )}
        {mappings?.data?.map((m: any) => (
          <div key={m.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{m.employee_profiles?.full_name || m.employee_id}</p>
              <p className="text-xs text-muted-foreground">
                كود الكاشير: {m.cashier_employee_id} {m.branch_id && `· الفرع: ${m.branch_id}`}
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-full ${
                m.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {m.active ? "فعّال" : "معطل"}
            </span>
          </div>
        ))}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-2xl p-6"
          >
            <h2 className="text-xl font-bold mb-4">ربط موظف بالكاشير</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">الموظف</span>
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full bg-muted rounded-xl px-3 py-2.5 border border-border mt-1"
                >
                  <option value="">اختر موظف</option>
                  {employees?.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">رقم الموظف في الكاشير</span>
                <input
                  value={form.cashier_employee_id}
                  onChange={(e) => setForm({ ...form, cashier_employee_id: e.target.value })}
                  placeholder="cashier_employee_id"
                  className="w-full bg-muted rounded-xl px-3 py-2.5 border border-border mt-1"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">الفرع (اختياري)</span>
                <input
                  value={form.branch_id}
                  onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  placeholder="branch_001"
                  className="w-full bg-muted rounded-xl px-3 py-2.5 border border-border mt-1"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={saveMapping}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogTab() {
  const getAuditLog = useServerFn(getSyncAuditLog);

  const { data, isLoading } = useQuery({
    queryKey: ["sync-audit-log"],
    queryFn: () => getAuditLog(),
  });

  return (
    <div className="bg-card border border-border rounded-2xl divide-y divide-border">
      {isLoading && <p className="text-center text-sm text-muted-foreground py-8">جارٍ التحميل...</p>}
      {!isLoading && (!data?.data || data.data.length === 0) && (
        <p className="text-center text-sm text-muted-foreground py-8">لا يوجد سجل بعد</p>
      )}
      {data?.data?.slice(0, 50).map((log: any) => (
        <div key={log.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  log.status === "success"
                    ? "bg-success/15 text-success"
                    : log.status === "failed"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-warning/15 text-warning"
                }`}
              >
                {log.status === "success" ? "نجاح" : log.status === "failed" ? "فشل" : "قيد التنفيذ"}
              </span>
              <span className="font-mono text-xs font-semibold text-primary">{log.sync_type}</span>
              <span className="text-xs text-muted-foreground">
                {log.direction === "to_cashier" ? "→ كاشير" : "← من كاشير"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(log.created_at).toLocaleString("ar-EG")}
            </span>
          </div>
          {log.employee_profiles?.full_name && (
            <p className="text-xs text-muted-foreground mt-1">
              الموظف: {log.employee_profiles.full_name}
            </p>
          )}
          {log.error_message && (
            <p className="text-xs text-destructive mt-1 bg-destructive/10 rounded-lg px-2 py-1">
              {log.error_message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  monospace,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
      <input
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-muted rounded-xl px-3 py-2.5 border border-border focus:border-primary outline-none text-sm ${
          monospace ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

function TestConnectionCard() {
  const { data, refetch, isFetching } = useCashierStats();
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">اختبار الاتصال (كحسابك)</h3>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-sm text-primary font-semibold flex items-center gap-1"
        >
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
      {data && !data.ok && <p className="text-sm text-destructive">{data.error}</p>}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">
        {Number(value).toLocaleString("ar-EG")} {suffix && <span className="text-xs">{suffix}</span>}
      </p>
    </div>
  );
}

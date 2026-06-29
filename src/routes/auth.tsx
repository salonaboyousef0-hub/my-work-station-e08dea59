import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Scissors } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "تسجيل الدخول - تطبيق الموظفين" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, job_title: jobTitle },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح");
        navigate({ to: "/home", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول");
        navigate({ to: "/home", replace: true });
      }
    } catch (err: any) {
      const msg = err?.message ?? "حدث خطأ";
      if (msg.includes("Invalid login")) toast.error("بيانات الدخول غير صحيحة");
      else if (msg.includes("already registered")) toast.error("هذا البريد مسجل مسبقاً");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-gradient-primary text-primary-foreground px-6 pt-14 pb-12 rounded-b-[2rem] shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Scissors className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تطبيق الموظفين</h1>
            <p className="text-sm opacity-90">إدارة الحضور والحساب الخاص بك</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 -mt-8">
        <div className="bg-card rounded-2xl shadow-elevated p-6 mx-auto max-w-md">
          <div className="flex gap-2 p-1 bg-muted rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === "signin" ? "bg-card shadow-card text-foreground" : "text-muted-foreground"
              }`}
            >تسجيل الدخول</button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === "signup" ? "bg-card shadow-card text-foreground" : "text-muted-foreground"
              }`}
            >حساب جديد</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <Field label="الاسم الكامل" value={fullName} onChange={setFullName} required />
                <Field label="رقم الهاتف" value={phone} onChange={setPhone} type="tel" />
                <Field label="الوظيفة" value={jobTitle} onChange={setJobTitle} placeholder="مثال: مصفف شعر" />
              </>
            )}
            <Field label="البريد الإلكتروني" value={email} onChange={setEmail} type="email" required autoComplete="email" />
            <Field label="كلمة المرور" value={password} onChange={setPassword} type="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-base shadow-card flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-5 animate-spin" />}
              {mode === "signin" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
            هذا تطبيق مخصص للموظفين فقط.<br />يتم إنشاء الحساب بالتنسيق مع الإدارة.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder, autoComplete, minLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; autoComplete?: string; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground mb-1.5 block">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} placeholder={placeholder} autoComplete={autoComplete} minLength={minLength}
        className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base focus:border-primary focus:bg-card transition"
      />
    </label>
  );
}

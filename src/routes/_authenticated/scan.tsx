import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, LogIn, LogOut, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "مسح QR للحضور" }] }),
  component: ScanPage,
});

type Mode = "idle" | "scanning" | "processing" | "done";

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(p => resolve(p), () => resolve(null), { timeout: 5000 });
  });
}

function parsePayload(text: string): string | null {
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.t === "string") return obj.t;
  } catch { /* fallthrough */ }
  return text.trim() ? text.trim() : null;
}

function ScanPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("idle");
  const [status, setStatus] = useState<string>("");
  const [action, setAction] = useState<"in" | "out" | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "qr-scan-region";
  const processingRef = useRef(false);

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
      }
    };
  }, []);

  async function startScan() {
    setMode("scanning");
    setStatus("وجّه الكاميرا نحو كود QR");
    processingRef.current = false;
    try {
      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          if (processingRef.current) return;
          processingRef.current = true;
          await handleDecoded(decoded);
        },
        () => { /* per-frame errors ignored */ },
      );
    } catch (e: any) {
      setMode("idle");
      toast.error(e?.message ?? "تعذر تشغيل الكاميرا");
    }
  }

  async function stopScan() {
    const s = scannerRef.current;
    if (!s) return;
    try { await s.stop(); } catch { /* noop */ }
    try { s.clear(); } catch { /* noop */ }
    scannerRef.current = null;
  }

  async function handleDecoded(raw: string) {
    setMode("processing");
    setStatus("جارٍ التحقق من الكود...");
    await stopScan();

    const token = parsePayload(raw);
    if (!token) {
      setMode("idle");
      return toast.error("كود غير صالح");
    }

    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مصرح");

      // validate token
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("attendance_qr_tokens")
        .select("id,is_active,expires_at")
        .eq("token", token)
        .maybeSingle();
      if (tokenErr) throw tokenErr;
      if (!tokenRow || !tokenRow.is_active) throw new Error("الكود غير صالح أو معطل");
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) throw new Error("انتهت صلاحية الكود");

      const pos = await getPosition();
      const today = new Date().toISOString().slice(0, 10);

      // find today's row
      const { data: existing } = await supabase
        .from("attendance")
        .select("id,check_in,check_out")
        .eq("employee_id", u.user.id)
        .eq("work_date", today)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("attendance").insert({
          employee_id: u.user.id,
          check_in_lat: pos?.coords.latitude ?? null,
          check_in_lng: pos?.coords.longitude ?? null,
          check_in_source: "qr",
          qr_token_id: tokenRow.id,
        });
        if (error) throw error;
        setAction("in");
        setMode("done");
        setStatus("تم تسجيل الحضور بنجاح");
        toast.success("تم تسجيل الحضور");
      } else if (!existing.check_out) {
        const { error } = await supabase.from("attendance").update({
          check_out: new Date().toISOString(),
          check_out_lat: pos?.coords.latitude ?? null,
          check_out_lng: pos?.coords.longitude ?? null,
          check_out_source: "qr",
        }).eq("id", existing.id);
        if (error) throw error;
        setAction("out");
        setMode("done");
        setStatus("تم تسجيل الانصراف");
        toast.success("تم تسجيل الانصراف");
      } else {
        setMode("done");
        setStatus("تم إكمال يومك بالفعل");
        toast.info("تم تسجيل حضورك وانصرافك اليوم");
      }
    } catch (e: any) {
      setMode("idle");
      toast.error(e?.message ?? "حدث خطأ");
      setStatus("");
      processingRef.current = false;
    }
  }

  return (
    <div>
      <PageHeader title="مسح QR للحضور" subtitle="سجل حضورك وانصرافك بمسح كود الفرع" />
      <main className="px-5 -mt-10 space-y-4 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-elevated border border-border p-5 text-center">
          {mode === "idle" && (
            <>
              <QrCode className="size-16 text-primary mx-auto" />
              <p className="mt-3 font-semibold">اضغط لبدء المسح</p>
              <p className="text-xs text-muted-foreground mt-1">وجّه الكاميرا إلى كود QR الموجود في الفرع</p>
              <button onClick={startScan}
                className="mt-5 w-full bg-gradient-primary text-primary-foreground rounded-xl py-4 font-bold shadow-card">
                فتح الكاميرا
              </button>
            </>
          )}

          {(mode === "scanning" || mode === "processing") && (
            <>
              <div id={regionId} className="mx-auto w-full max-w-xs rounded-xl overflow-hidden" />
              <p className="mt-3 text-sm text-muted-foreground">{status}</p>
              <button onClick={() => { stopScan(); setMode("idle"); }}
                className="mt-4 w-full bg-muted rounded-xl py-3 font-semibold text-sm">
                إلغاء
              </button>
            </>
          )}

          {mode === "done" && (
            <>
              {action === "in" ? <LogIn className="size-16 text-success mx-auto" /> :
                action === "out" ? <LogOut className="size-16 text-primary mx-auto" /> :
                <QrCode className="size-16 text-primary mx-auto" />}
              <p className="mt-3 font-bold text-lg">{status}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</p>
              <button onClick={() => navigate({ to: "/attendance" })}
                className="mt-5 w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold flex items-center justify-center gap-2">
                <ArrowRight className="size-4" /> عرض سجل الحضور
              </button>
            </>
          )}
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
          • تأكد من السماح بالوصول للكاميرا وخدمات الموقع.<br />
          • أول مسح في اليوم يسجل الحضور، والثاني يسجل الانصراف تلقائياً.<br />
          • يجب أن يكون الكود الفعّال والذي أنشأه المدير من لوحة الإدارة.
        </div>
      </main>
    </div>
  );
}

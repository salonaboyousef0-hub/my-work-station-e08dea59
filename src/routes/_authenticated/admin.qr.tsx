import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Plus, Power, Trash2, RefreshCw, Download, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/qr")({
  head: () => ({ meta: [{ title: "أكواد الحضور QR" }] }),
  component: AdminQrPage,
});

type Token = {
  id: string;
  label: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

async function fetchTokens(): Promise<Token[]> {
  const { data, error } = await supabase
    .from("attendance_qr_tokens")
    .select("id,label,token,is_active,expires_at,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
}

function AdminQrPage() {
  const qc = useQueryClient();
  const { data: tokens = [], isLoading } = useQuery({ queryKey: ["qr-tokens"], queryFn: fetchTokens });
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Token | null>(null);

  useEffect(() => {
    if (!preview && tokens.length > 0) setPreview(tokens.find(t => t.is_active) ?? tokens[0]);
  }, [tokens, preview]);

  async function createToken() {
    if (!label.trim()) return toast.error("أدخل اسم/موقع للكود");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("attendance_qr_tokens").insert({
        label: label.trim(),
        token: randomToken(),
        is_active: true,
        created_by: u.user?.id,
      });
      if (error) throw error;
      setLabel("");
      toast.success("تم إنشاء الكود");
      qc.invalidateQueries({ queryKey: ["qr-tokens"] });
    } catch (e: any) { toast.error(e.message ?? "فشل الإنشاء"); }
    finally { setBusy(false); }
  }

  async function toggleActive(t: Token) {
    const { error } = await supabase.from("attendance_qr_tokens").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["qr-tokens"] });
  }

  async function rotate(t: Token) {
    const { error } = await supabase.from("attendance_qr_tokens").update({ token: randomToken() }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("تم تدوير الكود");
    qc.invalidateQueries({ queryKey: ["qr-tokens"] });
    setPreview(null);
  }

  async function remove(t: Token) {
    if (!confirm(`حذف الكود "${t.label}"؟`)) return;
    const { error } = await supabase.from("attendance_qr_tokens").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["qr-tokens"] });
    if (preview?.id === t.id) setPreview(null);
  }

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
        <h2 className="font-bold flex items-center gap-2"><QrCode className="size-5 text-primary" /> إنشاء كود QR جديد</h2>
        <p className="text-xs text-muted-foreground mt-1">أنشئ كود لكل فرع/موقع. سيسحبه الموظفون من التطبيق لتسجيل الحضور والانصراف.</p>
        <div className="flex gap-2 mt-3">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="مثال: الفرع الرئيسي"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={createToken} disabled={busy}
            className="bg-primary text-primary-foreground rounded-xl px-4 text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
            <Plus className="size-4" /> إنشاء
          </button>
        </div>
      </div>

      {preview && <QrPreviewCard token={preview} />}

      <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>}
        {!isLoading && tokens.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">لا يوجد أكواد بعد</p>}
        {tokens.map(t => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-3">
            <button onClick={() => setPreview(t)} className="flex-1 text-right">
              <p className="font-semibold text-sm">{t.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{t.token.slice(0, 24)}…</p>
            </button>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${t.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
              {t.is_active ? "فعّال" : "معطل"}
            </span>
            <div className="flex gap-1">
              <button onClick={() => toggleActive(t)} title="تفعيل/تعطيل" className="p-2 rounded-lg hover:bg-muted"><Power className="size-4" /></button>
              <button onClick={() => rotate(t)} title="تدوير" className="p-2 rounded-lg hover:bg-muted"><RefreshCw className="size-4" /></button>
              <button onClick={() => remove(t)} title="حذف" className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QrPreviewCard({ token }: { token: Token }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const payload = JSON.stringify({ v: 1, t: token.token });

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, { width: 320, margin: 2, color: { dark: "#115E59", light: "#ffffff" } });
    QRCode.toDataURL(payload, { width: 640, margin: 2, color: { dark: "#115E59", light: "#ffffff" } }).then(setDataUrl);
  }, [payload]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card text-center">
      <h3 className="font-bold">{token.label}</h3>
      <p className="text-xs text-muted-foreground mt-1">اطبع الكود وعلّقه في الفرع أو اعرضه على شاشة</p>
      <div className="flex justify-center mt-4">
        <canvas ref={canvasRef} className="rounded-xl border border-border" />
      </div>
      {dataUrl && (
        <a href={dataUrl} download={`qr-${token.label}.png`}
          className="mt-4 inline-flex items-center gap-2 bg-muted rounded-xl px-4 py-2 text-sm font-semibold">
          <Download className="size-4" /> تنزيل الصورة
        </a>
      )}
    </div>
  );
}

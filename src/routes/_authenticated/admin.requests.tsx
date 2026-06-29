import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminGetAllLeaveRequests, adminGetAllAdvanceRequests, adminGetAllGeneralRequests, logActivity,
} from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  head: () => ({ meta: [{ title: "الطلبات - الإدارة" }] }),
  component: ReqPage,
});

const LEAVE_LABEL: Record<string, string> = { vacation: "إجازة", sick: "مرضية", personal: "شخصية", other: "أخرى" };
const ADV_LABEL: Record<string, string> = { advance: "سلفة", leave: "إجازة", other: "أخرى" };
const GEN_LABEL: Record<string, string> = { shift_change: "تغيير شيفت", tools: "أدوات", complaint: "شكوى", suggestion: "اقتراح", other: "أخرى" };

function ReqPage() {
  const [tab, setTab] = useState<"leave" | "advance" | "general">("leave");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        {[["leave", "إجازات"], ["advance", "سلف وعامة"], ["general", "طلبات عامة"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-card shadow-card text-foreground" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "leave" && <LeaveList />}
      {tab === "advance" && <AdvanceList />}
      {tab === "general" && <GeneralList />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
  };
  const label: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status]}`}>{label[status]}</span>;
}

function ReviewBtns({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={onApprove} className="px-3 py-1.5 rounded-lg bg-success/15 text-success font-semibold text-xs flex items-center gap-1">
        <Check className="size-3" /> موافقة
      </button>
      <button onClick={onReject} className="px-3 py-1.5 rounded-lg bg-destructive/15 text-destructive font-semibold text-xs flex items-center gap-1">
        <X className="size-3" /> رفض
      </button>
    </div>
  );
}

async function review(table: string, id: string, status: "approved" | "rejected", queryKey: string, qc: any) {
  const { data: u } = await supabase.auth.getUser();
  const notes = window.prompt(status === "approved" ? "ملاحظات (اختياري):" : "سبب الرفض:") ?? "";
  const { error } = await supabase.from(table as any).update({
    status, admin_notes: notes || null, reviewed_at: new Date().toISOString(), reviewed_by: u.user?.id,
  }).eq("id", id);
  if (error) { toast.error(error.message); return; }
  await logActivity(`review_${table}_${status}`, table, id, { notes });
  toast.success(status === "approved" ? "تمت الموافقة" : "تم الرفض");
  qc.invalidateQueries({ queryKey: [queryKey] });
}

function LeaveList() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-leave"], queryFn: adminGetAllLeaveRequests });
  return (
    <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
      {data.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات</p>}
      {data.map((r: any) => (
        <div key={r.id} className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold">{r.employee_profiles.full_name} · <span className="text-xs text-muted-foreground">{r.employee_profiles.employee_code}</span></p>
              <p className="text-sm text-muted-foreground mt-0.5">{LEAVE_LABEL[r.leave_type]} · من {new Date(r.start_date).toLocaleDateString("ar-EG")} إلى {new Date(r.end_date).toLocaleDateString("ar-EG")}</p>
              {r.reason && <p className="text-sm mt-1">{r.reason}</p>}
              {r.admin_notes && <p className="text-xs mt-1 p-1.5 bg-muted rounded">رد: {r.admin_notes}</p>}
            </div>
            <StatusPill status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="mt-3">
              <ReviewBtns onApprove={() => review("leave_requests", r.id, "approved", "admin-leave", qc)}
                onReject={() => review("leave_requests", r.id, "rejected", "admin-leave", qc)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdvanceList() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-adv"], queryFn: adminGetAllAdvanceRequests });

  async function approveAdvance(r: any) {
    await review("employee_requests", r.id, "approved", "admin-adv", qc);
    if (r.type === "advance" && r.amount) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("employee_transactions").insert({
        employee_id: r.employee_id, type: "advance", amount: r.amount,
        notes: `سلفة معتمدة - طلب #${r.id.slice(0, 8)}`,
      });
      await logActivity("advance_transaction_created", "employee_transactions", r.id, { amount: r.amount, by: u.user?.id });
    }
  }

  return (
    <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
      {data.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات</p>}
      {data.map((r: any) => (
        <div key={r.id} className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold">{r.employee_profiles.full_name} · <span className="text-xs text-muted-foreground">{r.employee_profiles.employee_code}</span></p>
              <p className="text-sm text-muted-foreground mt-0.5">{ADV_LABEL[r.type]}{r.amount ? ` · ${Number(r.amount).toLocaleString("ar-EG")} ج.م` : ""}</p>
              {r.description && <p className="text-sm mt-1">{r.description}</p>}
              {r.admin_notes && <p className="text-xs mt-1 p-1.5 bg-muted rounded">رد: {r.admin_notes}</p>}
            </div>
            <StatusPill status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="mt-3">
              <ReviewBtns onApprove={() => approveAdvance(r)}
                onReject={() => review("employee_requests", r.id, "rejected", "admin-adv", qc)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GeneralList() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin-gen"], queryFn: adminGetAllGeneralRequests });
  return (
    <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
      {data.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات</p>}
      {data.map((r: any) => (
        <div key={r.id} className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-bold">{r.employee_profiles.full_name} · <span className="text-xs text-muted-foreground">{GEN_LABEL[r.request_type]}</span></p>
              <p className="font-semibold text-sm mt-0.5">{r.title}</p>
              {r.details && <p className="text-sm text-muted-foreground mt-1">{r.details}</p>}
              {r.admin_notes && <p className="text-xs mt-1 p-1.5 bg-muted rounded">رد: {r.admin_notes}</p>}
            </div>
            <StatusPill status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="mt-3">
              <ReviewBtns onApprove={() => review("general_requests", r.id, "approved", "admin-gen", qc)}
                onReject={() => review("general_requests", r.id, "rejected", "admin-gen", qc)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

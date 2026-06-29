import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { adminGetActivityLog } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({ meta: [{ title: "سجل النشاط - الإدارة" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data = [] } = useQuery({ queryKey: ["admin-activity"], queryFn: adminGetActivityLog });
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">سجل النشاط ({data.length})</h2>
      <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
        {data.length === 0 && (
          <div className="text-center py-12">
            <ScrollText className="size-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">لا يوجد نشاط بعد</p>
          </div>
        )}
        {data.map((r: any) => (
          <div key={r.id} className="p-3">
            <p className="font-mono text-xs font-semibold text-primary">{r.action}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {r.entity_type && `${r.entity_type}`}{r.entity_id && ` · ${r.entity_id.slice(0, 8)}`} · {new Date(r.created_at).toLocaleString("ar-EG")}
            </p>
            {r.details && <pre className="text-[10px] text-muted-foreground mt-1 p-1.5 bg-muted rounded overflow-x-auto">{JSON.stringify(r.details, null, 0)}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
}

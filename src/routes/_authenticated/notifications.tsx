import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNotifications } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { Bell, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "الإشعارات" }] }),
  component: NotifPage,
});

function NotifPage() {
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({ queryKey: ["notifs"], queryFn: getNotifications });

  useEffect(() => {
    // mark all as read on open
    const unread = notifs.filter((n: any) => !n.is_read).map((n: any) => n.id);
    if (unread.length === 0) return;
    supabase.from("notifications").update({ is_read: true }).in("id", unread).then(() => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
    });
  }, [notifs, qc]);

  return (
    <div>
      <PageHeader title="الإشعارات" subtitle="تنبيهات الإدارة وحالة طلباتك" />
      <main className="px-5 -mt-10 max-w-md mx-auto">
        <div className="bg-card rounded-2xl shadow-card border border-border divide-y divide-border">
          {notifs.length === 0 && (
            <div className="text-center py-12">
              <Bell className="size-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">لا توجد إشعارات</p>
            </div>
          )}
          {notifs.map((n: any) => (
            <div key={n.id} className="p-4 flex gap-3">
              <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${n.is_read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                {n.is_read ? <CheckCircle2 className="size-5" /> : <Bell className="size-5" />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-EG")}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

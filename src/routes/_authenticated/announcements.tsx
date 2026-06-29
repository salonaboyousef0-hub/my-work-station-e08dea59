import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, AlertTriangle, Newspaper, BookOpen } from "lucide-react";
import { getAnnouncements } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "الإعلانات" }] }),
  component: AnnPage,
});

const CAT: Record<string, { icon: any; cls: string; label: string }> = {
  general: { icon: Megaphone, cls: "bg-primary/10 text-primary", label: "عام" },
  news: { icon: Newspaper, cls: "bg-info/10 text-info", label: "خبر" },
  instruction: { icon: BookOpen, cls: "bg-success/10 text-success", label: "تعليمات" },
  alert: { icon: AlertTriangle, cls: "bg-warning/15 text-warning", label: "تنبيه" },
};

function AnnPage() {
  const { data: items = [] } = useQuery({ queryKey: ["announcements"], queryFn: getAnnouncements });

  return (
    <div>
      <PageHeader title="إعلانات الإدارة" subtitle="آخر الأخبار والتعليمات" />
      <main className="px-5 -mt-10 space-y-3 max-w-md mx-auto">
        {items.length === 0 && (
          <div className="bg-card rounded-2xl p-10 text-center border border-border">
            <Megaphone className="size-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">لا توجد إعلانات حالياً</p>
          </div>
        )}
        {items.map((a: any) => {
          const cat = CAT[a.category] ?? CAT.general;
          const Icon = cat.icon;
          return (
            <article key={a.id} className="bg-card rounded-2xl p-4 shadow-card border border-border">
              <div className="flex items-start gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${cat.cls}`}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold">{a.title}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.cls}`}>{cat.label}</span>
                  </div>
                  <p className="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(a.published_at).toLocaleString("ar-EG")}</p>
                </div>
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}

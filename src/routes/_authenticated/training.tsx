import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Video, FileText, Link2, CheckCircle2, Circle, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTraining } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [{ title: "مركز التدريب" }] }),
  component: TrainingPage,
});

const ICONS: Record<string, any> = { video: Video, pdf: FileText, text: FileText, link: Link2 };

function TrainingPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["training"], queryFn: getTraining });

  async function toggle(materialId: string, completed: boolean) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (completed) {
      await supabase.from("training_progress").delete().eq("employee_id", u.user.id).eq("material_id", materialId);
    } else {
      await supabase.from("training_progress").insert({ employee_id: u.user.id, material_id: materialId });
      toast.success("تم تسجيل الإكمال");
    }
    qc.invalidateQueries({ queryKey: ["training"] });
  }

  const doneCount = items.filter((m: any) => m.completed).length;

  return (
    <div>
      <PageHeader title="مركز التدريب" subtitle="مواد تدريبية لتطوير مهاراتك" />
      <main className="px-5 -mt-10 space-y-4 max-w-md mx-auto">
        <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-5 shadow-elevated flex items-center justify-between">
          <div>
            <p className="text-sm opacity-85">تقدّمك في التدريب</p>
            <p className="text-2xl font-bold mt-1">{doneCount} من {items.length}</p>
          </div>
          <GraduationCap className="size-10 opacity-80" />
        </div>

        {items.length === 0 && (
          <div className="bg-card rounded-2xl p-10 text-center border border-border">
            <p className="text-sm text-muted-foreground">لا توجد مواد تدريبية بعد</p>
          </div>
        )}

        <div className="space-y-3">
          {items.map((m: any) => {
            const Icon = ICONS[m.media_type] ?? FileText;
            return (
              <div key={m.id} className="bg-card rounded-2xl p-4 shadow-card border border-border">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">{m.title}</h3>
                      {m.is_required && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning">مطلوب</span>}
                    </div>
                    {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                    {m.media_url && (
                      <a href={m.media_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary font-semibold mt-2 inline-block">فتح المحتوى ←</a>
                    )}
                    <button onClick={() => toggle(m.id, m.completed)}
                      className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm ${m.completed ? "bg-success/15 text-success" : "bg-muted text-foreground"}`}>
                      {m.completed ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                      {m.completed ? "مكتمل" : "تحديد كمكتمل"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { getMyAssets } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({ meta: [{ title: "العهد والأدوات" }] }),
  component: AssetsPage,
});

const CONDITION: Record<string, { label: string; cls: string }> = {
  new: { label: "جديدة", cls: "bg-success/15 text-success" },
  good: { label: "جيدة", cls: "bg-primary/15 text-primary" },
  fair: { label: "مقبولة", cls: "bg-warning/15 text-warning" },
  damaged: { label: "تالفة", cls: "bg-destructive/15 text-destructive" },
  lost: { label: "مفقودة", cls: "bg-destructive/15 text-destructive" },
};

function AssetsPage() {
  const { data: items = [] } = useQuery({ queryKey: ["assets"], queryFn: getMyAssets });

  return (
    <div>
      <PageHeader title="العهد والأدوات" subtitle="الأدوات المسجلة باسمك" />
      <main className="px-5 -mt-10 space-y-3 max-w-md mx-auto">
        {items.length === 0 && (
          <div className="bg-card rounded-2xl p-10 text-center border border-border">
            <Package className="size-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">لا توجد عهد مسجلة باسمك</p>
          </div>
        )}
        {items.map((a: any) => {
          const c = CONDITION[a.condition] ?? CONDITION.good;
          return (
            <div key={a.id} className="bg-card rounded-2xl p-4 shadow-card border border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Package className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold">{a.asset_name}</p>
                    {a.serial_number && <p className="text-xs text-muted-foreground mt-0.5">SN: {a.serial_number}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      استلام: {new Date(a.received_date).toLocaleDateString("ar-EG")}
                      {a.returned_date && ` · إرجاع: ${new Date(a.returned_date).toLocaleDateString("ar-EG")}`}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${c.cls}`}>{c.label}</span>
              </div>
              {a.notes && <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded-lg">{a.notes}</p>}
            </div>
          );
        })}
      </main>
    </div>
  );
}

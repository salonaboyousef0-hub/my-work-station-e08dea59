import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Clock, Wallet, BarChart3, Inbox } from "lucide-react";

const items = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/attendance", label: "الحضور", icon: Clock },
  { to: "/financial", label: "حسابي", icon: Wallet },
  { to: "/performance", label: "الأداء", icon: BarChart3 },
  { to: "/requests", label: "الطلبات", icon: Inbox },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border safe-area">
      <ul className="grid grid-cols-5 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`size-10 rounded-xl flex items-center justify-center transition ${
                  active ? "bg-primary/10" : ""
                }`}>
                  <Icon className="size-5" />
                </div>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

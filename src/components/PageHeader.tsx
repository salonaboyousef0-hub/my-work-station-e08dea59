import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function PageHeader({ title, subtitle, back = "/home" }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="bg-gradient-primary text-primary-foreground px-5 pt-12 pb-16 rounded-b-[2rem] shadow-elevated">
      <Link to={back} className="inline-flex items-center gap-1 text-sm opacity-90 mb-4">
        <ChevronRight className="size-4" /> الرجوع
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm opacity-90 mt-1">{subtitle}</p>}
    </header>
  );
}

import { ChevronRight } from "lucide-react";

type PageHeaderProps = {
  title: string;
  breadcrumbs?: string[];
  rightSlot?: React.ReactNode;
};

export function PageHeader({ title, breadcrumbs = [], rightSlot }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {breadcrumbs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Inicio</span>
            {breadcrumbs.map((crumb) => (
              <span key={crumb} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <span>{crumb}</span>
              </span>
            ))}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
      </div>
      {rightSlot ? <div className="flex flex-wrap gap-2">{rightSlot}</div> : null}
    </div>
  );
}

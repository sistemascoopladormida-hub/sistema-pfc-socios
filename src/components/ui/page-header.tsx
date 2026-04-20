import { ChevronRight } from "lucide-react";

type PageHeaderProps = {
  title: string;
  breadcrumbs?: string[];
  rightSlot?: React.ReactNode;
};

export function PageHeader({ title, breadcrumbs = [], rightSlot }: PageHeaderProps) {
  return (
    //se quita el flex y se agrega hidden para no mostrar este componente en el dashboard
    <div className="mb-6 hidden flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="font-display text-3xl leading-none text-pfcText-primary">{title}</h1>
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-1 text-xs text-pfcText-muted">
            <span>Inicio</span>
            {breadcrumbs.map((crumb) => (
              <span key={crumb} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <span>{crumb}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}

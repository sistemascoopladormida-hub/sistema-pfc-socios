import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title?: string;
  message?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
};

export function EmptyState({
  title = "Sin resultados",
  message = "No hay datos disponibles",
  ctaLabel,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[24px] border border-border bg-card text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10">
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400/70" />
        <Inbox className="h-7 w-7 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {ctaLabel && onCtaClick ? (
        <Button variant="outline" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}

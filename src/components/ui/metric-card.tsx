"use client";

import type { LucideIcon } from "lucide-react";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

type MetricCardTone = "teal" | "amber" | "red" | "slate";

type MetricCardProps = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  tone?: MetricCardTone;
};

const toneStyles: Record<MetricCardTone, string> = {
  teal: "bg-emerald-400/12 text-emerald-700 ring-1 ring-emerald-300/18 dark:text-emerald-300",
  amber: "bg-amber-400/12 text-amber-700 ring-1 ring-amber-300/18 dark:text-amber-300",
  red: "bg-rose-400/12 text-rose-700 ring-1 ring-rose-300/18 dark:text-rose-300",
  slate: "bg-muted text-foreground ring-1 ring-border",
};

export function MetricCard({ label, value, description, icon: Icon, tone = "slate" }: MetricCardProps) {
  return (
    <article className="rounded-[24px] border border-border bg-card p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            <AnimatedNumber value={value} />
          </p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneStyles[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

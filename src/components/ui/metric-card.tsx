"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { useMotionSettings } from "@/hooks/use-motion-settings";
import { cn } from "@/lib/utils";

type MetricCardTone = "teal" | "blue" | "amber" | "red" | "slate";

type MetricCardProps = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  tone?: MetricCardTone;
  trend?: { label: string; positive?: boolean };
  accentWarning?: boolean;
};

const toneStyles: Record<MetricCardTone, { iconBg: string; iconColor: string }> = {
  teal: { iconBg: "bg-[#DDF3ED]", iconColor: "text-[#0D6E5A]" },
  blue: { iconBg: "bg-blue-100", iconColor: "text-blue-700" },
  amber: { iconBg: "bg-amber-100", iconColor: "text-amber-700" },
  red: { iconBg: "bg-red-100", iconColor: "text-red-700" },
  slate: { iconBg: "bg-slate-100", iconColor: "text-slate-700" },
};

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "teal",
  trend,
  accentWarning = false,
}: MetricCardProps) {
  const motionSettings = useMotionSettings();
  const toneStyle = toneStyles[tone];

  return (
    <motion.article
      initial={motionSettings.page.initial}
      animate={motionSettings.page.animate}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-xl border border-[#E8EBE9] bg-white p-4 shadow-pfc-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pfc-card-hover",
        accentWarning && "border-l-[3px] border-l-amber-500"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold tracking-[0.08em] text-pfcText-muted uppercase">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneStyle.iconBg)}>
          <Icon className={cn("h-4 w-4", toneStyle.iconColor)} />
        </span>
      </div>
      <p className="font-display text-[42px] leading-none text-pfcText-primary">
        <AnimatedNumber value={value} />
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-pfcText-secondary">{description}</p>
        {trend ? (
          <span className={cn("text-[11px] font-medium", trend.positive ? "text-emerald-700" : "text-red-700")}>
            {trend.label}
          </span>
        ) : null}
      </div>
    </motion.article>
  );
}

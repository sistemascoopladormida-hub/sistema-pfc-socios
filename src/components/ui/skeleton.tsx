import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = ComponentProps<"div">;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/80", className)} {...props} />;
}

"use client";

import { useReducedMotion } from "framer-motion";

export function useMotionSettings() {
  const prefersReducedMotion = useReducedMotion();

  return {
    prefersReducedMotion,
    page: prefersReducedMotion
      ? { initial: false as const, animate: {} }
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
    item: prefersReducedMotion
      ? { initial: false as const, animate: {} }
      : { initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 } },
  };
}

"use client";

import { useEffect, useMemo, useState } from "react";

type AnimatedNumberProps = {
  value: number;
  durationMs?: number;
};

export function AnimatedNumber({ value, durationMs = 650 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const target = useMemo(() => Number(value || 0), [value]);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return <>{display.toLocaleString("es-AR")}</>;
}

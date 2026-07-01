"use client";

import { useCallback, useEffect, useState } from "react";

import type { OrtopediaDashboardData } from "@/lib/ortopedia-dashboard";

type DashboardResponse = {
  success: boolean;
  error?: string;
} & Partial<OrtopediaDashboardData>;

const REFRESH_MS = 60_000;

export function useOrtopediaDashboard(enabled: boolean) {
  const [data, setData] = useState<OrtopediaDashboardData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) return;
    if (!options?.silent) setLoading(true);

    try {
      const response = await fetch("/api/ortopedia/dashboard", { cache: "no-store" });
      const json = (await response.json()) as DashboardResponse;
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "No se pudo cargar el dashboard de ortopedia");
      }

      setData({
        metricas: json.metricas!,
        graficos: json.graficos!,
        actividad_reciente: json.actividad_reciente ?? [],
        alertas: json.alertas ?? [],
      });
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Error de dashboard");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchDashboard();
    const timer = window.setInterval(() => {
      void fetchDashboard({ silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, fetchDashboard]);

  return {
    data,
    loading,
    error,
    refresh: () => fetchDashboard(),
    alertCount: data?.alertas.length ?? 0,
  };
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Clock3, Plus, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataBadge } from "@/components/ui/data-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessModule, useUser } from "@/lib/user-context";

type DashboardEstadoTurno = "RESERVADO" | "ATENDIDO" | "CANCELADO" | "AUSENTE";

type DashboardResponse = {
  success: boolean;
  data?: {
    personas_cubiertas: number;
    socios_titulares: number;
    socios_adherentes: number;
    hijos_mayores_18: number;
    hijos_menores_18: number;
    adherentes_beneficio_titular: number;
    turnos_hoy: number;
    profesionales_activos: number;
    prestaciones_mes: number;
    prestaciones_top: Array<{ nombre: string; total: number }>;
    prestaciones_uso: Array<{ nombre: string; total: number }>;
    prestaciones_periodo: "mes" | "anio" | "historico";
    turnos_por_mes: Array<{ anio: number; mes: number; total: number }>;
    turnos_reservados_vencidos: number;
    turnos_recientes: Array<{
      id: number;
      socio: string;
      cod_soc: number | string;
      adherente_codigo: number | string;
      profesional: string;
      prestacion: string;
      estado: DashboardEstadoTurno | string;
      fecha: string;
      hora: string;
    }>;
  };
  error?: string;
};

type DashboardData = NonNullable<DashboardResponse["data"]>;
type DashboardAlert = {
  id: string;
  message: string;
  href: string;
};

const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const estadoLabel: Record<DashboardEstadoTurno, string> = {
  RESERVADO: "Pendiente",
  ATENDIDO: "Atendido",
  CANCELADO: "Cancelado",
  AUSENTE: "Ausente",
};

const statusToneByEstado: Record<DashboardEstadoTurno, "reservado" | "atendido" | "cancelado" | "ausente"> = {
  RESERVADO: "reservado",
  ATENDIDO: "atendido",
  CANCELADO: "cancelado",
  AUSENTE: "ausente",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-44 rounded-[24px]" />
        <Skeleton className="h-44 rounded-[24px]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-36 rounded-[24px]" />
        <Skeleton className="h-36 rounded-[24px]" />
        <Skeleton className="h-36 rounded-[24px]" />
        <Skeleton className="h-36 rounded-[24px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[320px] rounded-[24px]" />
        <Skeleton className="h-[320px] rounded-[24px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Skeleton className="h-[340px] rounded-[24px]" />
        <Skeleton className="h-[340px] rounded-[24px]" />
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Record<string, string | number> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
      {label ? <p className="font-medium">{label}</p> : null}
      <p className="text-slate-500 dark:text-slate-400">{payload[0].value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { role } = useUser();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard", { method: "GET", cache: "no-store" });
        const data = (await response.json()) as DashboardResponse;

        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "Error cargando dashboard");
        }

        setDashboardData(data.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Error cargando dashboard");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (!canAccessModule(role, "dashboard")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>Este perfil no puede ver el dashboard.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos cargar el dashboard</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!dashboardData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin datos</CardTitle>
          <CardDescription>No hay informacion disponible para mostrar.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const actividadReciente = dashboardData.turnos_recientes.slice(0, 5).map((turno) => ({
    ...turno,
    normalizedEstado: turno.estado.toUpperCase() as DashboardEstadoTurno,
  }));

  const prestacionesChart = dashboardData.prestaciones_top
    .filter((item) => item.total > 0)
    .slice(0, 5)
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      nombre: item.nombre,
      total: item.total,
      corto: item.nombre.length > 24 ? `${item.nombre.slice(0, 24)}...` : item.nombre,
    }));

  const turnosPorMesChart = dashboardData.turnos_por_mes.map((item) => ({
    mes: monthLabels[item.mes - 1] ?? String(item.mes),
    total: item.total,
  }));

  const turnosPendientes = dashboardData.turnos_reservados_vencidos;
  const turnosAusentes = actividadReciente.filter((turno) => turno.normalizedEstado === "AUSENTE").length;

  const alerts: DashboardAlert[] = [
    turnosPendientes > 0
      ? {
          id: "turnos-vencidos",
          message: `${turnosPendientes} turnos reservados ya vencieron su horario y deben actualizarse de estado.`,
          href: "/turnos?alerta=vencidos",
        }
      : null,
    turnosAusentes > 0
      ? {
          id: "turnos-ausentes",
          message: `${turnosAusentes} turnos marcados como ausentes.`,
          href: "/turnos?estado=AUSENTE",
        }
      : null,
    dashboardData.hijos_mayores_18 > 0
      ? {
          id: "hijos-mayores",
          message: `${dashboardData.hijos_mayores_18} hijos cumplieron mayoría de edad y deben revisar plan propio.`,
          href: "/socios?foco=hijos-mayores",
        }
      : null,
  ].filter(Boolean) as DashboardAlert[];

  const chartGridStroke = "rgba(148,163,184,0.14)";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del dia</CardTitle>
            <CardDescription>Lo mas importante para empezar a trabajar sin perder tiempo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Desde aca podes ver el estado general, detectar tendencias y hacer la accion principal del sistema.
            </p>
            <Link href="/turnos/nuevo" className="inline-flex">
              <button className="inline-flex h-12 items-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_rgba(16,185,129,0.18)] transition-colors hover:brightness-105">
                <Plus className="mr-2 h-4 w-4" />
                Crear turno
              </button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Mostramos solo lo que necesita atencion.</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="rounded-[20px] border border-emerald-300/16 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-800 dark:text-emerald-100">
                No hay alertas importantes en este momento.
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    className="flex items-start gap-3 rounded-[20px] border border-amber-300/14 bg-amber-400/10 px-4 py-4 transition-colors hover:bg-amber-400/16"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" />
                    <p className="text-sm leading-6 text-amber-800 dark:text-amber-100">{alert.message}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cantidad total"
          value={dashboardData.turnos_hoy}
          description="de turnos registrados."
          icon={Calendar}
          tone="teal"
        />
        <MetricCard
          label="Turnos a revisar"
          value={turnosPendientes}
          description="Reservados vencidos que deben actualizar estado."
          icon={Clock3}
          tone={turnosPendientes > 0 ? "amber" : "slate"}
        />
        <MetricCard
          label="Socios activos"
          value={dashboardData.socios_titulares}
          description="Socios titulares con actividad en el sistema."
          icon={Users}
          tone="slate"
        />
        <MetricCard
          label="Personas cubiertas"
          value={dashboardData.personas_cubiertas}
          description="Total de personas dentro del plan."
          icon={Users}
          tone="slate"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Turnos por mes</CardTitle>
            <CardDescription>Vista simple de la tendencia de los ultimos 12 meses.</CardDescription>
          </CardHeader>
          <CardContent>
            {turnosPorMesChart.length === 0 ? (
              <EmptyState message="No hay datos para mostrar este grafico." />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={turnosPorMesChart} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chartGridStroke} />
                    <XAxis
                      dataKey="mes"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      width={34}
                    />
                    <Tooltip content={({ active, payload, label }) => <ChartTooltip active={active} payload={payload as never} label={String(label ?? "")} />} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="var(--chart-1)"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "var(--chart-1)" }}
                      activeDot={{ r: 4, fill: "var(--chart-1)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prestaciones mas utilizadas</CardTitle>
            <CardDescription>Top simple para entender la demanda sin tablas complejas.</CardDescription>
          </CardHeader>
          <CardContent>
            {prestacionesChart.length === 0 ? (
              <EmptyState message="No hay prestaciones con actividad para mostrar." />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prestacionesChart} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="corto"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      width={140}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as { nombre: string; total: number };
                        return <ChartTooltip active payload={[{ value: row.total, payload: row }]} label={row.nombre} />;
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 10, 10, 0]} barSize={18}>
                      {prestacionesChart.map((item) => (
                        <Cell key={item.nombre} fill="var(--chart-1)" opacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Ultimos movimientos, en una lista corta y facil de leer.</CardDescription>
          </CardHeader>
          <CardContent>
            {actividadReciente.length === 0 ? (
              <EmptyState message="Todavia no hay actividad reciente." />
            ) : (
              <div className="space-y-3">
                {actividadReciente.map((turno) => (
                  <div key={turno.id} className="rounded-[20px] border border-border bg-card px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{turno.socio}</p>
                      <DataBadge kind={statusToneByEstado[turno.normalizedEstado]}>
                        {estadoLabel[turno.normalizedEstado] ?? turno.estado}
                      </DataBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {turno.prestacion} con {turno.profesional}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {turno.fecha} a las {turno.hora}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accesos rapidos</CardTitle>
            <CardDescription>Entradas simples a las tareas mas frecuentes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/turnos" className="block rounded-[20px] border border-border bg-card px-4 py-4 transition-colors hover:bg-muted">
              <p className="text-sm font-medium text-foreground">Ver turnos</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Revisar, buscar y gestionar turnos del dia.</p>
            </Link>
            <Link href="/socios" className="block rounded-[20px] border border-border bg-card px-4 py-4 transition-colors hover:bg-muted">
              <p className="text-sm font-medium text-foreground">Ver socios</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consultar datos de cobertura e historial.</p>
            </Link>
            <Link
              href="/ortopedia/prestamos"
              className="block rounded-[20px] border border-border bg-card px-4 py-4 transition-colors hover:bg-muted"
            >
              <p className="text-sm font-medium text-foreground">Ver prestamos</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Controlar prestamos y devoluciones.</p>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

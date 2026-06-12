"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Calendar, CalendarClock, Clock3, UserCheck, Users } from "lucide-react";
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
    adherentes_beneficio_titular: number;
    beneficiarios_cobertura_propia: number;
    alertas: {
      turnos_vencidos: number;
      beneficiarios_cobertura_propia: number;
    };
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
    operacion_hoy: {
      programados: number;
      atendidos: number;
      ausentes: number;
      cancelados: number;
      total: number;
      por_cerrar: number;
    };
    proximos_turnos_hoy: Array<{
      id: number;
      hora: string;
      socio: string;
      profesional: string;
      prestacion: string;
      estado: string;
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

function formatFechaHoyEs() {
  const texto = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function OperacionHoyPanel({
  operacion,
  proximos,
}: {
  operacion: DashboardData["operacion_hoy"];
  proximos: DashboardData["proximos_turnos_hoy"];
}) {
  const avance =
    operacion.total > 0 ? Math.min(100, Math.round((operacion.atendidos / operacion.total) * 100)) : 0;
  const proximosVisibles = proximos.slice(0, 3);
  const hayProximos = proximosVisibles.length > 0;

  const mensajeEstado =
    operacion.total === 0
      ? "No hay turnos cargados para hoy."
      : !hayProximos && operacion.por_cerrar > 0
        ? `${operacion.por_cerrar} reserva${operacion.por_cerrar === 1 ? "" : "s"} de hoy sin actualizar de estado.`
        : !hayProximos
          ? "No quedan turnos por horario. Jornada al día."
          : null;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Operación de hoy
        </CardTitle>
        <CardDescription>{formatFechaHoyEs()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-foreground">{operacion.programados}</span> programados ·{" "}
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{operacion.atendidos}</span> atendidos
          ·{" "}
          <span
            className={
              operacion.por_cerrar > 0
                ? "font-semibold text-amber-800 dark:text-amber-200"
                : "font-semibold text-foreground"
            }
          >
            {operacion.por_cerrar}
          </span>{" "}
          por cerrar
          {operacion.total > 0 ? (
            <span className="text-muted-foreground"> · {avance}% del día</span>
          ) : null}
        </p>

        {hayProximos ? (
          <div className="space-y-1.5">
            {proximosVisibles.map((turno, index) => (
              <Link
                key={turno.id}
                href={`/turnos/${turno.id}`}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition-colors hover:bg-muted ${
                  index === 0 ? "border-primary/20 bg-primary/5 hover:bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span
                  className={`shrink-0 rounded-xl px-2 py-0.5 text-xs font-semibold ${
                    index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {turno.hora}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  <span className="font-medium">{turno.socio}</span>
                  <span className="text-muted-foreground"> · {turno.prestacion}</span>
                </span>
                <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${index === 0 ? "text-primary" : "text-muted-foreground"}`} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{mensajeEstado}</p>
        )}

        <div className="flex justify-end text-sm">
          <Link href="/turnos" className="font-medium text-primary hover:underline">
            Ver turnos
          </Link>
        </div>
      </CardContent>
    </Card>
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

  const turnosPendientes =
    dashboardData.alertas?.turnos_vencidos ?? dashboardData.turnos_reservados_vencidos;
  const beneficiariosCoberturaPropia =
    dashboardData.alertas?.beneficiarios_cobertura_propia ??
    dashboardData.beneficiarios_cobertura_propia ??
    0;

  const alerts: DashboardAlert[] = [
    turnosPendientes > 0
      ? {
          id: "turnos-vencidos",
          message: `${turnosPendientes} turnos reservados ya vencieron su horario y deben actualizarse de estado.`,
          href: "/turnos?alerta=vencidos",
        }
      : null,
    beneficiariosCoberturaPropia > 0
      ? {
          id: "cobertura-propia",
          message: `${beneficiariosCoberturaPropia} beneficiarios requieren cobertura propia (mayor de 18 años, no cónyuge).`,
          href: "/socios?segmento=REQUIERE_REGULARIZACION",
        }
      : null,
  ].filter(Boolean) as DashboardAlert[];

  const chartGridStroke = "rgba(148,163,184,0.14)";

  return (
    <div className="space-y-6">
      <section className="grid items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <OperacionHoyPanel
          operacion={
            dashboardData.operacion_hoy ?? {
              programados: 0,
              atendidos: 0,
              ausentes: 0,
              cancelados: 0,
              total: 0,
              por_cerrar: 0,
            }
          }
          proximos={dashboardData.proximos_turnos_hoy ?? []}
        />

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
          label="Cobertura propia requerida"
          value={beneficiariosCoberturaPropia}
          description="Beneficiarios mayores de 18 años que no son cónyuge."
          icon={UserCheck}
          tone={beneficiariosCoberturaPropia > 0 ? "amber" : "slate"}
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

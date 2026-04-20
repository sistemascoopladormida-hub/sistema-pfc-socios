"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, HeartPulse, Stethoscope, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PRESTACIONES_PIE_COLORS = [
  "#0D6E5A",
  "#138A3D",
  "#0EA5E9",
  "#2563EB",
  "#6366F1",
  "#059669",
  "#B45309",
  "#92400E",
  "#0D9488",
  "#4F46E5",
];

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataBadge } from "@/components/ui/data-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    /** Top N prestaciones para el gráfico circular (las más usadas con al menos 1 atención). */
    prestaciones_top: Array<{ nombre: string; total: number }>;
    /** Todas las prestaciones del catálogo con total de atenciones en el periodo (incluye 0). */
    prestaciones_uso: Array<{ nombre: string; total: number }>;
    prestaciones_periodo: "mes" | "anio" | "historico";
    turnos_recientes: Array<{
      id: number;
      socio: string;
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

const estadoLabel: Record<DashboardEstadoTurno, string> = {
  RESERVADO: "Reservado",
  ATENDIDO: "Atendido",
  CANCELADO: "Cancelado",
  AUSENTE: "Ausente",
};

function labelPrestacionesPeriodo(periodo: DashboardData["prestaciones_periodo"]) {
  if (periodo === "anio") return "Año en curso (atenciones atendidas)";
  return "Periodo no configurado";
}

export default function DashboardPage() {
  const { role } = useUser();
  const anioEnCurso = new Date().getFullYear();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store",
        });
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
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No tienes permisos para acceder a este modulo.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Loading label="Cargando dashboard..." />;
  }

  if (error) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Error al cargar dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Dashboard sin datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No se recibieron datos del backend.</p>
        </CardContent>
      </Card>
    );
  }

  const actividadReciente = dashboardData.turnos_recientes.map((turno) => {
    return `${turno.socio} - ${turno.prestacion} (${turno.estado})`;
  });

  return (
    <div className="mx-auto space-y-6">
      <PageHeader title="Panel de control" breadcrumbs={["panel gerencial"]} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-8">
            <div className="flex items-center gap-4">
              <HeartPulse className="h-10 w-10 text-pfc-600" />
              <div className="space-y-1">
                <h2 className="font-display text-3xl text-pfcText-primary">Visión general del sistema PFC</h2>
                <p className="text-sm text-pfcText-secondary">
                  Métricas clave para recepción y directivos con foco en cobertura y operación diaria.
                </p>
              </div>
            </div>
            <Link href="/turnos/nuevo">
              <span className="inline-flex h-10 items-center rounded-lg bg-[#0D6E5A] px-4 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0B5B4B]">
                <Calendar className="mr-2 h-4 w-4" />
                Crear turno
              </span>
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      <section>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-pfcText-muted">
          Indicadores principales
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Personas cubiertas"
            value={dashboardData.personas_cubiertas}
            description="Personas incluidas en el plan PFC."
            icon={Users}
            tone="teal"
          />
          <MetricCard
            label="Socios titulares"
            value={dashboardData.socios_titulares}
            description="Socios titulares del plan."
            icon={Users}
            tone="blue"
          />
          <MetricCard
            label="Socios adherentes"
            value={dashboardData.socios_adherentes}
            description="Adherentes asociados al titular."
            icon={Users}
            tone="teal"
          />
          <MetricCard
            label="Turnos del año"
            value={dashboardData.turnos_hoy}
            description={`Turnos registrados en ${anioEnCurso}.`}
            icon={Calendar}
            tone="blue"
          />
          <MetricCard
            label="Profesionales activos"
            value={dashboardData.profesionales_activos}
            description="Profesionales con agenda activa."
            icon={Stethoscope}
            tone="teal"
          />
          <MetricCard
            label="Prestaciones registradas"
            value={dashboardData.prestaciones_mes}
            description={`Atenciones atendidas en ${anioEnCurso}.`}
            icon={HeartPulse}
            tone="teal"
          />
          <MetricCard
            label="HIJO/A mayor de 18"
            value={dashboardData.hijos_mayores_18}
            description="Deben pagar cuota y acceder a beneficios propios."
            icon={Users}
            tone="amber"
            accentWarning
          />
          <MetricCard
            label="Beneficio titular"
            value={dashboardData.adherentes_beneficio_titular}
            description="Cónyuge, otros e hijos menores de 18."
            icon={Users}
            tone="teal"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {actividadReciente.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-3 text-sm text-slate-700">
                {actividadReciente.map((item) => (
                  <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle>Prestaciones más utilizadas</CardTitle>
            <p className="text-sm text-slate-600">
              Gráfico anual {anioEnCurso}: las 10 prestaciones con más atenciones (
              {labelPrestacionesPeriodo(dashboardData.prestaciones_periodo)}). El listado debajo incluye el catálogo
              completo.
            </p>
          </CardHeader>
          <CardContent className="h-80 min-h-[320px]">
            {dashboardData.prestaciones_top.length === 0 ? (
              <EmptyState message="No hay atenciones atendidas en el periodo para armar el gráfico." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={dashboardData.prestaciones_top}
                    dataKey="total"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={96}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={1}
                  >
                    {dashboardData.prestaciones_top.map((_, index) => (
                      <Cell key={`slice-${index}`} fill={PRESTACIONES_PIE_COLORS[index % PRESTACIONES_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as { nombre: string; total: number };
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
                          <p className="font-medium text-slate-900">{row.nombre}</p>
                          <p className="text-slate-600">{row.total} atenciones</p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    layout="horizontal"
                    formatter={(value) => <span className="text-xs text-slate-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* <Card className="bg-white shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle>Todas las prestaciones</CardTitle>
          <p className="text-sm text-slate-600">
            Total de atenciones atendidas por prestación ({labelPrestacionesPeriodo(dashboardData.prestaciones_periodo)}
            ). Ordenado por cantidad descendente.
          </p>
        </CardHeader>
        <CardContent>
          {dashboardData.prestaciones_uso.length === 0 ? (
            <EmptyState message="No hay prestaciones en el catálogo." />
          ) : (
            <div className="max-h-[min(480px,60vh)] overflow-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Prestación</TableHead>
                    <TableHead className="text-right">Atenciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.prestaciones_uso.map((row, index) => (
                    <TableRow key={`${row.nombre}-${index}`}>
                      <TableCell className="text-slate-500">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900">{row.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card> */}

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Turnos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData.turnos_recientes.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Prestacion</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboardData.turnos_recientes.map((turno) => {
                  const normalizedEstado = turno.estado.toUpperCase() as DashboardEstadoTurno;
                  return (
                  <TableRow key={turno.id}>
                    <TableCell>{turno.socio}</TableCell>
                    <TableCell>{turno.profesional}</TableCell>
                    <TableCell>{turno.prestacion}</TableCell>
                    <TableCell>
                      <DataBadge
                        kind={
                          normalizedEstado === "RESERVADO"
                            ? "reservado"
                            : normalizedEstado === "ATENDIDO"
                              ? "atendido"
                              : normalizedEstado === "AUSENTE"
                                ? "ausente"
                                : "cancelado"
                        }
                      >
                        {estadoLabel[normalizedEstado] ?? turno.estado}
                      </DataBadge>
                    </TableCell>
                    <TableCell>{turno.fecha}</TableCell>
                    <TableCell>{turno.hora}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

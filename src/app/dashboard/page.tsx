"use client";

import { useEffect, useState } from "react";
import { Calendar, HeartPulse, Stethoscope, Users } from "lucide-react";
import { motion } from "framer-motion";

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
    prestaciones_top: Array<{ nombre: string; total: number }>;
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
          <CardContent className="flex items-center gap-4 py-8">
            <HeartPulse className="h-10 w-10 text-pfc-600" />
            <div className="space-y-1">
              <h2 className="font-display text-3xl text-pfcText-primary">Visión general del sistema PFC</h2>
              <p className="text-sm text-pfcText-secondary">
                Métricas clave para recepción y directivos con foco en cobertura y operación diaria.
              </p>
            </div>
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
            label="Turnos del día"
            value={dashboardData.turnos_hoy}
            description="Turnos reservados para hoy."
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
            label="Prestaciones del mes"
            value={dashboardData.prestaciones_mes}
            description="Atenciones realizadas en el mes."
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
          <CardHeader>
            <CardTitle>Prestaciones mas utilizadas</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.prestaciones_top.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-3 text-sm text-slate-700">
                {dashboardData.prestaciones_top.map((item) => (
                  <li
                    key={item.nombre}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                  >
                    <span>{item.nombre}</span>
                    <span className="font-semibold">{item.total} sesiones</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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

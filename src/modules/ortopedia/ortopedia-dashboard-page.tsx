"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  FileUp,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrtopediaDashboard } from "@/hooks/use-ortopedia-dashboard";
import { useMotionSettings } from "@/hooks/use-motion-settings";
import { ROLES } from "@/lib/roles";
import { useUser } from "@/lib/user-context";

const PIE_COLORS = ["#10b981", "#6366f1", "#ef4444", "#f59e0b"];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[24px]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[320px] rounded-[24px]" />
        <Skeleton className="h-[320px] rounded-[24px]" />
      </div>
    </div>
  );
}

function actividadIcon(tipo: string) {
  switch (tipo) {
    case "devolucion":
      return PackageCheck;
    case "renovacion":
      return RefreshCw;
    case "certificado":
      return FileUp;
    default:
      return Package;
  }
}

export function OrtopediaDashboardPage() {
  const { role } = useUser();
  const { page, item } = useMotionSettings();
  const { data, loading, error } = useOrtopediaDashboard(role === ROLES.ORTOPEDIA_ADMIN);

  if (role !== ROLES.ORTOPEDIA_ADMIN) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No posee permisos para acceder al Dashboard de Ortopedia.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se pudo cargar el dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{error ?? "Sin datos disponibles."}</p>
        </CardContent>
      </Card>
    );
  }

  const topElementosChart = data.graficos.top_elementos.map((item) => ({
    ...item,
    corto: item.nombre.length > 22 ? `${item.nombre.slice(0, 22)}...` : item.nombre,
  }));

  const stockChart = data.graficos.stock_elementos.slice(0, 8).map((item) => ({
    nombre: item.nombre.length > 16 ? `${item.nombre.slice(0, 16)}...` : item.nombre,
    Disponible: item.disponible,
    Prestado: item.prestado,
  }));

  const actividadHoy = data.actividad_reciente.filter((item) => {
    const fecha = new Date(item.fecha);
    const hoy = new Date();
    return (
      fecha.getUTCFullYear() === hoy.getUTCFullYear() &&
      fecha.getUTCMonth() === hoy.getUTCMonth() &&
      fecha.getUTCDate() === hoy.getUTCDate()
    );
  });

  const actividadLista = (actividadHoy.length > 0 ? actividadHoy : data.actividad_reciente).slice(0, 8);

  return (
    <motion.div {...page} className="space-y-6">
      <PageHeader title="Dashboard de Ortopedia" breadcrumbs={["Ortopedia", "Dashboard"]} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Elementos registrados" value={data.metricas.elementos} description="Total de elementos ortopedicos." icon={Boxes} tone="violet" />
        <MetricCard label="Stock disponible" value={data.metricas.stock_disponible} description="Unidades disponibles para prestamo." icon={Package} tone="teal" />
        <MetricCard label="Elementos prestados" value={data.metricas.prestados} description="Prestamos en estado activo." icon={PackageCheck} tone="slate" />
        <MetricCard label="Prestamos vencidos" value={data.metricas.vencidos} description="Devolucion o renovacion pendiente." icon={AlertTriangle} tone="red" />
        <MetricCard label="Certificados por vencer" value={data.metricas.certificados_por_vencer} description="Vencen dentro de los proximos 30 dias." icon={CalendarClock} tone="amber" />
        <MetricCard label="Renovaciones pendientes" value={data.metricas.renovaciones} description="Prestamos vencidos que requieren accion." icon={RefreshCw} tone="orange" />
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          { href: "/ortopedia/asignacion", label: "Nueva asignacion", icon: ClipboardPlus },
          { href: "/ortopedia/prestamos", label: "Registrar devolucion", icon: PackageCheck },
          { href: "/ortopedia/prestamos", label: "Renovar prestamo", icon: RefreshCw },
          { href: "/ortopedia/asignacion", label: "Buscar socio", icon: Search },
          { href: "/ortopedia/gestion", label: "Buscar elemento", icon: Boxes },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <Button variant="outline" className="h-11 rounded-2xl">
                <Icon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <motion.div {...item}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle>Prestamos por mes</CardTitle>
              <CardDescription>Ultimos 12 meses.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.graficos.prestamos_mes.length === 0 ? (
                <EmptyState message="Sin prestamos registrados en el periodo." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.graficos.prestamos_mes}>
                      <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={34} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...item}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle>Elementos mas prestados</CardTitle>
              <CardDescription>Top 10 historico.</CardDescription>
            </CardHeader>
            <CardContent>
              {topElementosChart.length === 0 ? (
                <EmptyState message="Sin datos de prestamos." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topElementosChart} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                      <CartesianGrid horizontal={false} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="corto" axisLine={false} tickLine={false} width={120} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="var(--chart-3)" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <motion.div {...item}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle>Estado de prestamos</CardTitle>
              <CardDescription>Distribucion actual del parque de prestamos.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {data.graficos.estado_prestamos.length === 0 ? (
                <EmptyState message="Sin prestamos para graficar." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Pie data={data.graficos.estado_prestamos} dataKey="total" nameKey="estado" innerRadius={55} outerRadius={100} paddingAngle={3}>
                      {data.graficos.estado_prestamos.map((entry, index) => (
                        <Cell key={entry.estado} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...item}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle>Stock por elemento</CardTitle>
              <CardDescription>Total, disponible y prestado.</CardDescription>
            </CardHeader>
            <CardContent>
              {stockChart.length === 0 ? (
                <EmptyState message="No hay elementos registrados." />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockChart}>
                      <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
                      <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={34} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Disponible" stackId="stock" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Prestado" stackId="stock" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Ultimos movimientos del modulo de ortopedia.</CardDescription>
          </CardHeader>
          <CardContent>
            {actividadLista.length === 0 ? (
              <EmptyState message="Todavia no hay actividad registrada." />
            ) : (
              <div className="space-y-3">
                <Badge variant="outline" className="rounded-full">
                  {actividadHoy.length > 0 ? "Hoy" : "Reciente"}
                </Badge>
                {actividadLista.map((item) => {
                  const Icon = actividadIcon(item.tipo);
                  return (
                    <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.mensaje}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.fecha).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle>Alertas prioritarias</CardTitle>
            <CardDescription>Resumen de lo que requiere atencion inmediata.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.alertas.length === 0 ? (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-6 text-sm text-emerald-800 dark:text-emerald-100">
                No hay alertas activas.
              </div>
            ) : (
              <div className="space-y-3">
                {data.alertas.slice(0, 6).map((alerta) => (
                  <Link
                    key={alerta.id}
                    href={alerta.href}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{alerta.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{alerta.mensaje}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </motion.div>
  );
}

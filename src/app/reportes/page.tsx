"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
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

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

type ReportesResponse = {
  success: boolean;
  data?: {
    anio: number;
    indicadores: {
      prestaciones_totales_mes: number;
      socios_que_usaron_pfc: number;
      promedio_uso_por_socio: number;
      turnos_totales_anio: number;
      prestaciones_distintas: number;
    };
    prestaciones_uso: Array<{ nombre: string; sesiones: number }>;
    consumo_socios: Array<{ socio: string; sesiones: number }>;
    top_profesionales: Array<{ nombre: string; sesiones: number }>;
    estados_turnos: Array<{ estado: string; total: number }>;
    uso_mensual: Array<{ mes: number; atendidos: number; total: number }>;
    estadisticas: Array<{
      prestacion: string;
      sesiones: number;
      promedioMensual: string;
      estado: string;
    }>;
  };
  error?: string;
};

export default function ReportesPage() {
  const { role } = useUser();
  const anioActual = new Date().getFullYear();
  const [anioSeleccionado, setAnioSeleccionado] = useState(anioActual);
  const [searchPrestacion, setSearchPrestacion] = useState("");
  const [searchSocio, setSearchSocio] = useState("");
  const [topLimit, setTopLimit] = useState(10);
  const [reportes, setReportes] = useState<NonNullable<ReportesResponse["data"]> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReportes() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/reportes?anio=${anioSeleccionado}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as ReportesResponse;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "No se pudieron cargar reportes");
        }
        setReportes(data.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "No se pudieron cargar reportes");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReportes();
  }, [anioSeleccionado]);

  if (!canAccessModule(role, "reportes")) {
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
    return <Loading label="Cargando reportes del sistema..." />;
  }

  if (error) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Error al cargar reportes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!reportes) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Sin datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No se recibieron datos de reportes.</p>
        </CardContent>
      </Card>
    );
  }

  const aniosDisponibles = Array.from({ length: 5 }, (_, index) => anioActual - index);

  const termPrestacion = searchPrestacion.trim().toLowerCase();
  const prestacionesBase = reportes.prestaciones_uso
    .filter((item) => item.sesiones > 0)
    .sort((a, b) => b.sesiones - a.sesiones);
  const prestacionesFiltradas = (!termPrestacion
    ? prestacionesBase
    : prestacionesBase.filter((item) => item.nombre.toLowerCase().includes(termPrestacion))
  ).slice(0, topLimit);

  const termSocio = searchSocio.trim().toLowerCase();
  const sociosBase = reportes.consumo_socios
    .filter((item) => item.sesiones > 0)
    .sort((a, b) => b.sesiones - a.sesiones);
  const sociosFiltrados = (!termSocio
    ? sociosBase
    : sociosBase.filter((item) => item.socio.toLowerCase().includes(termSocio))
  ).slice(0, topLimit);

  const profesionalesTop = reportes.top_profesionales.filter((item) => item.sesiones > 0).slice(0, 8);

  const monthlyMap = new Map<number, { atendidos: number; total: number }>();
  for (const row of reportes.uso_mensual) {
    monthlyMap.set(Number(row.mes), {
      atendidos: Number(row.atendidos),
      total: Number(row.total),
    });
  }
  const usoMensual = MONTH_LABELS.map((label, idx) => {
    const month = idx + 1;
    const current = monthlyMap.get(month) ?? { atendidos: 0, total: 0 };
    return {
      mes: label,
      atendidos: current.atendidos,
      total: current.total,
    };
  });

  const estadosMapped = reportes.estados_turnos.map((item) => ({
    ...item,
    estado: item.estado.toUpperCase(),
  }));
  const estadosTotal = estadosMapped.reduce((acc, item) => acc + item.total, 0);
  const estadosTurnos = estadosMapped.map((item) => ({
    ...item,
    porcentaje: estadosTotal > 0 ? (item.total / estadosTotal) * 100 : 0,
  }));

  const totalSesiones = reportes.indicadores.prestaciones_totales_mes;
  const totalSocios = reportes.indicadores.socios_que_usaron_pfc;
  const totalTurnos = reportes.indicadores.turnos_totales_anio;
  const topPrestacion = reportes.prestaciones_uso[0];
  const topSocio = reportes.consumo_socios[0];
  const topProfesional = reportes.top_profesionales[0];
  const promedioMensualAtendido = totalSesiones / 12;
  const tasaAtendidosVsTotal = totalTurnos > 0 ? (totalSesiones / totalTurnos) * 100 : 0;

  return (
    <div className="module-shell space-y-6">
      <PageHeader
        title="Reportes del sistema"
        breadcrumbs={["Analitica PFC"]}
        rightSlot={
          <>
            <div className="grid gap-1">
              <span className="field-help">Año analizado</span>
              <select
                value={anioSeleccionado}
                onChange={(event) => setAnioSeleccionado(Number(event.target.value))}
                className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                {aniosDisponibles.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              className="self-end"
              onClick={() => {
                setSearchPrestacion("");
                setSearchSocio("");
                setTopLimit(10);
              }}
            >
              Reset filtros
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Vista ejecutiva del uso real del plan PFC en {reportes.anio}. Incluye volumen total, perfiles de consumo,
            distribución por estado, tendencia mensual y ranking de prestaciones/profesionales/socios para facilitar decisiones.
          </p>
        </CardContent>
      </Card>

      <div className="stat-grid">
        {[
          { label: "Turnos totales", value: formatNumber(totalTurnos), help: "Todos los estados del año" },
          { label: "Atendidos", value: formatNumber(totalSesiones), help: `${tasaAtendidosVsTotal.toFixed(1)}% del total` },
          { label: "Socios con uso", value: formatNumber(totalSocios), help: "Con al menos una atención" },
          { label: "Promedio por socio", value: reportes.indicadores.promedio_uso_por_socio.toFixed(1), help: "Atenciones / socio" },
          { label: "Prestaciones activas", value: formatNumber(reportes.indicadores.prestaciones_distintas), help: "Con actividad en el año" },
          { label: "Promedio mensual", value: promedioMensualAtendido.toFixed(1), help: "Atendidos por mes" },
          {
            label: "Prestación líder",
            value: topPrestacion ? topPrestacion.nombre : "-",
            help: topPrestacion ? `${formatNumber(topPrestacion.sesiones)} sesiones` : "Sin datos",
          },
          {
            label: "Profesional líder",
            value: topProfesional ? topProfesional.nombre : "-",
            help: topProfesional ? `${formatNumber(topProfesional.sesiones)} atenciones` : "Sin datos",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.help}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia mensual ({reportes.anio})</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {usoMensual.some((item) => item.total > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usoMensual} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Turnos totales" stroke="#3b82f6" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="atendidos" name="Atendidos" stroke="#10b981" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No hay datos para graficar." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por estado de turnos</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {estadosTurnos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={estadosTurnos}
                    dataKey="total"
                    nameKey="estado"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {estadosTurnos.map((entry, index) => (
                      <Cell
                        key={`${entry.estado}-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No hay datos para graficar." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Prestaciones más utilizadas</CardTitle>
            <Input
              placeholder="Filtrar prestación..."
              value={searchPrestacion}
              onChange={(event) => setSearchPrestacion(event.target.value)}
            />
          </CardHeader>
          <CardContent className="h-80">
            {prestacionesFiltradas.length === 0 ? (
              <EmptyState message="No hay prestaciones con ese filtro." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prestacionesFiltradas} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="sesiones" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Socios con mayor consumo</CardTitle>
            <Input
              placeholder="Filtrar socio..."
              value={searchSocio}
              onChange={(event) => setSearchSocio(event.target.value)}
            />
          </CardHeader>
          <CardContent className="h-80">
            {sociosFiltrados.length === 0 ? (
              <EmptyState message="No hay socios con ese filtro." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sociosFiltrados} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="socio" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="sesiones" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Detalle de prestaciones</CardTitle>
            <div className="grid gap-1">
              <span className="field-help">Top filas</span>
              <select
                className="h-9 rounded-lg border border-border bg-input px-2 text-sm"
                value={topLimit}
                onChange={(event) => setTopLimit(Number(event.target.value))}
              >
                {[5, 10, 15, 20].map((limit) => (
                  <option key={limit} value={limit}>
                    {limit}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {reportes.estadisticas.length === 0 ? (
              <EmptyState message="Sin estadísticas de prestaciones para este año." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestación</TableHead>
                    <TableHead>Sesiones</TableHead>
                    <TableHead>% sobre atendidos</TableHead>
                    <TableHead>Promedio mensual</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportes.estadisticas.slice(0, topLimit).map((item) => (
                    <TableRow key={item.prestacion}>
                      <TableCell>{item.prestacion}</TableCell>
                      <TableCell>{formatNumber(item.sesiones)}</TableCell>
                      <TableCell>{totalSesiones > 0 ? `${((item.sesiones / totalSesiones) * 100).toFixed(1)}%` : "0%"}</TableCell>
                      <TableCell>{item.promedioMensual}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500 text-white">{item.estado}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top profesionales y alertas analíticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profesionalesTop.length === 0 ? (
              <EmptyState message="Sin actividad de profesionales para este año." />
            ) : (
              <div className="space-y-2">
                {profesionalesTop.map((item, idx) => (
                  <div key={item.nombre} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                    <p className="text-sm text-foreground">
                      {idx + 1}. {item.nombre}
                    </p>
                    <Badge variant="outline">{formatNumber(item.sesiones)} sesiones</Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">Insights automáticos</p>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <li>- Mayor prestación: {topPrestacion ? `${topPrestacion.nombre} (${formatNumber(topPrestacion.sesiones)})` : "sin datos"}.</li>
                <li>- Socio con mayor consumo: {topSocio ? `${topSocio.socio} (${formatNumber(topSocio.sesiones)} sesiones)` : "sin datos"}.</li>
                <li>- Tasa de atención cerrada: {tasaAtendidosVsTotal.toFixed(1)}% sobre total de turnos del año.</li>
                <li>- Prestaciones activas reportadas: {formatNumber(reportes.indicadores.prestaciones_distintas)}.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado de turnos ({reportes.anio})</CardTitle>
        </CardHeader>
        <CardContent>
          {estadosTurnos.length === 0 ? (
            <EmptyState message="Sin distribución por estados para este año." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Participación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadosTurnos.map((item) => (
                  <TableRow key={item.estado}>
                    <TableCell>{item.estado}</TableCell>
                    <TableCell>{formatNumber(item.total)}</TableCell>
                    <TableCell>{item.porcentaje.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

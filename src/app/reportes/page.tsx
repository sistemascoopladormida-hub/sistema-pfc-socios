"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessModule, useUser } from "@/lib/user-context";

const PIE_COLORS = ["#138A3D", "#3A5DAE", "#F1872D", "#6C4AA1"];

type ReportesResponse = {
  success: boolean;
  data?: {
    indicadores: {
      prestaciones_totales_mes: number;
      socios_que_usaron_pfc: number;
      promedio_uso_por_socio: number;
    };
    prestaciones_uso: Array<{ nombre: string; sesiones: number }>;
    consumo_socios: Array<{ socio: string; sesiones: number }>;
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
  const [reportes, setReportes] = useState<NonNullable<ReportesResponse["data"]> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReportes() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/reportes", {
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
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Reportes del Sistema PFC</h2>
        <p className="text-sm text-slate-600">
          Panel de analisis de uso del plan para seguimiento directivo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Prestaciones totales del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {reportes.indicadores.prestaciones_totales_mes}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">
              Socios que utilizaron el PFC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {reportes.indicadores.socios_que_usaron_pfc}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Promedio de uso por socio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {reportes.indicadores.promedio_uso_por_socio}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Prestaciones mas utilizadas</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {reportes.prestaciones_uso.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportes.prestaciones_uso} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="sesiones" fill="#138A3D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No hay datos para graficar." />
            )}
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Consumo de prestaciones por socio</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {reportes.consumo_socios.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={reportes.consumo_socios}
                    dataKey="sesiones"
                    nameKey="socio"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {reportes.consumo_socios.map((entry, index) => (
                      <Cell
                        key={`${entry.socio}-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No hay datos para graficar." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Estadisticas generales</CardTitle>
        </CardHeader>
        <CardContent>
          {reportes.estadisticas.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestacion</TableHead>
                  <TableHead>Sesiones utilizadas</TableHead>
                  <TableHead>Promedio mensual</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportes.estadisticas.map((item) => (
                  <TableRow key={item.prestacion}>
                    <TableCell>{item.prestacion}</TableCell>
                    <TableCell>{item.sesiones}</TableCell>
                    <TableCell>{item.promedioMensual}</TableCell>
                    <TableCell>
                      <Badge className="bg-coopGreen text-white">{item.estado}</Badge>
                    </TableCell>
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

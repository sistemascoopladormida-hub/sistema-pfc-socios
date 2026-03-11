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
import { consumoSocios, prestacionesUso } from "@/data/reportes";

const PIE_COLORS = ["#138A3D", "#3A5DAE", "#F1872D", "#6C4AA1"];

const estadisticasGenerales = [
  { prestacion: "Fisioterapia", sesiones: 32, promedioMensual: "8 / semana", estado: "Activo" },
  { prestacion: "Psicologia", sesiones: 21, promedioMensual: "5 / semana", estado: "Activo" },
  { prestacion: "Nutricion", sesiones: 14, promedioMensual: "3 / semana", estado: "Activo" },
  { prestacion: "Ginecologia", sesiones: 9, promedioMensual: "2 / semana", estado: "Activo" },
];

export default function ReportesPage() {
  const { role } = useUser();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const prestacionesTotalesMes = prestacionesUso.reduce((acc, item) => acc + item.sesiones, 0);
  const sociosQueUsaronPfc = consumoSocios.length;
  const promedioUsoSocio = (prestacionesTotalesMes / sociosQueUsaronPfc).toFixed(1);

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
            <p className="text-3xl font-bold text-slate-900">{prestacionesTotalesMes}</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">
              Socios que utilizaron el PFC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{sociosQueUsaronPfc}</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">Promedio de uso por socio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{promedioUsoSocio}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Prestaciones mas utilizadas</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {mounted && prestacionesUso.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prestacionesUso} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
            {mounted && consumoSocios.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={consumoSocios}
                    dataKey="sesiones"
                    nameKey="socio"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {consumoSocios.map((entry, index) => (
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
          {estadisticasGenerales.length === 0 ? (
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
                {estadisticasGenerales.map((item) => (
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

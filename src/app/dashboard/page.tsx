"use client";

import { useEffect, useState } from "react";
import { Calendar, HeartPulse, Stethoscope, Users } from "lucide-react";

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
import { dashboardStats } from "@/data/dashboard";
import { type EstadoTurno, turnos } from "@/data/turnos";
import { canAccessModule, useUser } from "@/lib/user-context";

const actividadReciente = [
  "Juan Perez asistio a fisioterapia.",
  "Maria Gomez solicito turno.",
  "Carlos Rodriguez no asistio a consulta.",
  "Recepcion asigno nuevo turno con psicologia.",
  "Se confirmo atencion en control diabetologico.",
];

const prestacionesTop = [
  { nombre: "Fisioterapia", cantidad: 32, unidad: "sesiones" },
  { nombre: "Psicologia", cantidad: 21, unidad: "sesiones" },
  { nombre: "Nutricion", cantidad: 14, unidad: "sesiones" },
  { nombre: "Ginecologia", cantidad: 9, unidad: "consultas" },
];

const estadoBadgeClass: Record<EstadoTurno, string> = {
  Programado: "bg-coopBlue text-white",
  Atendido: "bg-coopGreen text-white",
  "No asistio": "bg-red-600 text-white",
  Cancelado: "bg-slate-500 text-white",
};

const estadoLabel: Record<EstadoTurno, string> = {
  Programado: "Programado",
  Atendido: "Atendido",
  "No asistio": "No asistio",
  Cancelado: "Cancelado",
};

export default function DashboardPage() {
  const { role } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const turnosRecientes = turnos.slice(0, 5);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
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
    return <Loading label="Cargando tablero gerencial..." />;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm">
        <CardContent className="flex items-center gap-4 py-8">
          <HeartPulse className="h-10 w-10 text-coopGreen" />
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-slate-900">
              Bienvenido al Sistema de Gestion PFC
            </h2>
            <p className="text-sm text-slate-600">
              Este sistema permite administrar turnos, prestaciones y beneficios del Plan de
              Financiamiento Colectivo de la cooperativa.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-sm text-slate-600">SOCIOS PFC ACTIVOS</CardTitle>
            <Users className="h-8 w-8 text-coopGreen" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{dashboardStats.sociosActivos}</p>
            <p className="text-xs text-slate-500">Socios con plan activo.</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-sm text-slate-600">TURNOS DEL DIA</CardTitle>
            <Calendar className="h-8 w-8 text-coopGreen" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{dashboardStats.turnosHoy}</p>
            <p className="text-xs text-slate-500">Turnos programados para hoy.</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-sm text-slate-600">PROFESIONALES ATENDIENDO</CardTitle>
            <Stethoscope className="h-8 w-8 text-coopGreen" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{dashboardStats.profesionalesHoy}</p>
            <p className="text-xs text-slate-500">Profesionales activos en agenda.</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-sm text-slate-600">PRESTACIONES DEL MES</CardTitle>
            <HeartPulse className="h-8 w-8 text-coopGreen" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{dashboardStats.prestacionesMes}</p>
            <p className="text-xs text-slate-500">Prestaciones realizadas en el mes.</p>
          </CardContent>
        </Card>
      </div>

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
            {prestacionesTop.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-3 text-sm text-slate-700">
                {prestacionesTop.map((item) => (
                  <li
                    key={item.nombre}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                  >
                    <span>{item.nombre}</span>
                    <span className="font-semibold">
                      {item.cantidad} {item.unidad}
                    </span>
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
          {turnosRecientes.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Prestacion</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnosRecientes.map((turno) => (
                  <TableRow key={turno.id}>
                    <TableCell>{turno.socio}</TableCell>
                    <TableCell>{turno.profesional}</TableCell>
                    <TableCell>{turno.prestacion}</TableCell>
                    <TableCell>
                      <Badge className={estadoBadgeClass[turno.estado]}>
                        {estadoLabel[turno.estado]}
                      </Badge>
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

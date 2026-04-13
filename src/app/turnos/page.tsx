"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarPlus2,
  ChevronRight,
  Eye,
  Search,
  Trash2,
} from "lucide-react";

import { TurnoDetalleModal } from "@/components/turnos/TurnoDetalleModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataBadge } from "@/components/ui/data-badge";
import { EmptyState } from "@/components/ui/empty-state";
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

type TurnoEstado = "RESERVADO" | "ATENDIDO" | "CANCELADO" | "AUSENTE";
type EstadoFilter = "TODOS" | TurnoEstado;
type EstadoOption = { value: TurnoEstado; disabled: boolean };

type TurnoRow = {
  id: number;
  nombre: string;
  fecha: string;
  hora: string;
  estado: TurnoEstado | string;
  cod_soc: number | string;
  adherente_codigo: number | string;
  profesional: string;
  prestacion: string;
};

export default function TurnosPage() {
  const { role } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [turnos, setTurnos] = useState<TurnoRow[]>([]);
  const [turnoDetalleId, setTurnoDetalleId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("TODOS");
  const [fechaFilter, setFechaFilter] = useState("");
  const [prestacionFilter, setPrestacionFilter] = useState("");
  const [profesionalFilter, setProfesionalFilter] = useState("");

  async function fetchTurnos() {
    const response = await fetch("/api/turnos", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: TurnoRow[]; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "No se pudieron cargar turnos");
    }
    setTurnos(data.data ?? []);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setIsLoading(true);
        await fetchTurnos();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar turnos");
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  function normalizeHora(raw: string) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return "";
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
    const match = trimmed.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return "";
    const [, hh, mm, ss] = match;
    return `${hh}:${mm}:${ss ?? "00"}`;
  }

  function toTurnoDateTime(turno: TurnoRow) {
    const fecha = String(turno.fecha).slice(0, 10);
    const hora = normalizeHora(String(turno.hora));
    if (!hora) return null;
    const parsed = new Date(`${fecha}T${hora}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function canMarkAsAtendido(turno: TurnoRow) {
    const estado = String(turno.estado).toUpperCase();
    if (estado !== "RESERVADO") return false;
    const turnoDate = toTurnoDateTime(turno);
    if (!turnoDate) return false;
    return turnoDate.getTime() <= Date.now();
  }

  function canMarkAsAusente(turno: TurnoRow) {
    return canMarkAsAtendido(turno);
  }

  function normalizeEstado(estado: string): TurnoEstado {
    const normalized = String(estado).toUpperCase();
    if (normalized === "ATENDIDO") return "ATENDIDO";
    if (normalized === "AUSENTE") return "AUSENTE";
    if (normalized === "CANCELADO") return "CANCELADO";
    return "RESERVADO";
  }

  function getEstadoOptions(turno: TurnoRow): EstadoOption[] {
    const estado = normalizeEstado(String(turno.estado));
    const puedeAtender = canMarkAsAtendido(turno);
    const puedeAusente = canMarkAsAusente(turno);

    if (estado === "ATENDIDO") {
      return [
        { value: "ATENDIDO", disabled: false },
        { value: "AUSENTE", disabled: true },
        { value: "CANCELADO", disabled: true },
      ];
    }
    if (estado === "CANCELADO") {
      return [
        { value: "CANCELADO", disabled: false },
        { value: "ATENDIDO", disabled: true },
        { value: "AUSENTE", disabled: true },
      ];
    }
    if (estado === "AUSENTE") {
      return [
        { value: "AUSENTE", disabled: false },
        { value: "CANCELADO", disabled: false },
        { value: "ATENDIDO", disabled: true },
      ];
    }

    return [
      { value: "RESERVADO", disabled: false },
      { value: "ATENDIDO", disabled: !puedeAtender },
      { value: "AUSENTE", disabled: !puedeAusente },
      { value: "CANCELADO", disabled: false },
    ];
  }

  function getEstadoKind(estado: string) {
    const normalized = String(estado).toUpperCase();
    if (normalized === "RESERVADO") return "reservado" as const;
    if (normalized === "ATENDIDO") return "atendido" as const;
    if (normalized === "AUSENTE") return "ausente" as const;
    return "cancelado" as const;
  }

  async function updateEstado(turnoId: number, action: "cancelar" | "atender" | "ausente") {
    const response = await fetch(`/api/turnos/${turnoId}/${action}`, {
      method: "PUT",
    });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo actualizar el estado");
      return;
    }

    toast.success(data.message ?? "Estado actualizado");
    await fetchTurnos();
  }

  async function onEstadoSelect(turno: TurnoRow, nextEstado: TurnoEstado) {
    const current = normalizeEstado(String(turno.estado));
    if (nextEstado === current) return;

    const actionMap: Record<Exclude<TurnoEstado, "RESERVADO">, "cancelar" | "atender" | "ausente"> = {
      ATENDIDO: "atender",
      AUSENTE: "ausente",
      CANCELADO: "cancelar",
    };

    const action = actionMap[nextEstado as Exclude<TurnoEstado, "RESERVADO">];
    if (!action) return;

    const confirmar = window.confirm(`¿Confirmar cambio de estado a ${nextEstado}?`);
    if (!confirmar) return;
    await updateEstado(turno.id, action);
  }

  async function eliminarTurno(turnoId: number) {
    const confirmar = window.confirm(
      "¿Deseas eliminar este turno? Esta acción eliminará también su historial asociado y no se puede deshacer."
    );
    if (!confirmar) return;

    const response = await fetch(`/api/turnos/${turnoId}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar el turno");
      return;
    }

    toast.success(data.message ?? "Turno eliminado");
    await fetchTurnos();
  }

  const resumen = useMemo(() => {
    return turnos.reduce(
      (acc, turno) => {
        const estado = String(turno.estado).toUpperCase();
        acc.total += 1;
        if (estado === "RESERVADO") acc.reservados += 1;
        if (estado === "ATENDIDO") acc.atendidos += 1;
        if (estado === "AUSENTE") acc.ausentes += 1;
        if (estado === "CANCELADO") acc.cancelados += 1;
        return acc;
      },
      {
        total: 0,
        reservados: 0,
        atendidos: 0,
        ausentes: 0,
        cancelados: 0,
      }
    );
  }, [turnos]);

  const prestacionesOpciones = useMemo(() => {
    const set = new Set<string>();
    for (const t of turnos) {
      const p = String(t.prestacion ?? "").trim();
      if (p) set.add(p);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [turnos]);

  const profesionalesOpciones = useMemo(() => {
    const set = new Set<string>();
    for (const t of turnos) {
      const p = String(t.profesional ?? "").trim();
      if (p) set.add(p);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [turnos]);

  const turnosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return turnos.filter((turno) => {
      const estado = String(turno.estado).toUpperCase();
      const fecha = String(turno.fecha).slice(0, 10);
      const searchable = [
        String(turno.id),
        String(turno.cod_soc),
        String(turno.adherente_codigo),
        String(turno.nombre ?? ""),
        String(turno.profesional ?? ""),
        String(turno.prestacion ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      const bySearch = !term || searchable.includes(term);
      const byEstado = estadoFilter === "TODOS" || estado === estadoFilter;
      const byFecha = !fechaFilter || fecha === fechaFilter;
      const byPrestacion =
        !prestacionFilter || String(turno.prestacion ?? "").trim() === prestacionFilter;
      const byProfesional =
        !profesionalFilter || String(turno.profesional ?? "").trim() === profesionalFilter;

      return bySearch && byEstado && byFecha && byPrestacion && byProfesional;
    });
  }, [turnos, searchTerm, estadoFilter, fechaFilter, prestacionFilter, profesionalFilter]);

  if (!canAccessModule(role, "turnos")) {
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
    return <Loading label="Cargando agenda de turnos..." />;
  }

  return (
    <div className="mx-auto space-y-6">
      <PageHeader
        title="Gestión de Turnos"
        breadcrumbs={["operación diaria"]}
        rightSlot={
          <Link href="/turnos/nuevo">
            <Button className="h-10 rounded-lg bg-[#0D6E5A] px-4 text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#0B5B4B]">
              <CalendarPlus2 className="mr-2 h-4 w-4" />
              Nuevo Turno
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-2xl font-semibold text-slate-900">{resumen.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Reservados</p>
            <p className="text-2xl font-semibold text-blue-700">{resumen.reservados}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Atendidos</p>
            <p className="text-2xl font-semibold text-emerald-700">{resumen.atendidos}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Ausentes</p>
            <p className="text-2xl font-semibold text-amber-700">{resumen.ausentes}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Cancelados</p>
            <p className="text-2xl font-semibold text-rose-700">{resumen.cancelados}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.08em] text-pfcText-muted">
              Turnos y acciones
            </CardTitle>
            <div className="flex flex-col gap-3 lg:flex-row">
              <label className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por paciente, socio, profesional o prestación..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-2"
                />
              </label>
              <div className="flex flex-1 flex-wrap gap-2">
                <select
                  value={estadoFilter}
                  onChange={(event) => setEstadoFilter(event.target.value as EstadoFilter)}
                  className="h-10 min-w-[160px] rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-2"
                >
                  <option value="TODOS">Todos los estados</option>
                  <option value="RESERVADO">Reservado</option>
                  <option value="ATENDIDO">Atendido</option>
                  <option value="AUSENTE">Ausente</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
                <select
                  value={prestacionFilter}
                  onChange={(event) => setPrestacionFilter(event.target.value)}
                  className="h-10 min-w-[200px] max-w-[min(100%,280px)] rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-2"
                  title="Filtrar por prestación"
                >
                  <option value="">Todas las prestaciones</option>
                  {prestacionesOpciones.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={profesionalFilter}
                  onChange={(event) => setProfesionalFilter(event.target.value)}
                  className="h-10 min-w-[200px] max-w-[min(100%,280px)] rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-2"
                  title="Filtrar por profesional"
                >
                  <option value="">Todos los profesionales</option>
                  {profesionalesOpciones.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={fechaFilter}
                  onChange={(event) => setFechaFilter(event.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-2"
                />
                {(searchTerm ||
                  estadoFilter !== "TODOS" ||
                  fechaFilter ||
                  prestacionFilter ||
                  profesionalFilter) && (
                  <Button
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      setSearchTerm("");
                      setEstadoFilter("TODOS");
                      setFechaFilter("");
                      setPrestacionFilter("");
                      setProfesionalFilter("");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Mostrando {turnosFiltrados.length} de {turnos.length} turnos.
            </p>
          </div>
        </CardHeader>
        <CardContent>
        {turnosFiltrados.length === 0 ? (
          <EmptyState
            title={turnos.length === 0 ? "Sin turnos para mostrar" : "No hay resultados con esos filtros"}
            message={
              turnos.length === 0
                ? "Todavía no hay turnos cargados en esta vista. Puedes crear uno nuevo para comenzar."
                : "Prueba cambiar los filtros o limpiar la búsqueda para ver más resultados."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Adherente</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Prestacion</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnosFiltrados.map((turno, idx) => (
                <motion.tr
                  key={turno.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  className="border-b"
                >
                  <TableCell>{turno.id}</TableCell>
                  <TableCell>{turno.cod_soc}</TableCell>
                  <TableCell>{turno.adherente_codigo}</TableCell>
                  <TableCell>{turno.nombre || "No registrado"}</TableCell>
                  <TableCell>{turno.profesional}</TableCell>
                  <TableCell>{turno.prestacion}</TableCell>

                  <TableCell>
                    {new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}
                  </TableCell>

                  <TableCell>{normalizeHora(String(turno.hora)).slice(0, 5) || "No registrada"}</TableCell>

                  <TableCell>
                    <div className="flex min-w-[190px] items-center gap-2">
                      <select
                        value={normalizeEstado(String(turno.estado))}
                        onChange={(event) => onEstadoSelect(turno, event.target.value as TurnoEstado)}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium outline-none ring-teal-600/20 transition focus:border-teal-600 focus:ring-2"
                      >
                        {getEstadoOptions(turno).map((option) => (
                          <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      <DataBadge kind={getEstadoKind(String(turno.estado))}>{String(turno.estado)}</DataBadge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5"
                        onClick={() => setTurnoDetalleId(turno.id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Detalle
                      </Button>
                      {role === "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-rose-200 px-2.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          onClick={() => eliminarTurno(turno.id)}
                        >
                          <Trash2 className="" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
      </Card>

      <TurnoDetalleModal
        isOpen={turnoDetalleId !== null}
        turnoId={turnoDetalleId}
        onClose={() => setTurnoDetalleId(null)}
        onSaved={() => {
          fetchTurnos().catch(() => {
            toast.error("No se pudo refrescar la lista de turnos");
          });
        }}
      />
    </div>
  );
}

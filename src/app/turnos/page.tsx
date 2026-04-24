"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus2, Eye, Search, Trash2 } from "lucide-react";

import { TurnoDetalleModal } from "@/components/turnos/TurnoDetalleModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function TurnosPage() {
  const { role } = useUser();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [turnos, setTurnos] = useState<TurnoRow[]>([]);
  const [turnoDetalleId, setTurnoDetalleId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("TODOS");
  const [fechaFilter, setFechaFilter] = useState("");
  const [prestacionFilter, setPrestacionFilter] = useState("");
  const [profesionalFilter, setProfesionalFilter] = useState("");
  const [onlyOverdueReservados, setOnlyOverdueReservados] = useState(false);

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

  useEffect(() => {
    const estadoParam = String(searchParams.get("estado") ?? "").toUpperCase();
    const alertaParam = String(searchParams.get("alerta") ?? "").toLowerCase();
    if (estadoParam === "RESERVADO" || estadoParam === "ATENDIDO" || estadoParam === "AUSENTE" || estadoParam === "CANCELADO") {
      setEstadoFilter(estadoParam as EstadoFilter);
    }
    if (alertaParam === "vencidos") {
      setEstadoFilter("RESERVADO");
      setOnlyOverdueReservados(true);
    }
  }, [searchParams]);

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

  function normalizeEstado(estado: string): TurnoEstado {
    const normalized = String(estado).toUpperCase();
    if (normalized === "ATENDIDO") return "ATENDIDO";
    if (normalized === "AUSENTE") return "AUSENTE";
    if (normalized === "CANCELADO") return "CANCELADO";
    return "RESERVADO";
  }

  function getEstadoOptions(turno: TurnoRow): EstadoOption[] {
    const estado = normalizeEstado(String(turno.estado));
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
      { value: "ATENDIDO", disabled: !canMarkAsAtendido(turno) },
      { value: "AUSENTE", disabled: !canMarkAsAtendido(turno) },
      { value: "CANCELADO", disabled: false },
    ];
  }

  function getEstadoSelectClass(turno: TurnoRow) {
    const estado = normalizeEstado(String(turno.estado));
    if (estado === "ATENDIDO") {
      return "border-emerald-300/40 bg-emerald-400/10 text-emerald-800 dark:text-emerald-200";
    }
    if (estado === "AUSENTE") {
      return "border-rose-300/40 bg-rose-400/10 text-rose-800 dark:text-rose-200";
    }
    if (estado === "CANCELADO") {
      return "border-slate-300/40 bg-slate-400/10 text-slate-700 dark:text-slate-200";
    }
    return "border-amber-300/40 bg-amber-400/10 text-amber-800 dark:text-amber-200";
  }

  async function updateEstado(turnoId: number, action: "cancelar" | "atender" | "ausente") {
    const response = await fetch(`/api/turnos/${turnoId}/${action}`, { method: "PUT" });
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

    if (!window.confirm(`Confirmar cambio de estado a ${nextEstado}?`)) return;
    await updateEstado(turno.id, action);
  }

  async function eliminarTurno(turnoId: number) {
    const confirmar = window.confirm(
      "Deseas eliminar este turno? Esta accion eliminara tambien su historial asociado."
    );
    if (!confirmar) return;

    const response = await fetch(`/api/turnos/${turnoId}`, { method: "DELETE" });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar el turno");
      return;
    }

    toast.success(data.message ?? "Turno eliminado");
    await fetchTurnos();
  }

  const resumen = useMemo(
    () =>
      turnos.reduce(
        (acc, turno) => {
          const estado = String(turno.estado).toUpperCase();
          acc.total += 1;
          if (estado === "RESERVADO") acc.reservados += 1;
          if (estado === "ATENDIDO") acc.atendidos += 1;
          if (estado === "AUSENTE") acc.ausentes += 1;
          if (estado === "CANCELADO") acc.cancelados += 1;
          return acc;
        },
        { total: 0, reservados: 0, atendidos: 0, ausentes: 0, cancelados: 0 }
      ),
    [turnos]
  );

  const prestacionesOpciones = useMemo(() => {
    const set = new Set<string>();
    for (const t of turnos) {
      const value = String(t.prestacion ?? "").trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [turnos]);

  const profesionalesOpciones = useMemo(() => {
    const set = new Set<string>();
    for (const t of turnos) {
      const value = String(t.profesional ?? "").trim();
      if (value) set.add(value);
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
      const byPrestacion = !prestacionFilter || String(turno.prestacion ?? "").trim() === prestacionFilter;
      const byProfesional = !profesionalFilter || String(turno.profesional ?? "").trim() === profesionalFilter;
      const byVencidos = !onlyOverdueReservados || (estado === "RESERVADO" && canMarkAsAtendido(turno));

      return bySearch && byEstado && byFecha && byPrestacion && byProfesional && byVencidos;
    });
  }, [turnos, searchTerm, estadoFilter, fechaFilter, prestacionFilter, profesionalFilter, onlyOverdueReservados]);

  if (!canAccessModule(role, "turnos")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No tienes permisos para acceder a este modulo.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Loading label="Cargando agenda de turnos..." />;
  }

  return (
    <div className="module-shell space-y-6">
      <PageHeader
        title="Gestion de turnos"
        breadcrumbs={["Operacion diaria"]}
        rightSlot={
          <Link href="/turnos/nuevo">
            <Button className="h-11 px-4">
              <CalendarPlus2 className="mr-2 h-4 w-4" />
              Nuevo turno
            </Button>
          </Link>
        }
      />

      <div className="stat-grid">
        {[
          { label: "Total", value: resumen.total },
          { label: "Reservados", value: resumen.reservados },
          { label: "Atendidos", value: resumen.atendidos },
          { label: "Ausentes", value: resumen.ausentes },
          { label: "Cancelados", value: resumen.cancelados },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="py-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Buscar y filtrar</CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Usa filtros rápidos para encontrar turnos sin ocupar tanto espacio de pantalla.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <label className="grid min-w-0 gap-1 lg:col-span-3 2xl:col-span-2">
              <span className="field-label">Buscar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Paciente, socio, profesional o prestacion"
                  className="h-10 w-full rounded-xl border border-border bg-input px-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="field-label">Estado</span>
              <select
                value={estadoFilter}
                onChange={(event) => setEstadoFilter(event.target.value as EstadoFilter)}
                className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="TODOS">Todos</option>
                <option value="RESERVADO">Reservado</option>
                <option value="ATENDIDO">Atendido</option>
                <option value="AUSENTE">Ausente</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="field-label">Prestacion</span>
              <select
                value={prestacionFilter}
                onChange={(event) => setPrestacionFilter(event.target.value)}
                className="h-10 w-[98%] rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Todas</option>
                {prestacionesOpciones.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="field-label">Profesional</span>
              <select
                value={profesionalFilter}
                onChange={(event) => setProfesionalFilter(event.target.value)}
                className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {profesionalesOpciones.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="field-label">Fecha</span>
              <input
                type="date"
                value={fechaFilter}
                onChange={(event) => setFechaFilter(event.target.value)}
                className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mostrando {turnosFiltrados.length} de {turnos.length} turnos.
            </p>
            {(searchTerm || estadoFilter !== "TODOS" || fechaFilter || prestacionFilter || profesionalFilter || onlyOverdueReservados) ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setEstadoFilter("TODOS");
                  setFechaFilter("");
                  setPrestacionFilter("");
                  setProfesionalFilter("");
                  setOnlyOverdueReservados(false);
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
          {onlyOverdueReservados ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Filtro activo: solo turnos reservados con fecha/hora vencida.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado de turnos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {turnosFiltrados.length === 0 ? (
            <EmptyState
              title={turnos.length === 0 ? "Sin turnos para mostrar" : "No hay resultados"}
              message={
                turnos.length === 0
                  ? "Todavia no hay turnos cargados."
                  : "Prueba cambiar los filtros o limpiar la busqueda."
              }
            />
          ) : (
            <>
              <div className="hidden min-[1700px]:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Socio</TableHead>
                      <TableHead>Atencion</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead className="w-[180px]">Estado</TableHead>
                      <TableHead className="w-[120px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {turnosFiltrados.map((turno) => (
                      <TableRow key={turno.id}>
                        <TableCell className="font-medium text-foreground">{turno.nombre || "No registrado"}</TableCell>
                        <TableCell>{turno.cod_soc}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{turno.profesional}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{turno.prestacion}</p>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</TableCell>
                        <TableCell>{normalizeHora(String(turno.hora)).slice(0, 5) || "No registrada"}</TableCell>
                        <TableCell className="align-top">
                          <select
                            value={normalizeEstado(String(turno.estado))}
                            onChange={(event) => onEstadoSelect(turno, event.target.value as TurnoEstado)}
                            className={`h-9 w-full rounded-lg border px-2 text-sm font-medium outline-none ${getEstadoSelectClass(turno)}`}
                          >
                            {getEstadoOptions(turno).map((option) => (
                              <option key={option.value} value={option.value} disabled={option.disabled}>
                                {option.value}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => setTurnoDetalleId(turno.id)}
                              aria-label="Ver detalle"
                              title="Ver detalle"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {role === "admin" ? (
                              <Button
                                size="icon-sm"
                                variant="destructive"
                                onClick={() => eliminarTurno(turno.id)}
                                aria-label="Eliminar turno"
                                title="Eliminar turno"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 min-[1700px]:hidden">
                {turnosFiltrados.map((turno) => (
                  <div key={turno.id} className="data-card space-y-2">
                    <div className="grid gap-2 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{turno.nombre || "No registrado"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Socio {turno.cod_soc} · Adherente {turno.adherente_codigo}
                          </p>
                        </div>
                        <p className="text-sm text-foreground">
                          {turno.profesional} - <span className="text-slate-500 dark:text-slate-400">{turno.prestacion}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} ·{" "}
                          {normalizeHora(String(turno.hora)).slice(0, 5) || "No registrada"}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <label className="grid gap-1">
                          <span className="field-help">Estado</span>
                          <select
                            value={normalizeEstado(String(turno.estado))}
                            onChange={(event) => onEstadoSelect(turno, event.target.value as TurnoEstado)}
                            className={`h-10 rounded-xl border px-3 text-sm font-medium outline-none ${getEstadoSelectClass(turno)}`}
                          >
                            {getEstadoOptions(turno).map((option) => (
                              <option key={option.value} value={option.value} disabled={option.disabled}>
                                {option.value}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-2 px-3"
                            onClick={() => setTurnoDetalleId(turno.id)}
                            aria-label="Ver detalle"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="text-xs font-medium">Ver detalle</span>
                          </Button>
                          {role === "admin" ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-9 gap-2 px-3"
                              onClick={() => eliminarTurno(turno.id)}
                              aria-label="Eliminar turno"
                              title="Eliminar turno"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="text-xs font-medium">Eliminar turno</span>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </>
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

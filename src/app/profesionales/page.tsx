"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileDown, Pencil, Plus, Printer, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canAccessModule, useUser } from "@/lib/user-context";
import { buildA4TablePdf, downloadPdf, printPdf } from "@/lib/pdf-export";
import { ROLES } from "@/lib/roles";

type ProfesionalApi = {
  id: number;
  nombre: string;
  especialidad_id: number;
  especialidad: string;
  pacientes_mensuales: number | null;
  turnos_mes: number | null;
  cupo_restante: number | null;
  duracion_turno: number | null;
  activo: boolean | number;
};

type EspecialidadApi = {
  id: number;
  nombre: string;
};

type FormState = {
  nombre: string;
  especialidad_id: string;
  duracion_turno: string;
  pacientes_mensuales: string;
};

type TurnoMesRow = {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  paciente: string;
  cod_soc: number | string;
  adherente_codigo: number | string;
  prestacion: string;
};

const emptyForm: FormState = {
  nombre: "",
  especialidad_id: "",
  duracion_turno: "",
  pacientes_mensuales: "",
};

export default function ProfesionalesPage() {
  const { role } = useUser();
  const canManageCrud = role === ROLES.DEVELOPER;
  const [profesionales, setProfesionales] = useState<ProfesionalApi[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingProfesional, setEditingProfesional] = useState<ProfesionalApi | null>(null);
  const [mesTurnosOpen, setMesTurnosOpen] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState<ProfesionalApi | null>(null);
  const [mesFilter, setMesFilter] = useState(() => new Date().getMonth() + 1);
  const [turnosDelMes, setTurnosDelMes] = useState<TurnoMesRow[]>([]);
  const [loadingTurnosMes, setLoadingTurnosMes] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        await Promise.all([fetchProfesionales(), fetchEspecialidades()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function fetchProfesionales() {
    const response = await fetch("/api/profesionales", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: ProfesionalApi[]; error?: string };
    if (!response.ok || !data.success) throw new Error(data.error ?? "No se pudieron cargar profesionales");
    setProfesionales(data.data ?? []);
  }

  async function fetchEspecialidades() {
    const response = await fetch("/api/especialidades", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: EspecialidadApi[]; error?: string };
    if (!response.ok || !data.success) throw new Error(data.error ?? "No se pudieron cargar especialidades");
    setEspecialidades(data.data ?? []);
  }

  function openCreateModal() {
    setEditingProfesional(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEditModal(item: ProfesionalApi) {
    setEditingProfesional(item);
    setForm({
      nombre: item.nombre,
      especialidad_id: String(item.especialidad_id),
      duracion_turno: String(item.duracion_turno ?? ""),
      pacientes_mensuales: String(item.pacientes_mensuales ?? ""),
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!canManageCrud) {
      toast.error("Solo el rol Desarrollador puede gestionar profesionales");
      return;
    }
    const nombre = form.nombre.trim();
    const especialidadId = Number(form.especialidad_id);
    const duracionTurno = Number(form.duracion_turno);
    const pacientesMensuales = Number(form.pacientes_mensuales || 0);

    if (!nombre || !Number.isInteger(especialidadId) || especialidadId <= 0) {
      toast.error("Completa nombre y especialidad");
      return;
    }
    if (!Number.isInteger(duracionTurno) || duracionTurno <= 0) {
      toast.error("La duracion del turno debe ser un numero valido");
      return;
    }

    const method = editingProfesional ? "PUT" : "POST";
    const endpoint = editingProfesional ? `/api/profesionales/${editingProfesional.id}` : "/api/profesionales";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        especialidad_id: especialidadId,
        duracion_turno: duracionTurno,
        pacientes_mensuales: Number.isInteger(pacientesMensuales) ? pacientesMensuales : 0,
      }),
    });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo guardar el profesional");
      return;
    }

    toast.success(editingProfesional ? "Profesional actualizado" : "Profesional creado correctamente");
    setForm(emptyForm);
    setOpen(false);
    setEditingProfesional(null);
    await fetchProfesionales();
  }

  async function handleDelete(item: ProfesionalApi) {
    if (!canManageCrud) {
      toast.error("Solo el rol Desarrollador puede gestionar profesionales");
      return;
    }
    if (!window.confirm("Desea eliminar este profesional?")) return;
    const response = await fetch(`/api/profesionales/${item.id}`, { method: "DELETE" });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar el profesional");
      return;
    }
    toast.success("Profesional eliminado");
    await fetchProfesionales();
  }

  async function openTurnosMesModal(profesional: ProfesionalApi) {
    setSelectedProfesional(profesional);
    setMesTurnosOpen(true);
    await fetchTurnosMes(profesional.id, mesFilter);
  }

  async function fetchTurnosMes(profesionalId: number, month: number) {
    setLoadingTurnosMes(true);
    try {
      const response = await fetch(`/api/profesionales/${profesionalId}/turnos-mes?mes=${month}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { success: boolean; data?: TurnoMesRow[]; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "No se pudieron cargar los turnos del profesional");
      }
      setTurnosDelMes(data.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los turnos del profesional");
      setTurnosDelMes([]);
    } finally {
      setLoadingTurnosMes(false);
    }
  }

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Date(2026, index, 1).toLocaleDateString("es-AR", { month: "long" }),
      })),
    []
  );
  const selectedMonthLabel = monthOptions.find((item) => item.value === mesFilter)?.label ?? `Mes ${mesFilter}`;

  async function exportarTurnosMesPdf(accion: "descargar" | "imprimir") {
    if (!selectedProfesional || turnosDelMes.length === 0) {
      toast.error("No hay turnos para exportar en este mes");
      return;
    }
    try {
      const pdf = await buildA4TablePdf({
        title: `Turnos mensuales - ${selectedProfesional.nombre}`,
        subtitle: `Mes: ${selectedMonthLabel} | Especialidad: ${selectedProfesional.especialidad}`,
        columns: [
          { header: "Fecha", key: "fecha" },
          { header: "Hora", key: "hora" },
          { header: "Paciente", key: "paciente" },
          { header: "Socio", key: "socio" },
          { header: "Prestacion", key: "prestacion" },
          { header: "Estado", key: "estado" },
        ],
        rows: turnosDelMes.map((turno) => ({
          fecha: new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" }),
          hora: String(turno.hora).slice(0, 5),
          paciente: turno.paciente || "-",
          socio: `${turno.cod_soc}/${turno.adherente_codigo}`,
          prestacion: turno.prestacion || "-",
          estado: String(turno.estado).toUpperCase(),
        })),
      });

      const baseName = `turnos-${selectedProfesional.nombre.toLowerCase().replace(/\s+/g, "-")}-${mesFilter}.pdf`;
      if (accion === "descargar") {
        downloadPdf(pdf, baseName);
        toast.success("PDF del profesional generado");
        return;
      }

      const success = printPdf(pdf);
      if (!success) {
        toast.error("No se pudo abrir la vista de impresion");
        return;
      }
      toast.success("Abriendo vista de impresion");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el PDF");
    }
  }

  if (!canAccessModule(role, "profesionales")) {
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

  if (loading) {
    return <Loading label="Cargando profesionales..." />;
  }

  return (
    <div className="module-shell space-y-6">
      <PageHeader
        title="Profesionales"
        breadcrumbs={["Configuracion medica"]}
        rightSlot={
          canManageCrud ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button onClick={openCreateModal}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo profesional
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingProfesional ? "Editar profesional" : "Nuevo profesional"}</DialogTitle>
                  <DialogDescription>Completa los datos principales del profesional.</DialogDescription>
                </DialogHeader>

                <div className="field-grid field-grid-2">
                  <label className="grid gap-2">
                    <span className="field-label">Nombre completo</span>
                    <Input value={form.nombre} onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))} />
                  </label>

                  <label className="grid gap-2">
                    <span className="field-label">Especialidad</span>
                    <select
                      className="h-11 rounded-2xl border border-border bg-input px-3 text-sm text-foreground outline-none"
                      value={form.especialidad_id}
                      onChange={(event) => setForm((prev) => ({ ...prev, especialidad_id: event.target.value }))}
                    >
                      <option value="">Seleccionar</option>
                      {especialidades.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="field-label">Pacientes mensuales</span>
                    <Input
                      type="number"
                      min={0}
                      value={form.pacientes_mensuales}
                      onChange={(event) => setForm((prev) => ({ ...prev, pacientes_mensuales: event.target.value }))}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="field-label">Duracion del turno</span>
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={form.duracion_turno}
                      onChange={(event) => setForm((prev) => ({ ...prev, duracion_turno: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave}>{editingProfesional ? "Actualizar" : "Guardar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-5 w-5 text-primary" />
            Listado de profesionales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profesionales.length === 0 ? (
            <EmptyState message="No hay profesionales registrados." />
          ) : (
            <>
              <div className="hidden min-[1400px]:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead>Cupo mensual</TableHead>
                      <TableHead>Duracion</TableHead>
                      <TableHead>{canManageCrud ? "Acciones" : "Consulta"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profesionales.map((profesional) => (
                      <TableRow key={profesional.id}>
                        <TableCell className="font-medium text-foreground">{profesional.nombre}</TableCell>
                        <TableCell>{profesional.especialidad}</TableCell>
                        <TableCell>
                          {Number.isFinite(Number(profesional.pacientes_mensuales))
                            ? `${Number(profesional.turnos_mes ?? 0)} / ${Number(profesional.pacientes_mensuales)}`
                            : "No definido"}
                        </TableCell>
                        <TableCell>{profesional.duracion_turno ? `${profesional.duracion_turno} min` : "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => void openTurnosMesModal(profesional)}>
                              <Eye className="mr-1 h-4 w-4" />
                              Turnos del mes
                            </Button>
                            {canManageCrud ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openEditModal(profesional)}>
                                  <Pencil className="mr-1 h-4 w-4" />
                                  Editar
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(profesional)}>
                                  <Trash2 className="mr-1 h-4 w-4" />
                                  Eliminar
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 min-[1400px]:hidden">
                {profesionales.map((profesional) => (
                  <div key={profesional.id} className="data-card space-y-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">{profesional.nombre}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{profesional.especialidad}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="field-help">Cupo mensual</p>
                        <p className="field-label">
                          {Number.isFinite(Number(profesional.pacientes_mensuales))
                            ? `${Number(profesional.turnos_mes ?? 0)} / ${Number(profesional.pacientes_mensuales)}`
                            : "No definido"}
                        </p>
                      </div>
                      <div>
                        <p className="field-help">Duracion</p>
                        <p className="field-label">{profesional.duracion_turno ? `${profesional.duracion_turno} min` : "-"}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" className="sm:flex-1" onClick={() => void openTurnosMesModal(profesional)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Turnos del mes
                      </Button>
                      {canManageCrud ? (
                        <>
                          <Button variant="outline" className="sm:flex-1" onClick={() => openEditModal(profesional)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="destructive" className="sm:flex-1" onClick={() => handleDelete(profesional)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={mesTurnosOpen} onOpenChange={setMesTurnosOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Turnos de {selectedProfesional?.nombre ?? "profesional"} del mes
            </DialogTitle>
            <DialogDescription>
              Vista mensual de turnos reservados y atendidos para controlar cupo del profesional.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="grid gap-1">
              <span className="field-label">Mes</span>
              <select
                className="h-10 rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary"
                value={mesFilter}
                onChange={(event) => {
                  const nextMonth = Number(event.target.value);
                  setMesFilter(nextMonth);
                  if (selectedProfesional) {
                    void fetchTurnosMes(selectedProfesional.id, nextMonth);
                  }
                }}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {turnosDelMes.length} turnos registrados.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => void exportarTurnosMesPdf("descargar")} disabled={turnosDelMes.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={() => void exportarTurnosMesPdf("imprimir")} disabled={turnosDelMes.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir A4
            </Button>
          </div>

          {loadingTurnosMes ? (
            <Loading label="Cargando turnos del mes..." />
          ) : turnosDelMes.length === 0 ? (
            <EmptyState message="No hay turnos para ese mes." />
          ) : (
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Prestacion</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turnosDelMes.map((turno) => (
                    <TableRow key={turno.id}>
                      <TableCell>{new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</TableCell>
                      <TableCell>{String(turno.hora).slice(0, 5)}</TableCell>
                      <TableCell>{turno.paciente || `Socio ${turno.cod_soc}`}</TableCell>
                      <TableCell>{turno.prestacion}</TableCell>
                      <TableCell>{turno.estado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

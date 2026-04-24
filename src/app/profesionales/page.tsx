"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
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

const emptyForm: FormState = {
  nombre: "",
  especialidad_id: "",
  duracion_turno: "",
  pacientes_mensuales: "",
};

export default function ProfesionalesPage() {
  const { role } = useUser();
  const [profesionales, setProfesionales] = useState<ProfesionalApi[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingProfesional, setEditingProfesional] = useState<ProfesionalApi | null>(null);

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
                      <TableHead>Acciones</TableHead>
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
                            <Button size="sm" variant="outline" onClick={() => openEditModal(profesional)}>
                              <Pencil className="mr-1 h-4 w-4" />
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(profesional)}>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Eliminar
                            </Button>
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
                      <Button variant="outline" className="sm:flex-1" onClick={() => openEditModal(profesional)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="destructive" className="sm:flex-1" onClick={() => handleDelete(profesional)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

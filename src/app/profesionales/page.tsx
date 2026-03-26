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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  if (!canAccessModule(role, "profesionales")) {
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

  async function fetchProfesionales() {
    const response = await fetch("/api/profesionales", { cache: "no-store" });
    const data = (await response.json()) as {
      success: boolean;
      data?: ProfesionalApi[];
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "No se pudieron cargar profesionales");
    }

    setProfesionales(data.data ?? []);
  }

  async function fetchEspecialidades() {
    const response = await fetch("/api/especialidades", { cache: "no-store" });
    const data = (await response.json()) as {
      success: boolean;
      data?: EspecialidadApi[];
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "No se pudieron cargar especialidades");
    }

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
    const endpoint = editingProfesional
      ? `/api/profesionales/${editingProfesional.id}`
      : "/api/profesionales";

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
    const confirmed = window.confirm("¿Desea eliminar este profesional?");
    if (!confirmed) return;

    const response = await fetch(`/api/profesionales/${item.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar el profesional");
      return;
    }

    toast.success("Profesional eliminado");
    await fetchProfesionales();
  }

  if (loading) {
    return <Loading label="Cargando profesionales..." />;
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-coopBlue" />
          Listado de Profesionales
        </CardTitle>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Profesional
              </Button>
            }
          />
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingProfesional ? "Editar Profesional" : "Nuevo Profesional"}</DialogTitle>
              <DialogDescription>Registrar profesional para la gestion de turnos PFC.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span>Nombre Completo *</span>
                <Input
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Especialidad *</span>
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.especialidad_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, especialidad_id: event.target.value }))
                  }
                >
                  <option value="">Seleccionar</option>
                  {especialidades.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Pacientes mensuales</span>
                <Input
                  type="number"
                  min={0}
                  value={form.pacientes_mensuales}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, pacientes_mensuales: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Duracion turno (min) *</span>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={form.duracion_turno}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, duracion_turno: event.target.value }))
                  }
                />
              </label>
            </div>

            <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={handleSave}>
              {editingProfesional ? "Actualizar" : "Guardar"}
            </Button>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {profesionales.length === 0 ? (
          <EmptyState message="No hay profesionales registrados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profesional</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Cupo mensual</TableHead>
                <TableHead>Duracion turno</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profesionales.map((profesional) => (
                <TableRow key={profesional.id}>
                  <TableCell>{profesional.nombre}</TableCell>
                  <TableCell>{profesional.especialidad}</TableCell>
                  <TableCell>
                    {Number.isFinite(Number(profesional.pacientes_mensuales)) ? (
                      <div className="space-y-1 text-sm">
                        <p>
                          {Number(profesional.turnos_mes ?? 0)} / {Number(profesional.pacientes_mensuales)} usados
                        </p>
                        <p
                          className={
                            Number(profesional.cupo_restante ?? 0) <= 0
                              ? "font-medium text-red-600"
                              : "text-slate-600"
                          }
                        >
                          Restantes: {Math.max(Number(profesional.cupo_restante ?? 0), 0)}
                        </p>
                      </div>
                    ) : (
                      "No definido"
                    )}
                  </TableCell>
                  <TableCell>{profesional.duracion_turno ? `${profesional.duracion_turno} min` : "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openEditModal(profesional)}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => handleDelete(profesional)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

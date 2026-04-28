"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { ROLES } from "@/lib/roles";

type EspecialidadApi = {
  id: number;
  nombre: string;
};

type EspecialidadConProfesionales = {
  id: number;
  nombre: string;
  profesionales: Array<{
    id: number;
    nombre: string;
  }>;
};

type EspecialidadForm = {
  nombre: string;
};

const emptyEspecialidadForm: EspecialidadForm = {
  nombre: "",
};

export default function EspecialidadesPage() {
  const { role } = useUser();
  const canManageCrud = role === ROLES.DEVELOPER;
  const [especialidades, setEspecialidades] = useState<EspecialidadApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEspecialidad, setEditingEspecialidad] = useState<EspecialidadApi | null>(null);
  const [form, setForm] = useState<EspecialidadForm>(emptyEspecialidadForm);
  const [especialidadesConProfesionales, setEspecialidadesConProfesionales] = useState<
    EspecialidadConProfesionales[]
  >([]);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        await Promise.all([fetchEspecialidades(), fetchEspecialidadesConProfesionales()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar especialidades");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function fetchEspecialidades() {
    const response = await fetch("/api/especialidades", { cache: "no-store" });
    const data = (await response.json()) as {
      success: boolean;
      data?: EspecialidadApi[];
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Error cargando especialidades");
    }

    setEspecialidades(data.data ?? []);
  }

  async function fetchEspecialidadesConProfesionales() {
    const response = await fetch("/api/especialidades/profesionales", { cache: "no-store" });
    const data = (await response.json()) as {
      success: boolean;
      data?: EspecialidadConProfesionales[];
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Error cargando profesionales por especialidad");
    }

    setEspecialidadesConProfesionales(data.data ?? []);
  }

  function openCreateModal() {
    setEditingEspecialidad(null);
    setForm(emptyEspecialidadForm);
    setModalOpen(true);
  }

  function openEditModal(item: EspecialidadApi) {
    setEditingEspecialidad(item);
    setForm({ nombre: item.nombre });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!canManageCrud) {
      toast.error("Solo el rol Desarrollador puede gestionar especialidades");
      return;
    }
    const nombre = form.nombre.trim();
    if (!nombre) {
      toast.error("Completa el nombre de la especialidad");
      return;
    }

    const method = editingEspecialidad ? "PUT" : "POST";
    const endpoint = editingEspecialidad
      ? `/api/especialidades/${editingEspecialidad.id}`
      : "/api/especialidades";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo guardar la especialidad");
      return;
    }

    toast.success(editingEspecialidad ? "Especialidad actualizada" : "Especialidad creada");
    setModalOpen(false);
    setEditingEspecialidad(null);
    setForm(emptyEspecialidadForm);
    await Promise.all([fetchEspecialidades(), fetchEspecialidadesConProfesionales()]);
  }

  async function handleDelete(item: EspecialidadApi) {
    if (!canManageCrud) {
      toast.error("Solo el rol Desarrollador puede gestionar especialidades");
      return;
    }
    const confirmed = window.confirm("¿Desea eliminar esta especialidad?");
    if (!confirmed) return;

    const response = await fetch(`/api/especialidades/${item.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar la especialidad");
      return;
    }

    toast.success("Especialidad eliminada");
    await Promise.all([fetchEspecialidades(), fetchEspecialidadesConProfesionales()]);
  }

  if (!canAccessModule(role, "especialidades")) {
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

  if (loading) {
    return <Loading label="Cargando especialidades..." />;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Gestion de Especialidades</CardTitle>
          {canManageCrud ? (
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogTrigger
                render={
                  <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={openCreateModal}>
                    Nueva especialidad
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingEspecialidad ? "Editar especialidad" : "Nueva especialidad"}</DialogTitle>
                  <DialogDescription>Ingresa el nombre de la especialidad.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    <span>Nombre</span>
                    <Input
                      value={form.nombre}
                      onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                      placeholder="Ej: Psicologia"
                    />
                  </label>
                  <Button className="mt-2 bg-coopBlue text-white hover:bg-coopSecondary" onClick={handleSave}>
                    {editingEspecialidad ? "Actualizar especialidad" : "Guardar especialidad"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>

        <CardContent>
          {especialidades.length === 0 ? (
            <EmptyState message="No hay especialidades registradas." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">{canManageCrud ? "Acciones" : "Consulta"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {especialidades.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.nombre}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {canManageCrud ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openEditModal(item)}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">Solo lectura</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Profesionales por especialidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {especialidadesConProfesionales.length === 0 ? (
            <EmptyState message="No hay especialidades para mostrar." />
          ) : (
            especialidadesConProfesionales.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-base font-semibold text-slate-900">{item.nombre}</p>
                <div className="mt-2">
                  {item.profesionales.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin profesionales vinculados.</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-slate-700">
                      {item.profesionales.map((profesional) => (
                        <li key={profesional.id}>{profesional.nombre}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

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

type PrestacionApi = {
  id: number;
  nombre: string;
  especialidad_id: number;
  especialidad: string;
};

type EspecialidadApi = {
  id: number;
  nombre: string;
};

type PrestacionForm = {
  nombre: string;
  especialidad_id: string;
};

const emptyPrestacionForm: PrestacionForm = {
  nombre: "",
  especialidad_id: "",
};

export default function PrestacionesPage() {
  const { role } = useUser();
  const [prestaciones, setPrestaciones] = useState<PrestacionApi[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrestacion, setEditingPrestacion] = useState<PrestacionApi | null>(null);
  const [prestacionForm, setPrestacionForm] = useState<PrestacionForm>(emptyPrestacionForm);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        await Promise.all([fetchPrestaciones(), fetchEspecialidades()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function fetchPrestaciones() {
    const response = await fetch("/api/prestaciones", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: PrestacionApi[]; error?: string };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Error cargando prestaciones");
    }

    setPrestaciones(data.data ?? []);
  }

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

  function openNewPrestacionModal() {
    setEditingPrestacion(null);
    setPrestacionForm(emptyPrestacionForm);
    setModalOpen(true);
  }

  function openEditPrestacionModal(prestacion: PrestacionApi) {
    setEditingPrestacion(prestacion);
    setPrestacionForm({
      nombre: prestacion.nombre,
      especialidad_id: String(prestacion.especialidad_id),
    });
    setModalOpen(true);
  }

  async function handleSavePrestacion() {
    const nombre = prestacionForm.nombre.trim();
    const especialidadId = Number(prestacionForm.especialidad_id);

    if (!nombre || !Number.isInteger(especialidadId) || especialidadId <= 0) {
      toast.error("Completa nombre y especialidad");
      return;
    }

    const method = editingPrestacion ? "PUT" : "POST";
    const endpoint = editingPrestacion ? `/api/prestaciones/${editingPrestacion.id}` : "/api/prestaciones";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        especialidad_id: especialidadId,
      }),
    });

    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo guardar la prestacion");
      return;
    }

    toast.success(editingPrestacion ? "Prestacion actualizada" : "Prestacion creada");
    setModalOpen(false);
    setEditingPrestacion(null);
    setPrestacionForm(emptyPrestacionForm);
    await fetchPrestaciones();
  }

  async function handleDeletePrestacion(prestacion: PrestacionApi) {
    const confirmed = window.confirm("¿Desea eliminar esta prestación?");
    if (!confirmed) return;

    const response = await fetch(`/api/prestaciones/${prestacion.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar la prestacion");
      return;
    }

    toast.success("Prestacion eliminada");
    await fetchPrestaciones();
  }

  if (!canAccessModule(role, "prestaciones")) {
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
    return <Loading label="Cargando prestaciones..." />;
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Gestion de Prestaciones PFC</CardTitle>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger
            render={
              <Button
                className="bg-coopBlue text-white hover:bg-coopSecondary"
                onClick={openNewPrestacionModal}
              >
                Nueva prestacion
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPrestacion ? "Editar prestacion" : "Nueva prestacion"}</DialogTitle>
              <DialogDescription>
                Completa el nombre y selecciona la especialidad asociada.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Nombre de prestacion</span>
                <Input
                  value={prestacionForm.nombre}
                  onChange={(event) =>
                    setPrestacionForm((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  placeholder="Ej: Sesion Psicologia Infantil"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Especialidad</span>
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={prestacionForm.especialidad_id}
                  onChange={(event) =>
                    setPrestacionForm((prev) => ({
                      ...prev,
                      especialidad_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Seleccionar especialidad</option>
                  {especialidades.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                className="mt-2 bg-coopBlue text-white hover:bg-coopSecondary"
                onClick={handleSavePrestacion}
              >
                {editingPrestacion ? "Actualizar prestacion" : "Guardar prestacion"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {prestaciones.length === 0 ? (
          <EmptyState message="No hay prestaciones registradas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestacion</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prestaciones.map((prestacion) => (
                <TableRow key={prestacion.id}>
                  <TableCell>{prestacion.nombre}</TableCell>
                  <TableCell>{prestacion.especialidad}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openEditPrestacionModal(prestacion)}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => handleDeletePrestacion(prestacion)}
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

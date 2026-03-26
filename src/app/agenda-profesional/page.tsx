"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
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

type AgendaRow = {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  profesional_id: number;
  profesional: string;
  especialidad: string;
  pacientes_mensuales: number | null;
};

type ProfesionalOption = {
  id: number;
  nombre: string;
  especialidad: string;
  pacientes_mensuales: number | null;
};

type FormState = {
  profesional_id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
};

const diaSemanaLabel: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
};

const emptyForm: FormState = {
  profesional_id: "",
  dia_semana: "",
  hora_inicio: "",
  hora_fin: "",
};

export default function AgendaProfesionalPage() {
  const { role } = useUser();
  const [agenda, setAgenda] = useState<AgendaRow[]>([]);
  const [profesionales, setProfesionales] = useState<ProfesionalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<AgendaRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        await Promise.all([fetchAgenda(), fetchProfesionales()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function fetchAgenda() {
    const response = await fetch("/api/agenda-profesional", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: AgendaRow[]; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Error cargando agenda profesional");
    }
    setAgenda(data.data ?? []);
  }

  async function fetchProfesionales() {
    const response = await fetch("/api/profesionales", { cache: "no-store" });
    const data = (await response.json()) as {
      success: boolean;
      data?: ProfesionalOption[];
      error?: string;
    };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Error cargando profesionales");
    }
    setProfesionales(data.data ?? []);
  }

  function openCreateModal() {
    setEditingHorario(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(item: AgendaRow) {
    setEditingHorario(item);
    setForm({
      profesional_id: String(item.profesional_id),
      dia_semana: String(item.dia_semana),
      hora_inicio: String(item.hora_inicio).slice(0, 5),
      hora_fin: String(item.hora_fin).slice(0, 5),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const profesionalId = Number(form.profesional_id);
    const diaSemana = Number(form.dia_semana);
    const horaInicio = form.hora_inicio.trim();
    const horaFin = form.hora_fin.trim();

    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      toast.error("Selecciona un profesional");
      return;
    }
    if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 6) {
      toast.error("Selecciona un dia valido");
      return;
    }
    if (!horaInicio || !horaFin) {
      toast.error("Completa hora de inicio y fin");
      return;
    }

    if (editingHorario) {
      const response = await fetch(`/api/agenda-profesional/${editingHorario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dia_semana: diaSemana,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
        }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo actualizar el horario");
        return;
      }
      toast.success("Horario actualizado");
    } else {
      const response = await fetch("/api/agenda-profesional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profesional_id: profesionalId,
          dia_semana: diaSemana,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
        }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo crear el horario");
        return;
      }
      toast.success("Horario creado correctamente");
    }

    setModalOpen(false);
    setEditingHorario(null);
    setForm(emptyForm);
    await fetchAgenda();
  }

  async function handleDelete(item: AgendaRow) {
    const confirmed = window.confirm("¿Desea eliminar este horario?");
    if (!confirmed) return;

    const response = await fetch(`/api/agenda-profesional/${item.id}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { success: boolean; error?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar el horario");
      return;
    }

    toast.success("Horario eliminado");
    await fetchAgenda();
  }

  if (!canAccessModule(role, "agenda-profesional")) {
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
    return <Loading label="Cargando agenda profesional..." />;
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-coopBlue" />
          Agenda Profesional
        </CardTitle>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger
            render={
              <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={openCreateModal}>
                Nuevo horario
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingHorario ? "Editar horario" : "Nuevo horario"}</DialogTitle>
              <DialogDescription>Configura el dia y franja de atencion del profesional.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Profesional</span>
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.profesional_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, profesional_id: event.target.value }))}
                  disabled={Boolean(editingHorario)}
                >
                  <option value="">Seleccionar</option>
                  {profesionales.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.nombre} - {item.especialidad}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Dia de la semana</span>
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.dia_semana}
                  onChange={(event) => setForm((prev) => ({ ...prev, dia_semana: event.target.value }))}
                >
                  <option value="">Seleccionar</option>
                  {Object.entries(diaSemanaLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Hora inicio</span>
                <Input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(event) => setForm((prev) => ({ ...prev, hora_inicio: event.target.value }))}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Hora fin</span>
                <Input
                  type="time"
                  value={form.hora_fin}
                  onChange={(event) => setForm((prev) => ({ ...prev, hora_fin: event.target.value }))}
                />
              </label>

              <Button className="mt-2 bg-coopBlue text-white hover:bg-coopSecondary" onClick={handleSave}>
                {editingHorario ? "Actualizar horario" : "Guardar horario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {agenda.length === 0 ? (
          <EmptyState message="No hay horarios configurados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profesional</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Hora inicio</TableHead>
                <TableHead>Hora fin</TableHead>
                <TableHead>Pacientes mensuales</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agenda.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.profesional}</TableCell>
                  <TableCell>{item.especialidad}</TableCell>
                  <TableCell>{diaSemanaLabel[item.dia_semana] ?? `Dia ${item.dia_semana}`}</TableCell>
                  <TableCell>{String(item.hora_inicio).slice(0, 5)}</TableCell>
                  <TableCell>{String(item.hora_fin).slice(0, 5)}</TableCell>
                  <TableCell>
                    {Number.isFinite(Number(item.pacientes_mensuales))
                      ? `Puede atender ${Number(item.pacientes_mensuales)} pacientes mensuales`
                      : "No definido"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
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

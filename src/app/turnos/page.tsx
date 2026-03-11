"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useProfesionales } from "@/lib/profesionales-context";
import { canAccessModule, useUser } from "@/lib/user-context";
import { prestaciones } from "@/data/prestaciones";
import { socios } from "@/data/socios";
import { type EstadoTurno, type Turno, turnos as initialTurnos } from "@/data/turnos";

type FormTurno = {
  socio: string;
  profesional: string;
  prestacion: string;
  fecha: string;
  hora: string;
};

type PendingAction = {
  turnoId: number;
  estado: EstadoTurno;
  label: string;
};

const emptyForm: FormTurno = {
  socio: "",
  profesional: "",
  prestacion: "",
  fecha: "",
  hora: "",
};

const estadoBadgeClass: Record<EstadoTurno, string> = {
  Programado: "bg-coopBlue text-white",
  Atendido: "bg-coopGreen text-white",
  "No asistio": "bg-red-600 text-white",
  Cancelado: "bg-slate-500 text-white",
};

export default function TurnosPage() {
  const { role } = useUser();
  const { profesionales } = useProfesionales();
  const [isLoading, setIsLoading] = useState(true);
  const [turnos, setTurnos] = useState<Turno[]>(initialTurnos);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [form, setForm] = useState<FormTurno>(emptyForm);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const nextId = useMemo(() => {
    return turnos.length > 0 ? Math.max(...turnos.map((turno) => turno.id)) + 1 : 1;
  }, [turnos]);
  const profesionalesActivos = useMemo(
    () => profesionales.filter((item) => item.estado === "activo"),
    [profesionales]
  );
  const socioOptions = useMemo(() => {
    const base = socios.map((item) => item.nombre);
    if (form.socio && !base.includes(form.socio)) {
      return [form.socio, ...base];
    }
    return base;
  }, [form.socio]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const socioFromQuery = params.get("socio");
    if (socioFromQuery) {
      setForm((prev) => ({ ...prev, socio: socioFromQuery }));
      setOpen(true);
    }
  }, []);

  const updateTurnoEstado = (id: number, estado: EstadoTurno) => {
    setTurnos((prev) =>
      prev.map((turno) => (turno.id === id ? { ...turno, estado } : turno))
    );
    toast.success("Estado del turno actualizado");
  };

  const handleCreateTurno = () => {
    if (!form.socio || !form.profesional || !form.prestacion || !form.fecha || !form.hora) {
      return;
    }

    const selectedProfesional = profesionalesActivos.find(
      (item) => item.nombre === form.profesional
    );

    const newTurno: Turno = {
      id: nextId,
      profesional_id: selectedProfesional?.id ?? "",
      socio: form.socio,
      socio_dni: "",
      socio_telefono: "",
      socio_cuenta: "",
      socio_domicilio: "",
      socio_correo: "",
      profesional: form.profesional,
      prestacion: form.prestacion,
      fecha: form.fecha,
      hora: form.hora,
      estado: "Programado",
    };

    setTurnos((prev) => [newTurno, ...prev]);
    setForm(emptyForm);
    setOpen(false);
    toast.success("Turno creado correctamente");
  };

  const requestEstadoChange = (turnoId: number, estado: EstadoTurno, label: string) => {
    setPendingAction({ turnoId, estado, label });
    setConfirmOpen(true);
  };

  const confirmEstadoChange = () => {
    if (!pendingAction) return;
    updateTurnoEstado(pendingAction.turnoId, pendingAction.estado);
    setPendingAction(null);
    setConfirmOpen(false);
  };

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
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Gestion de Turnos</CardTitle>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="bg-coopBlue text-white hover:bg-coopSecondary">
                Nuevo Turno
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo Turno</DialogTitle>
              <DialogDescription>
                Completa los datos para registrar un nuevo turno en la agenda.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Socio</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.socio}
                  onChange={(event) => setForm((prev) => ({ ...prev, socio: event.target.value }))}
                >
                  <option value="">Seleccionar socio</option>
                  {socioOptions.map((socioNombre) => (
                    <option key={socioNombre} value={socioNombre}>
                      {socioNombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Profesional</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.profesional}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, profesional: event.target.value }))
                  }
                >
                  <option value="">Seleccionar profesional</option>
                  {profesionalesActivos.length === 0 && (
                    <option value="" disabled>
                      No hay profesionales activos
                    </option>
                  )}
                  {profesionalesActivos.map((profesional) => (
                    <option key={profesional.id} value={profesional.nombre}>
                      {profesional.nombre} - {profesional.especialidad}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Prestacion</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.prestacion}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, prestacion: event.target.value }))
                  }
                >
                  <option value="">Seleccionar prestacion</option>
                  {prestaciones.map((prestacion) => (
                    <option key={prestacion.id} value={prestacion.nombre}>
                      {prestacion.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm">
                  <span>Fecha</span>
                  <input
                    type="date"
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                    value={form.fecha}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, fecha: event.target.value }))
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span>Hora</span>
                  <input
                    type="time"
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                    value={form.hora}
                    onChange={(event) => setForm((prev) => ({ ...prev, hora: event.target.value }))}
                  />
                </label>
              </div>

              <Button
                onClick={handleCreateTurno}
                className="mt-2 bg-coopBlue text-white hover:bg-coopSecondary"
              >
                Guardar turno
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {turnos.length === 0 ? (
          <EmptyState message="No hay turnos disponibles." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Prestacion</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnos.map((turno) => (
                <TableRow key={turno.id}>
                  <TableCell>{turno.socio}</TableCell>
                  <TableCell>{turno.profesional}</TableCell>
                  <TableCell>{turno.prestacion}</TableCell>
                  <TableCell>{format(parseISO(turno.fecha), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{turno.hora}</TableCell>
                  <TableCell>
                    <Badge className={estadoBadgeClass[turno.estado]}>{turno.estado}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        className="bg-coopBlue text-white hover:bg-coopSecondary"
                        onClick={() =>
                          requestEstadoChange(turno.id, "Atendido", "Confirmar atencion")
                        }
                      >
                        Confirmar atencion
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          requestEstadoChange(turno.id, "No asistio", "Marcar como no asistio")
                        }
                      >
                        Marcar No asistio
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction?.label ?? "Confirmar accion"}</DialogTitle>
            <DialogDescription>¿Confirmar esta accion?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={confirmEstadoChange}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FileText, Stethoscope } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { type EstadoTurno, type Turno, turnos as initialTurnos } from "@/data/turnos";

type AtencionForm = {
  motivo: string;
  diagnostico: string;
  prestacion: string;
  observaciones: string;
};

const emptyAtencion: AtencionForm = {
  motivo: "",
  diagnostico: "",
  prestacion: "",
  observaciones: "",
};

const TODAY_MOCK = "2026-03-20";

function formatEstado(estado: EstadoTurno) {
  if (estado === "Programado") return "Pendiente";
  if (estado === "No asistio") return "Ausente";
  return estado;
}

export default function EspecialistaPage() {
  const { role, specialistAccount } = useUser();
  const { profesionales } = useProfesionales();
  const [turnos, setTurnos] = useState<Turno[]>(initialTurnos);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [openPaciente, setOpenPaciente] = useState(false);
  const [atencion, setAtencion] = useState<AtencionForm>(emptyAtencion);

  if (!canAccessModule(role, "especialista")) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Este panel esta disponible solo para el rol Especialista.
          </p>
        </CardContent>
      </Card>
    );
  }

  const profesional = profesionales.find((item) => item.id === specialistAccount.profesional_id);
  const turnosEspecialista = turnos.filter(
    (turno) => turno.profesional_id === specialistAccount.profesional_id
  );

  const turnosHoy = turnosEspecialista.filter((turno) => turno.fecha === TODAY_MOCK);
  const proximosTurnos = turnosEspecialista.filter((turno) => turno.fecha > TODAY_MOCK);
  const atendidos = turnosHoy.filter((turno) => turno.estado === "Atendido").length;
  const pendientes = turnosHoy.filter((turno) => turno.estado === "Programado").length;

  const openFicha = (turno: Turno) => {
    setSelectedTurno(turno);
    setAtencion({
      motivo: "",
      diagnostico: "",
      prestacion: turno.prestacion,
      observaciones: "",
    });
    setOpenPaciente(true);
  };

  const updateEstado = (turnoId: number, estado: EstadoTurno) => {
    setTurnos((prev) => prev.map((turno) => (turno.id === turnoId ? { ...turno, estado } : turno)));
  };

  const guardarAtencion = () => {
    if (!selectedTurno) return;
    updateEstado(selectedTurno.id, "Atendido");
    toast.success("Atencion registrada");
    setOpenPaciente(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm">
        <CardContent className="space-y-1 py-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            Bienvenido {profesional?.nombre ?? specialistAccount.usuario}
          </h2>
          <p className="text-sm text-slate-600">
            Especialidad: {profesional?.especialidad ?? "No registrada"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Turnos de hoy</p>
            <p className="text-2xl font-semibold text-slate-900">{turnosHoy.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Atendidos</p>
            <p className="text-2xl font-semibold text-coopGreen">{atendidos}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Pendientes</p>
            <p className="text-2xl font-semibold text-coopBlue">{pendientes}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-coopGreen" />
            Turnos del Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnosHoy.map((turno) => (
                <TableRow key={turno.id} className="cursor-pointer" onClick={() => openFicha(turno)}>
                  <TableCell>{turno.hora}</TableCell>
                  <TableCell>{turno.socio}</TableCell>
                  <TableCell>{turno.socio_dni || "No registrado"}</TableCell>
                  <TableCell>{turno.socio_telefono || "No registrado"}</TableCell>
                  <TableCell>
                    <Badge className="bg-coopBlue text-white">{formatEstado(turno.estado)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-coopBlue" />
            Proximos Turnos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Paciente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proximosTurnos.map((turno) => (
                <TableRow key={turno.id} className="cursor-pointer" onClick={() => openFicha(turno)}>
                  <TableCell>{turno.fecha}</TableCell>
                  <TableCell>{turno.hora}</TableCell>
                  <TableCell>{turno.socio}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openPaciente} onOpenChange={setOpenPaciente}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ficha del Paciente</DialogTitle>
            <DialogDescription>Registro de atencion medica.</DialogDescription>
          </DialogHeader>

          {selectedTurno && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                <p>
                  <span className="font-semibold">Cuenta:</span>{" "}
                  {selectedTurno.socio_cuenta || "No registrado"}
                </p>
                <p>
                  <span className="font-semibold">Titular:</span> {selectedTurno.socio}
                </p>
                <p>
                  <span className="font-semibold">DNI:</span>{" "}
                  {selectedTurno.socio_dni || "No registrado"}
                </p>
                <p>
                  <span className="font-semibold">Domicilio:</span>{" "}
                  {selectedTurno.socio_domicilio || "No registrado"}
                </p>
                <p>
                  <span className="font-semibold">Telefono:</span>{" "}
                  {selectedTurno.socio_telefono || "No registrado"}
                </p>
                <p>
                  <span className="font-semibold">Correo:</span>{" "}
                  {selectedTurno.socio_correo || "No registrado"}
                </p>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span>Motivo de consulta</span>
                  <Input
                    value={atencion.motivo}
                    onChange={(event) => setAtencion((prev) => ({ ...prev, motivo: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Diagnostico</span>
                  <Input
                    value={atencion.diagnostico}
                    onChange={(event) =>
                      setAtencion((prev) => ({ ...prev, diagnostico: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Prestacion realizada</span>
                  <Input
                    value={atencion.prestacion}
                    onChange={(event) =>
                      setAtencion((prev) => ({ ...prev, prestacion: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Observaciones</span>
                  <Input
                    value={atencion.observaciones}
                    onChange={(event) =>
                      setAtencion((prev) => ({ ...prev, observaciones: event.target.value }))
                    }
                  />
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedTurno && (
              <Button
                variant="destructive"
                onClick={() => {
                  updateEstado(selectedTurno.id, "No asistio");
                  toast.success("Paciente marcado como ausente");
                  setOpenPaciente(false);
                }}
              >
                Marcar Ausente
              </Button>
            )}
            <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={guardarAtencion}>
              <FileText className="mr-2 h-4 w-4" />
              Guardar Atencion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

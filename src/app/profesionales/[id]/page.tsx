"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Mail, Phone, Stethoscope, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfesionales } from "@/lib/profesionales-context";

export default function ProfesionalAgendaPage() {
  const params = useParams<{ id: string }>();
  const { profesionales, updateProfesional, toggleEstadoProfesional } = useProfesionales();
  const [openEdit, setOpenEdit] = useState(false);

  const profesional = useMemo(
    () => profesionales.find((item) => item.id === params.id),
    [params.id, profesionales]
  );
  const [form, setForm] = useState({
    nombre: profesional?.nombre ?? "",
    especialidad: profesional?.especialidad ?? "",
    dni: profesional?.dni ?? "",
    telefono: profesional?.telefono ?? "",
    correo: profesional?.correo ?? "",
    direccion: profesional?.direccion ?? "",
    matricula: profesional?.matricula ?? "",
    estado: profesional?.estado ?? "activo",
  });

  useEffect(() => {
    if (!profesional) return;
    setForm({
      nombre: profesional.nombre,
      especialidad: profesional.especialidad,
      dni: profesional.dni,
      telefono: profesional.telefono,
      correo: profesional.correo,
      direccion: profesional.direccion,
      matricula: profesional.matricula,
      estado: profesional.estado,
    });
  }, [profesional]);

  if (!profesional) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Profesional no encontrado</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/profesionales" className="text-sm text-coopBlue hover:underline">
            Volver al listado de profesionales
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-coopBlue" />
            Profesional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-semibold">Nombre:</span> {profesional.nombre}
          </p>
          <p>
            <span className="font-semibold">Especialidad:</span> {profesional.especialidad}
          </p>
          <p>
            <span className="font-semibold">DNI:</span> {profesional.dni || "No registrado"}
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-coopGreen" />
            <span className="font-semibold">Telefono:</span> {profesional.telefono || "No registrado"}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-coopOrange" />
            <span className="font-semibold">Correo:</span> {profesional.correo || "No registrado"}
          </p>
          <p className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-coopBlue" />
            <span className="font-semibold">Matricula:</span> {profesional.matricula || "No registrado"}
          </p>
          <p className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-coopPurple" />
            <span className="font-semibold">Estado:</span>
            <Badge className={profesional.estado === "activo" ? "bg-coopGreen text-white" : "bg-slate-400 text-white"}>
              {profesional.estado === "activo" ? "Activo" : "Inactivo"}
            </Badge>
          </p>

          <div className="flex gap-2 pt-2">
            <Dialog open={openEdit} onOpenChange={setOpenEdit}>
              <DialogTrigger render={<Button variant="outline">Editar</Button>} />
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Editar Profesional</DialogTitle>
                  <DialogDescription>Actualiza los datos del especialista.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span>Nombre Completo</span>
                    <Input
                      value={form.nombre}
                      onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Especialidad</span>
                    <Input
                      value={form.especialidad}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, especialidad: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>DNI</span>
                    <Input
                      value={form.dni}
                      onChange={(event) => setForm((prev) => ({ ...prev, dni: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Telefono</span>
                    <Input
                      value={form.telefono}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, telefono: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Correo</span>
                    <Input
                      value={form.correo}
                      onChange={(event) => setForm((prev) => ({ ...prev, correo: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-2">
                    <span>Direccion</span>
                    <Input
                      value={form.direccion}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, direccion: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Matricula</span>
                    <Input
                      value={form.matricula}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, matricula: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenEdit(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="bg-coopBlue text-white hover:bg-coopSecondary"
                    onClick={() => {
                      if (!form.nombre.trim() || !form.especialidad.trim() || !form.telefono.trim()) {
                        toast.error("Complete los campos obligatorios");
                        return;
                      }
                      updateProfesional(profesional.id, {
                        nombre: form.nombre.trim(),
                        especialidad: form.especialidad.trim(),
                        dni: form.dni.trim(),
                        telefono: form.telefono.trim(),
                        correo: form.correo.trim(),
                        direccion: form.direccion.trim(),
                        matricula: form.matricula.trim(),
                        estado: profesional.estado,
                      });
                      toast.success("Profesional actualizado");
                      setOpenEdit(false);
                    }}
                  >
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant={profesional.estado === "activo" ? "destructive" : "outline"}
              onClick={() => {
                toggleEstadoProfesional(profesional.id);
                toast.success(
                  profesional.estado === "activo"
                    ? "Profesional desactivado"
                    : "Profesional activado"
                );
              }}
            >
              {profesional.estado === "activo" ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, UserRound } from "lucide-react";
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

type FormState = {
  nombre: string;
  especialidad: string;
  dni: string;
  telefono: string;
  correo: string;
  direccion: string;
  matricula: string;
  estado: "activo" | "inactivo";
};

const emptyForm: FormState = {
  nombre: "",
  especialidad: "",
  dni: "",
  telefono: "",
  correo: "",
  direccion: "",
  matricula: "",
  estado: "activo",
};

const especialidades = [
  "Clinica Medica",
  "Psicologia",
  "Kinesiologia",
  "Odontologia",
  "Cardiologia",
  "Nutricion",
  "Fonoaudiologia",
  "Otro",
];

export default function ProfesionalesPage() {
  const { role } = useUser();
  const { profesionales, createProfesional } = useProfesionales();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

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

  const handleCreate = () => {
    if (!form.nombre.trim() || !form.especialidad.trim() || !form.telefono.trim()) {
      toast.error("Complete los campos obligatorios");
      return;
    }

    createProfesional({
      nombre: form.nombre.trim(),
      especialidad: form.especialidad.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim(),
      correo: form.correo.trim(),
      direccion: form.direccion.trim(),
      matricula: form.matricula.trim(),
      estado: form.estado,
    });

    toast.success("Profesional creado correctamente");
    setForm(emptyForm);
    setOpen(false);
  };

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
              <Button className="bg-coopBlue text-white hover:bg-coopSecondary">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Profesional
              </Button>
            }
          />
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Nuevo Profesional</DialogTitle>
              <DialogDescription>Registrar especialista para P.F.C Servicios Sociales.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span>Nombre Completo *</span>
                <Input
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Especialidad *</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.especialidad}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, especialidad: event.target.value }))
                  }
                >
                  <option value="">Seleccionar</option>
                  {especialidades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>DNI</span>
                <Input
                  value={form.dni}
                  onChange={(event) => setForm((prev) => ({ ...prev, dni: event.target.value }))}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Telefono *</span>
                <Input
                  value={form.telefono}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, telefono: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Correo electronico</span>
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
                <span>Matricula profesional</span>
                <Input
                  value={form.matricula}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, matricula: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Estado</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.estado}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      estado: event.target.value as "activo" | "inactivo",
                    }))
                  }
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-coopBlue text-white hover:bg-coopSecondary" onClick={handleCreate}>
                Guardar
              </Button>
            </DialogFooter>
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
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Accion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profesionales.map((profesional) => (
                <TableRow key={profesional.id}>
                  <TableCell>{profesional.id}</TableCell>
                  <TableCell>{profesional.nombre}</TableCell>
                  <TableCell>{profesional.especialidad}</TableCell>
                  <TableCell>{profesional.telefono || "No registrado"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        profesional.estado === "activo"
                          ? "bg-coopGreen text-white"
                          : "bg-slate-400 text-white"
                      }
                    >
                      {profesional.estado === "activo" ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/profesionales/${profesional.id}`}>
                      <Button size="sm" variant="outline">
                        Ver
                      </Button>
                    </Link>
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

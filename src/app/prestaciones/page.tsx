"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessModule, useUser } from "@/lib/user-context";
import { type Prestacion, prestaciones as initialPrestaciones } from "@/data/prestaciones";

type NewPrestacionForm = {
  nombre: string;
  sesionesMaximas: string;
  periodo: "mensual" | "anual";
};

const emptyForm: NewPrestacionForm = {
  nombre: "",
  sesionesMaximas: "",
  periodo: "mensual",
};

export default function PrestacionesPage() {
  const { role } = useUser();
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>(initialPrestaciones);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewPrestacionForm>(emptyForm);

  const nextId = useMemo(() => {
    return prestaciones.length > 0 ? Math.max(...prestaciones.map((item) => item.id)) + 1 : 1;
  }, [prestaciones]);

  const handleSavePrestacion = () => {
    const sesiones = Number(form.sesionesMaximas);
    if (!form.nombre.trim() || !Number.isFinite(sesiones) || sesiones <= 0) {
      return;
    }

    const nuevaPrestacion: Prestacion = {
      id: nextId,
      nombre: form.nombre.trim(),
      sesionesMaximas: sesiones,
      periodo: form.periodo,
    };

    setPrestaciones((prev) => [nuevaPrestacion, ...prev]);
    setForm(emptyForm);
    setOpen(false);
    toast.success("Prestacion agregada");
  };

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

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Gestion de Prestaciones PFC</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="bg-coopBlue text-white hover:bg-coopSecondary">
                Nueva prestacion
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nueva prestacion</DialogTitle>
              <DialogDescription>
                Registra una nueva prestacion y define su limite de sesiones.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Nombre de prestacion</span>
                <Input
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  placeholder="Ej: Kinesiologia"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Sesiones maximas</span>
                <Input
                  type="number"
                  min={1}
                  value={form.sesionesMaximas}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sesionesMaximas: event.target.value }))
                  }
                  placeholder="Ej: 4"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Periodo</span>
                <select
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
                  value={form.periodo}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      periodo: event.target.value as "mensual" | "anual",
                    }))
                  }
                >
                  <option value="mensual">mensual</option>
                  <option value="anual">anual</option>
                </select>
              </label>

              <Button
                className="mt-2 bg-coopBlue text-white hover:bg-coopSecondary"
                onClick={handleSavePrestacion}
              >
                Guardar prestacion
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre de prestacion</TableHead>
              <TableHead>Sesiones permitidas</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prestaciones.map((prestacion) => (
              <TableRow key={prestacion.id}>
                <TableCell>{prestacion.nombre}</TableCell>
                <TableCell>{prestacion.sesionesMaximas}</TableCell>
                <TableCell className="capitalize">{prestacion.periodo}</TableCell>
                <TableCell>
                  <Badge className="bg-coopGreen text-white">Activo</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

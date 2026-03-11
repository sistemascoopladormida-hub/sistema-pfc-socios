import { notFound } from "next/navigation";
import { CalendarDays, FileText, House, Mail, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSociosPFC } from "@/lib/readSociosExcel";

type SocioDetallePageProps = {
  params: {
    id: string;
  };
};

function valueOrFallback(value: string) {
  return value?.trim().length > 0 ? value : "No registrado";
}

type HistorialTurno = {
  fecha: string;
  hora: string;
  profesional: string;
  especialidad: string;
  estado: "Atendido" | "Pendiente" | "Ausente";
};

const historialTurnosMock: HistorialTurno[] = [
  {
    fecha: "12/02/2026",
    hora: "09:00",
    profesional: "Dr. Juan Perez",
    especialidad: "Clinica Medica",
    estado: "Atendido",
  },
  {
    fecha: "20/02/2026",
    hora: "10:30",
    profesional: "Lic. Maria Lopez",
    especialidad: "Psicologia",
    estado: "Atendido",
  },
  {
    fecha: "05/03/2026",
    hora: "11:00",
    profesional: "Dr. Carlos Diaz",
    especialidad: "Cardiologia",
    estado: "Pendiente",
  },
];

function getEstadoClass(estado: HistorialTurno["estado"]) {
  if (estado === "Atendido") return "bg-coopGreen text-white";
  if (estado === "Pendiente") return "bg-coopBlue text-white";
  return "bg-red-500 text-white";
}

export default async function SocioDetallePage({ params }: SocioDetallePageProps) {
  let socios;
  try {
    socios = await getSociosPFC();
  } catch {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Error al cargar socios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            No se pudo leer el archivo Excel. Verifica que exista en data/socios_pfc.xlsx (o en
            la raiz del proyecto).
          </p>
        </CardContent>
      </Card>
    );
  }
  const cuenta = decodeURIComponent(params.id);
  const socio = socios.find((item) => item.cuenta === cuenta);

  if (!socio) {
    notFound();
  }
  const historial = socio.numero_socio === "1787" ? historialTurnosMock : [];

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Detalle de Socio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-semibold">Cuenta:</span> {socio.cuenta}
          </p>
          <p>
            <span className="font-semibold">Numero de socio:</span>{" "}
            {valueOrFallback(socio.numero_socio)}
          </p>
          <p>
            <span className="font-semibold">Titular:</span> {valueOrFallback(socio.titular)}
          </p>
          <p>
            <span className="font-semibold">DNI:</span> {valueOrFallback(socio.dni)}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Contacto y Domicilio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="flex items-start gap-2">
            <House className="mt-0.5 h-4 w-4 text-coopGreen" />
            <div>
              <p className="font-semibold">Domicilio</p>
              <p>{valueOrFallback(socio.domicilio)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 text-coopGreen" />
            <div>
              <p className="font-semibold">Telefono Particular</p>
              <p>{valueOrFallback(socio.movil_particular)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 text-coopBlue" />
            <div>
              <p className="font-semibold">Telefono Cuenta</p>
              <p>{valueOrFallback(socio.movil_cuenta)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 text-coopOrange" />
            <div>
              <p className="font-semibold">Correo</p>
              <p>{valueOrFallback(socio.correo)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white animate-page-enter" style={{ animationDuration: "300ms" }}>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-coopBlue" />
            Historial de Turnos
          </CardTitle>
          <p className="text-sm text-slate-600">
            Consultas de especialistas registradas para este socio
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {historial.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-600">
              <FileText className="h-4 w-4 text-slate-400" />
              Este socio aun no posee turnos registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((item, index) => (
                  <TableRow key={`${item.fecha}-${item.hora}-${index}`}>
                    <TableCell>{item.fecha}</TableCell>
                    <TableCell>{item.hora}</TableCell>
                    <TableCell>{item.profesional}</TableCell>
                    <TableCell>{item.especialidad}</TableCell>
                    <TableCell>
                      <Badge className={getEstadoClass(item.estado)}>{item.estado}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Button variant="outline">Ver agenda completa del paciente</Button>
        </CardContent>
      </Card>
    </div>
  );
}

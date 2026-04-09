"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CalendarPlus2, CheckCircle2, CircleOff, Eye, XCircle } from "lucide-react";

import { TurnoDetalleModal } from "@/components/turnos/TurnoDetalleModal";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataBadge } from "@/components/ui/data-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessModule, useUser } from "@/lib/user-context";

type TurnoEstado = "RESERVADO" | "ATENDIDO" | "CANCELADO" | "AUSENTE";

type TurnoRow = {
  id: number;
  nombre: string;
  fecha: string;
  hora: string;
  estado: TurnoEstado | string;
  cod_soc: number | string;
  adherente_codigo: number | string;
  profesional: string;
  prestacion: string;
};

export default function TurnosPage() {
  const { role } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [turnos, setTurnos] = useState<TurnoRow[]>([]);
  const [turnoDetalleId, setTurnoDetalleId] = useState<number | null>(null);

  async function fetchTurnos() {
    const response = await fetch("/api/turnos", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: TurnoRow[]; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "No se pudieron cargar turnos");
    }
    setTurnos(data.data ?? []);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setIsLoading(true);
        await fetchTurnos();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar turnos");
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  function normalizeHora(raw: string) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return "";
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
    const match = trimmed.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return "";
    const [, hh, mm, ss] = match;
    return `${hh}:${mm}:${ss ?? "00"}`;
  }

  function toTurnoDateTime(turno: TurnoRow) {
    const fecha = String(turno.fecha).slice(0, 10);
    const hora = normalizeHora(String(turno.hora));
    if (!hora) return null;
    const parsed = new Date(`${fecha}T${hora}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function canMarkAsAtendido(turno: TurnoRow) {
    const estado = String(turno.estado).toUpperCase();
    if (estado !== "RESERVADO") return false;
    const turnoDate = toTurnoDateTime(turno);
    if (!turnoDate) return false;
    return turnoDate.getTime() <= Date.now();
  }

  function canMarkAsAusente(turno: TurnoRow) {
    return canMarkAsAtendido(turno);
  }

  async function updateEstado(turnoId: number, action: "cancelar" | "atender" | "ausente") {
    const response = await fetch(`/api/turnos/${turnoId}/${action}`, {
      method: "PUT",
    });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo actualizar el estado");
      return;
    }

    toast.success(data.message ?? "Estado actualizado");
    await fetchTurnos();
  }

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
    <div className="mx-auto space-y-6">
      <PageHeader
        title="Gestión de Turnos"
        breadcrumbs={["operación diaria"]}
        rightSlot={
          <Link href="/turnos/nuevo">
            <Button className="h-10 rounded-lg bg-[#0D6E5A] px-4 text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#0B5B4B]">
              <CalendarPlus2 className="mr-2 h-4 w-4" />
              Nuevo Turno
            </Button>
          </Link>
        }
      />

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.08em] text-pfcText-muted">
            Turnos y acciones
          </CardTitle>
        </CardHeader>
        <CardContent>
        {turnos.length === 0 ? (
          <EmptyState
            title="Sin turnos para mostrar"
            message="Todavía no hay turnos cargados en esta vista. Puedes crear uno nuevo para comenzar."
          />
        ) : (
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Adherente</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Profesional</TableHead>
                <TableHead>Prestacion</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnos.map((turno, idx) => (
                <motion.tr
                  key={turno.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  className="border-b"
                >
                  <TableCell>{turno.id}</TableCell>
                  <TableCell>{turno.cod_soc}</TableCell>
                  <TableCell>{turno.adherente_codigo}</TableCell>
                  <TableCell>{turno.nombre || "No registrado"}</TableCell>
                  <TableCell>{turno.profesional}</TableCell>
                  <TableCell>{turno.prestacion}</TableCell>

                  <TableCell>
                    {new Date(turno.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}
                  </TableCell>

                  <TableCell>{normalizeHora(String(turno.hora)).slice(0, 5) || "No registrada"}</TableCell>

                  <TableCell>
                    <DataBadge
                      kind={
                        String(turno.estado).toUpperCase() === "RESERVADO"
                          ? "reservado"
                          : String(turno.estado).toUpperCase() === "ATENDIDO"
                            ? "atendido"
                            : String(turno.estado).toUpperCase() === "AUSENTE"
                              ? "ausente"
                              : "cancelado"
                      }
                    >
                      {String(turno.estado)}
                    </DataBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        tone="slate"
                        icon={<Eye className="mr-1 h-3.5 w-3.5" />}
                        label="Detalle"
                        onClick={() => setTurnoDetalleId(turno.id)}
                      />
                      <ActionButton
                        tone="teal"
                        icon={<CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        label="Atendido"
                        onClick={() => updateEstado(turno.id, "atender")}
                        disabled={!canMarkAsAtendido(turno)}
                        title={canMarkAsAtendido(turno) ? "Marcar como atendido" : "Disponible al pasar horario"}
                      />
                      <ActionButton
                        tone="amber"
                        icon={<CircleOff className="mr-1 h-3.5 w-3.5" />}
                        label="Ausente"
                        onClick={() => updateEstado(turno.id, "ausente")}
                        disabled={!canMarkAsAusente(turno)}
                        title={canMarkAsAusente(turno) ? "Marcar como ausente" : "Disponible al pasar horario"}
                      />
                      <ActionButton
                        tone="red"
                        icon={<XCircle className="mr-1 h-3.5 w-3.5" />}
                        label="Cancelar"
                        onClick={() => updateEstado(turno.id, "cancelar")}
                        disabled={
                          String(turno.estado).toUpperCase() === "CANCELADO" ||
                          String(turno.estado).toUpperCase() === "ATENDIDO"
                        }
                      />
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      </Card>

      <TurnoDetalleModal
        isOpen={turnoDetalleId !== null}
        turnoId={turnoDetalleId}
        onClose={() => setTurnoDetalleId(null)}
        onSaved={() => {
          fetchTurnos().catch(() => {
            toast.error("No se pudo refrescar la lista de turnos");
          });
        }}
      />
    </div>
  );
}

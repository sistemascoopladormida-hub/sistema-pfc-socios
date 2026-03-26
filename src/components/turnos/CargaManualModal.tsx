"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface CargaManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  codSoc: number;
  adherenteCodigo: number;
  nombrePaciente: string;
}

type ProfesionalSimple = {
  id: number;
  nombre: string;
  especialidad_id: number;
};

type PrestacionSimple = {
  id: number;
  nombre: string;
  especialidad_id: number;
  especialidad_nombre: string;
};

type EstadoManual = "ATENDIDO" | "AUSENTE" | "CANCELADO";

const ESTADOS: EstadoManual[] = ["ATENDIDO", "AUSENTE", "CANCELADO"];

function todayAsInputDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function CargaManualModal({
  isOpen,
  onClose,
  onSuccess,
  codSoc,
  adherenteCodigo,
  nombrePaciente,
}: CargaManualModalProps) {
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profesionales, setProfesionales] = useState<ProfesionalSimple[]>([]);
  const [prestaciones, setPrestaciones] = useState<PrestacionSimple[]>([]);

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [prestacionId, setPrestacionId] = useState("");
  const [estado, setEstado] = useState<EstadoManual>("ATENDIDO");
  const [observacion, setObservacion] = useState("");

  const maxFecha = useMemo(() => todayAsInputDate(), []);
  const charsRemaining = 300 - observacion.length;

  const prestacionesAgrupadas = useMemo(() => {
    const grouped = new Map<string, PrestacionSimple[]>();
    for (const item of prestaciones) {
      const key = item.especialidad_nombre || "Sin especialidad";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(item);
    }
    return Array.from(grouped.entries()).map(([especialidad, items]) => ({
      especialidad,
      items,
    }));
  }, [prestaciones]);

  const isFormValid =
    Boolean(fecha) &&
    Boolean(hora) &&
    Boolean(profesionalId) &&
    Boolean(prestacionId) &&
    ESTADOS.includes(estado) &&
    fecha <= maxFecha;

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    async function loadOptions() {
      try {
        setLoadingData(true);
        setError(null);
        setObservacion("");

        const [profRes, presRes] = await Promise.all([
          fetch("/api/profesionales/listado-simple", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/prestaciones/listado-simple", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const profData = (await profRes.json()) as {
          success: boolean;
          profesionales?: ProfesionalSimple[];
          error?: string;
        };
        const presData = (await presRes.json()) as {
          success: boolean;
          prestaciones?: PrestacionSimple[];
          error?: string;
        };

        if (!profRes.ok || !profData.success) {
          throw new Error(profData.error ?? "No se pudieron cargar profesionales");
        }
        if (!presRes.ok || !presData.success) {
          throw new Error(presData.error ?? "No se pudieron cargar prestaciones");
        }

        setProfesionales(profData.profesionales ?? []);
        setPrestaciones(presData.prestaciones ?? []);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar opciones");
      } finally {
        setLoadingData(false);
      }
    }

    loadOptions();
    return () => controller.abort();
  }, [isOpen]);

  async function handleSubmit() {
    if (!isFormValid || saving || loadingData) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/turnos/carga-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cod_soc: codSoc,
          adherente_codigo: adherenteCodigo,
          profesional_id: Number(profesionalId),
          prestacion_id: Number(prestacionId),
          fecha,
          hora,
          estado,
          observacion: observacion.trim(),
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "No se pudo cargar la sesión");
      }

      toast.success("Sesión cargada correctamente");
      onSuccess();
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "No se pudo cargar la sesión";
      setError(message);
      toast.error("No se pudo cargar la sesión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={saving ? undefined : onClose}
        >
          <motion.div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Cargar sesión pasada</h3>
              <p className="text-sm text-slate-600">{nombrePaciente}</p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Estás cargando una sesión que ya ocurrió. Esta sesión afectará el conteo de
                  cobertura del paciente para el año en curso.
                </p>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {loadingData ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <fieldset className="space-y-3" disabled={saving}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Fecha de la sesión</label>
                      <Input
                        type="date"
                        max={maxFecha}
                        value={fecha}
                        onChange={(event) => setFecha(event.target.value)}
                        className="focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Hora</label>
                      <Input
                        type="time"
                        value={hora}
                        onChange={(event) => setHora(event.target.value)}
                        className="focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Profesional</label>
                    <select
                      value={profesionalId}
                      onChange={(event) => setProfesionalId(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    >
                      <option value="">Seleccionar profesional</option>
                      {profesionales.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Prestación</label>
                    <select
                      value={prestacionId}
                      onChange={(event) => setPrestacionId(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    >
                      <option value="">Seleccionar prestación</option>
                      {prestacionesAgrupadas.map((group) => (
                        <optgroup key={group.especialidad} label={group.especialidad}>
                          {group.items.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.nombre}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Estado</label>
                    <select
                      value={estado}
                      onChange={(event) => setEstado(event.target.value as EstadoManual)}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    >
                      <option value="ATENDIDO">ATENDIDO</option>
                      <option value="AUSENTE">AUSENTE</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Observación (opcional)</label>
                    <textarea
                      value={observacion}
                      maxLength={300}
                      onChange={(event) => setObservacion(event.target.value)}
                      placeholder="Notas adicionales sobre la sesión..."
                      className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                    />
                    <p className="text-right text-xs text-slate-500">
                      {charsRemaining} caracteres restantes
                    </p>
                  </div>
                </fieldset>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid || saving || loadingData}
                className="bg-[#0D6E5A] text-white hover:bg-[#0D6E5A]/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1 size-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar sesión"
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/ui/loading";
import { canAccessModule, useUser } from "@/lib/user-context";

type TurnoEstado = "RESERVADO" | "ATENDIDO" | "AUSENTE" | "CANCELADO";

type TurnoDetail = {
  id: number;
  cod_soc: number;
  adherente_codigo: number;
  socio_nombre: string;
  profesional_id: number;
  especialidad_id: number;
  prestacion_id: number;
  fecha: string | Date;
  hora: string | Date;
  estado: TurnoEstado | string;
  observaciones: string | null;
};

type Especialidad = { id: number; nombre: string };
type Prestacion = { id: number; nombre: string; especialidad_id: number };
type Profesional = {
  id: number;
  nombre: string;
  especialidad_id?: number;
};

type FormState = {
  profesional_id: string;
  especialidad_id: string;
  prestacion_id: string;
  fecha: string;
  hora: string;
  estado: TurnoEstado;
  observaciones: string;
};

function normalizeHora(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  const raw = String(value ?? "").trim();
  const hhmm = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) return `${hhmm[1]}:${hhmm[2]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(11, 16);
  }
  return "";
}

function normalizeFecha(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

export default function EditarTurnoPage() {
  const { role } = useUser();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const turnoId = useMemo(() => Number(params?.id), [params?.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [turno, setTurno] = useState<TurnoDetail | null>(null);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [form, setForm] = useState<FormState>({
    profesional_id: "",
    especialidad_id: "",
    prestacion_id: "",
    fecha: "",
    hora: "",
    estado: "RESERVADO",
    observaciones: "",
  });

  const selectedEspecialidadId = useMemo(() => Number(form.especialidad_id), [form.especialidad_id]);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (!Number.isInteger(turnoId) || turnoId <= 0) {
          throw new Error("Id de turno inválido");
        }
        setLoading(true);

        const [turnoRes, espRes] = await Promise.all([
          fetch(`/api/turnos/${turnoId}`, { cache: "no-store" }),
          fetch("/api/especialidades", { cache: "no-store" }),
        ]);
        const turnoData = (await turnoRes.json()) as { success: boolean; data?: TurnoDetail; error?: string };
        const espData = (await espRes.json()) as {
          success: boolean;
          data?: Especialidad[];
          error?: string;
        };

        if (!turnoRes.ok || !turnoData.success || !turnoData.data) {
          throw new Error(turnoData.error ?? "No se pudo cargar el turno");
        }
        if (!espRes.ok || !espData.success) {
          throw new Error(espData.error ?? "No se pudieron cargar especialidades");
        }

        const data = turnoData.data;
        setTurno(data);
        setEspecialidades(espData.data ?? []);
        setForm({
          profesional_id: String(data.profesional_id),
          especialidad_id: String(data.especialidad_id),
          prestacion_id: String(data.prestacion_id),
          fecha: normalizeFecha(data.fecha),
          hora: normalizeHora(data.hora),
          estado: String(data.estado).toUpperCase() as TurnoEstado,
          observaciones: String(data.observaciones ?? ""),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el turno");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [turnoId]);

  useEffect(() => {
    async function loadDependencias() {
      if (!Number.isInteger(selectedEspecialidadId) || selectedEspecialidadId <= 0) {
        setPrestaciones([]);
        setProfesionales([]);
        return;
      }

      const [prestRes, profRes] = await Promise.all([
        fetch(`/api/especialidades/${selectedEspecialidadId}/prestaciones`, { cache: "no-store" }),
        fetch(`/api/profesionales?especialidad_id=${selectedEspecialidadId}`, { cache: "no-store" }),
      ]);
      const prestData = (await prestRes.json()) as {
        success: boolean;
        data?: Prestacion[];
        error?: string;
      };
      const profData = (await profRes.json()) as {
        success: boolean;
        data?: Profesional[];
        error?: string;
      };
      if (!prestRes.ok || !prestData.success) {
        toast.error(prestData.error ?? "No se pudieron cargar prestaciones");
        return;
      }
      if (!profRes.ok || !profData.success) {
        toast.error(profData.error ?? "No se pudieron cargar profesionales");
        return;
      }
      setPrestaciones(prestData.data ?? []);
      setProfesionales(profData.data ?? []);
    }

    loadDependencias();
  }, [selectedEspecialidadId]);

  async function handleGuardar() {
    if (!turno) return;

    const payload = {
      profesional_id: Number(form.profesional_id),
      especialidad_id: Number(form.especialidad_id),
      prestacion_id: Number(form.prestacion_id),
      fecha: form.fecha,
      hora: form.hora,
      estado: form.estado,
      observaciones: form.observaciones,
    };

    if (
      !payload.profesional_id ||
      !payload.especialidad_id ||
      !payload.prestacion_id ||
      !payload.fecha ||
      !payload.hora
    ) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/turnos/${turno.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { success: boolean; error?: string; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "No se pudo actualizar el turno");
      }
      toast.success(data.message ?? "Turno actualizado correctamente");
      router.push("/turnos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el turno");
    } finally {
      setSaving(false);
    }
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

  if (loading || !turno) {
    return <Loading label="Cargando detalle del turno..." />;
  }

  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Detalle y actualización del turno #{turno.id}</CardTitle>
        <Link href="/turnos">
          <Button variant="outline">Volver a turnos</Button>
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Socio</span>
          <input
            className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm"
            value={String(turno.cod_soc)}
            readOnly
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Adherente</span>
          <input
            className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm"
            value={String(turno.adherente_codigo)}
            readOnly
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span>Paciente</span>
          <input
            className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm"
            value={turno.socio_nombre}
            readOnly
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Especialidad</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.especialidad_id}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                especialidad_id: event.target.value,
                profesional_id: "",
                prestacion_id: "",
              }))
            }
          >
            <option value="">Seleccionar</option>
            {especialidades.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Profesional</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.profesional_id}
            onChange={(event) => setForm((prev) => ({ ...prev, profesional_id: event.target.value }))}
          >
            <option value="">Seleccionar</option>
            {profesionales.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Prestación</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.prestacion_id}
            onChange={(event) => setForm((prev) => ({ ...prev, prestacion_id: event.target.value }))}
          >
            <option value="">Seleccionar</option>
            {prestaciones.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Estado</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.estado}
            onChange={(event) => setForm((prev) => ({ ...prev, estado: event.target.value as TurnoEstado }))}
          >
            <option value="RESERVADO">RESERVADO</option>
            <option value="ATENDIDO">ATENDIDO</option>
            <option value="AUSENTE">AUSENTE</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Fecha</span>
          <input
            type="date"
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.fecha}
            onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Hora</span>
          <input
            type="time"
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.hora}
            onChange={(event) => setForm((prev) => ({ ...prev, hora: event.target.value }))}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span>Observaciones</span>
          <input
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.observaciones}
            onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
          />
        </label>

        <div className="sm:col-span-2">
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


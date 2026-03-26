"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { canAccessModule, useUser } from "@/lib/user-context";

type SocioGrupoRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
};
type SocioSearchRow = SocioGrupoRow;

type Especialidad = { id: number; nombre: string };
type Prestacion = { id: number; nombre: string; especialidad_id: number };
type Profesional = {
  id: number;
  nombre: string;
  especialidad: string;
  pacientes_mensuales?: number | null;
  turnos_mes?: number | null;
  cupo_restante?: number | null;
};
type AgendaProfesionalRow = { dia_semana: unknown };
type FechaOption = { value: string; label: string };
type CoberturaPacienteItem = {
  prestacion_id: number;
  prestacion: string;
  especialidad: string;
  maximo: number;
  utilizadas: number;
  restantes: number;
};

type FormState = {
  cod_soc: string;
  adherente_codigo: string;
  nombre: string;
  categoria: string;
  especialidad_id: string;
  prestacion_id: string;
  profesional_id: string;
  fecha: string;
  hora: string;
  observaciones: string;
};

const emptyForm: FormState = {
  cod_soc: "",
  adherente_codigo: "",
  nombre: "",
  categoria: "",
  especialidad_id: "",
  prestacion_id: "",
  profesional_id: "",
  fecha: "",
  hora: "",
  observaciones: "",
};

export default function NuevoTurnoPage() {
  const { role } = useUser();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [grupo, setGrupo] = useState<SocioGrupoRow[]>([]);
  const [socioSearch, setSocioSearch] = useState("");
  const [socioResults, setSocioResults] = useState<SocioSearchRow[]>([]);
  const [searchingSocios, setSearchingSocios] = useState(false);
  const [showSocioResults, setShowSocioResults] = useState(false);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [disponibles, setDisponibles] = useState<string[]>([]);
  const [fechasDisponibles, setFechasDisponibles] = useState<FechaOption[]>([]);
  const [coberturaPaciente, setCoberturaPaciente] = useState<CoberturaPacienteItem[]>([]);
  const [loadingCobertura, setLoadingCobertura] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const selectedEspecialidadId = useMemo(() => Number(form.especialidad_id), [form.especialidad_id]);
  const selectedProfesionalId = useMemo(() => Number(form.profesional_id), [form.profesional_id]);
  const selectedPrestacionId = useMemo(() => Number(form.prestacion_id), [form.prestacion_id]);
  const selectedProfesional = useMemo(
    () => profesionales.find((item) => Number(item.id) === selectedProfesionalId) ?? null,
    [profesionales, selectedProfesionalId]
  );
  const coberturaPrestacionSeleccionada = useMemo(
    () =>
      coberturaPaciente.find((item) => Number(item.prestacion_id) === selectedPrestacionId) ?? null,
    [coberturaPaciente, selectedPrestacionId]
  );
  const coberturaEspecialidadSeleccionada = useMemo(() => {
    if (!Number.isInteger(selectedEspecialidadId) || selectedEspecialidadId <= 0) return null;
    const prestacionesEspecialidad = prestaciones.filter(
      (item) => Number(item.especialidad_id) === selectedEspecialidadId
    );
    const ids = new Set(prestacionesEspecialidad.map((item) => Number(item.id)));
    const matches = coberturaPaciente.filter((item) => ids.has(Number(item.prestacion_id)));
    if (matches.length === 0) return null;
    return matches.reduce(
      (acc, item) => ({
        maximo: acc.maximo + Number(item.maximo ?? 0),
        utilizadas: acc.utilizadas + Number(item.utilizadas ?? 0),
        restantes: acc.restantes + Number(item.restantes ?? 0),
      }),
      { maximo: 0, utilizadas: 0, restantes: 0 }
    );
  }, [coberturaPaciente, prestaciones, selectedEspecialidadId]);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        const params = new URLSearchParams(window.location.search);
        const codSoc = String(params.get("cod_soc") ?? "");
        const adherente = String(params.get("adherente") ?? "");
        const nombre = String(params.get("nombre") ?? "");
        const categoria = String(params.get("categoria") ?? "");

        setForm((prev) => ({
          ...prev,
          cod_soc: codSoc,
          adherente_codigo: adherente,
          nombre,
          categoria,
        }));

        await fetchEspecialidades();
        if (codSoc) {
          await fetchGrupo(codSoc);
          setSocioSearch(
            nombre
              ? `${codSoc} - ${nombre}`
              : `Socio ${codSoc}`
          );
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo inicializar el formulario");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    async function loadPrestaciones() {
      if (!Number.isInteger(selectedEspecialidadId) || selectedEspecialidadId <= 0) {
        setPrestaciones([]);
        setProfesionales([]);
        setForm((prev) => ({ ...prev, prestacion_id: "", profesional_id: "", hora: "" }));
        return;
      }

      if (!form.categoria) {
        setPrestaciones([]);
        setForm((prev) => ({ ...prev, prestacion_id: "" }));
        return;
      }

      const [prestacionesRes, profesionalesRes] = await Promise.all([
        fetch(
          `/api/prestaciones-disponibles?categoria=${encodeURIComponent(form.categoria)}&especialidad_id=${selectedEspecialidadId}`,
          { cache: "no-store" }
        ),
        fetch(`/api/profesionales?especialidad_id=${selectedEspecialidadId}`, { cache: "no-store" }),
      ]);
      const prestacionesData = (await prestacionesRes.json()) as {
        success: boolean;
        data?: Prestacion[];
        error?: string;
      };
      const profesionalesData = (await profesionalesRes.json()) as {
        success: boolean;
        data?: Profesional[];
        error?: string;
      };

      if (!prestacionesRes.ok || !prestacionesData.success) {
        toast.error(prestacionesData.error ?? "No se pudieron cargar prestaciones");
        return;
      }
      if (!profesionalesRes.ok || !profesionalesData.success) {
        toast.error(profesionalesData.error ?? "No se pudieron cargar profesionales");
        return;
      }

      setPrestaciones(prestacionesData.data ?? []);
      setProfesionales(profesionalesData.data ?? []);
      if ((prestacionesData.data ?? []).length === 0) {
        toast.error("Este paciente no tiene cobertura para esta especialidad (segun su plan)");
      }
    }

    loadPrestaciones();
  }, [form.categoria, selectedEspecialidadId]);

  useEffect(() => {
    async function loadDisponibilidad() {
      if (!Number.isInteger(selectedProfesionalId) || selectedProfesionalId <= 0 || !form.fecha) {
        setDisponibles([]);
        setForm((prev) => ({ ...prev, hora: "" }));
        return;
      }

      const response = await fetch(
        `/api/profesionales/${selectedProfesionalId}/disponibilidad?fecha=${encodeURIComponent(form.fecha)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as { success: boolean; disponibles?: string[]; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudieron cargar horarios");
        return;
      }

      setDisponibles(data.disponibles ?? []);
    }

    loadDisponibilidad();
  }, [selectedProfesionalId, form.fecha]);

  useEffect(() => {
    async function loadFechasByProfesional() {
      if (!Number.isInteger(selectedProfesionalId) || selectedProfesionalId <= 0) {
        setFechasDisponibles([]);
        setForm((prev) => ({ ...prev, fecha: "", hora: "" }));
        return;
      }

      const response = await fetch(`/api/agenda-profesional/${selectedProfesionalId}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        success: boolean;
        data?: AgendaProfesionalRow[];
        error?: string;
      };

      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo cargar agenda del profesional");
        setFechasDisponibles([]);
        setForm((prev) => ({ ...prev, fecha: "", hora: "" }));
        return;
      }

      const dias = [...new Set((data.data ?? []).map((item) => parseAgendaDay(item.dia_semana)))].filter(
        (dia): dia is number => Number.isInteger(dia) && dia >= 1 && dia <= 7
      );

      const nextDates = buildEnabledDates(dias, 90);
      setFechasDisponibles(nextDates);
      setForm((prev) => ({
        ...prev,
        fecha: nextDates[0]?.value ?? "",
        hora: "",
      }));
    }

    loadFechasByProfesional();
  }, [selectedProfesionalId]);

  useEffect(() => {
    if (!showSocioResults) return;

    const query = socioSearch.trim();
    if (query.length < 2) {
      setSocioResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingSocios(true);
        const response = await fetch(`/api/socios?buscar=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          success: boolean;
          data?: SocioSearchRow[];
          error?: string;
        };

        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "No se pudieron buscar socios");
        }

        setSocioResults(data.data ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron buscar socios");
      } finally {
        setSearchingSocios(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [socioSearch, showSocioResults]);

  useEffect(() => {
    async function loadCoberturaPaciente() {
      const codSoc = Number(form.cod_soc);
      const adherente = Number(form.adherente_codigo);
      if (!Number.isInteger(codSoc) || codSoc <= 0 || !Number.isInteger(adherente) || adherente < 0) {
        setCoberturaPaciente([]);
        return;
      }

      try {
        setLoadingCobertura(true);
        const response = await fetch(
          `/api/historial-completo?cod_soc=${encodeURIComponent(String(codSoc))}&adherente_codigo=${encodeURIComponent(String(adherente))}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as {
          success: boolean;
          data?: { cobertura?: CoberturaPacienteItem[] };
          error?: string;
        };
        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "No se pudo cargar cobertura del paciente");
        }
        setCoberturaPaciente(data.data?.cobertura ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cargar cobertura del paciente"
        );
      } finally {
        setLoadingCobertura(false);
      }
    }

    loadCoberturaPaciente();
  }, [form.cod_soc, form.adherente_codigo]);

  async function fetchEspecialidades() {
    const response = await fetch("/api/especialidades", { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: Especialidad[]; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "No se pudieron cargar especialidades");
    }
    setEspecialidades(data.data ?? []);
  }

  async function fetchGrupo(codSoc: string) {
    const response = await fetch(`/api/socios/${encodeURIComponent(codSoc)}`, { cache: "no-store" });
    const data = (await response.json()) as { success: boolean; data?: SocioGrupoRow[]; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "No se pudo cargar grupo familiar");
    }
    setGrupo(data.data ?? []);
  }

  async function handleSelectSocio(row: SocioSearchRow) {
    const codSoc = String(row.COD_SOC);
    const adherente = String(row.ADHERENTE_CODIGO);
    const nombre = row.ADHERENTE_NOMBRE || row.APELLIDOS || "";

    setSocioSearch(`${codSoc} - ${nombre}`);
    setShowSocioResults(false);
    setSocioResults([]);

    setForm((prev) => ({
      ...prev,
      cod_soc: codSoc,
      adherente_codigo: adherente,
      nombre,
      categoria: row.DES_CAT || prev.categoria,
      especialidad_id: "",
      prestacion_id: "",
      profesional_id: "",
      fecha: "",
      hora: "",
    }));

    await fetchGrupo(codSoc);
  }

  async function handleGuardar() {
    const restanteProfesional = Number(selectedProfesional?.cupo_restante ?? NaN);
    const cupoProfesional = Number(selectedProfesional?.pacientes_mensuales ?? NaN);
    if (
      Number.isFinite(cupoProfesional) &&
      cupoProfesional > 0 &&
      Number.isFinite(restanteProfesional) &&
      restanteProfesional <= 0
    ) {
      toast.error("El profesional alcanzó su límite mensual de pacientes");
      return;
    }

    const payload = {
      cod_soc: Number(form.cod_soc),
      adherente_codigo: Number(form.adherente_codigo),
      profesional_id: Number(form.profesional_id),
      especialidad_id: Number(form.especialidad_id),
      prestacion_id: Number(form.prestacion_id),
      categoria: form.categoria || "CAT 1",
      fecha: form.fecha,
      hora: form.hora,
      observaciones: form.observaciones,
    };

    if (
      !payload.cod_soc ||
      payload.adherente_codigo < 0 ||
      !payload.profesional_id ||
      !payload.especialidad_id ||
      !payload.prestacion_id ||
      !payload.fecha ||
      !payload.hora
    ) {
      toast.error("Completa todos los datos obligatorios");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo crear el turno");
        return;
      }

      setSuccessModalOpen(true);
      window.setTimeout(() => {
        window.location.href = "/turnos";
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelectPersona(value: string) {
    const selected = grupo.find((item) => String(item.ADHERENTE_CODIGO) === value);
    setForm((prev) => ({
      ...prev,
      adherente_codigo: value,
      nombre: selected?.ADHERENTE_NOMBRE || selected?.APELLIDOS || prev.nombre,
      categoria: selected?.DES_CAT || prev.categoria,
      especialidad_id: "",
      prestacion_id: "",
      profesional_id: "",
      fecha: "",
      hora: "",
    }));
  }

  function agendaDayFromDate(date: Date) {
    const jsDay = date.getDay();
    return jsDay === 0 ? 7 : jsDay;
  }

  function parseAgendaDay(raw: unknown) {
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) {
      return numeric;
    }

    const normalized = String(raw ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const map: Record<string, number> = {
      lunes: 1,
      martes: 2,
      miercoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
      domingo: 7,
    };
    return map[normalized];
  }

  function buildEnabledDates(diasHabilitados: number[], daysForward: number): FechaOption[] {
    const enabled = new Set(diasHabilitados);
    const formatter = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const results: FechaOption[] = [];

    for (let i = 0; i < daysForward; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const agendaDay = agendaDayFromDate(date);
      if (!enabled.has(agendaDay)) {
        continue;
      }

      const value = date.toISOString().slice(0, 10);
      const label = formatter.format(date);
      results.push({ value, label });
    }

    return results;
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

  if (loading) {
    return <Loading label="Cargando formulario de turno..." />;
  }

  return (
    <>
      <Card className="bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Nuevo Turno</CardTitle>
          <Link href="/turnos">
            <Button variant="outline">Volver a turnos</Button>
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Socio</span>
          <div className="relative">
            <Input
              value={socioSearch}
              onFocus={() => setShowSocioResults(true)}
              onChange={(event) => {
                setSocioSearch(event.target.value);
                setShowSocioResults(true);
              }}
              placeholder="Buscar por apellido, DNI o numero de socio..."
            />
            {showSocioResults && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-md">
                {searchingSocios ? (
                  <p className="px-3 py-2 text-sm text-slate-500">Buscando socios...</p>
                ) : socioResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    Escribe al menos 2 caracteres para buscar.
                  </p>
                ) : (
                  socioResults.map((row) => {
                    const name = row.ADHERENTE_NOMBRE || row.APELLIDOS || "Sin nombre";
                    return (
                      <button
                        type="button"
                        key={`${row.COD_SOC}-${row.ADHERENTE_CODIGO}-${row.DNI_ADHERENTE}`}
                        className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          handleSelectSocio(row);
                        }}
                      >
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-slate-500">
                          Socio {row.COD_SOC} - DNI {row.DNI_ADHERENTE || "No registrado"} -{" "}
                          {row.VINCULO}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Integrante del grupo</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.adherente_codigo}
            onChange={(event) => handleSelectPersona(event.target.value)}
            disabled={!form.cod_soc}
          >
            <option value="">Seleccionar</option>
            {grupo.map((item) => (
              <option key={item.ADHERENTE_CODIGO} value={String(item.ADHERENTE_CODIGO)}>
                {(item.ADHERENTE_NOMBRE || item.APELLIDOS) ?? "Sin nombre"} - {item.VINCULO}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Nombre</span>
          <Input value={form.nombre} disabled />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Categoria</span>
          <Input value={form.categoria} disabled />
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
                prestacion_id: "",
                profesional_id: "",
                hora: "",
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
          <span>Prestacion</span>
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
          {/* {loadingCobertura ? (
            <p className="text-xs text-slate-500">Consultando cobertura...</p>
          ) : coberturaPrestacionSeleccionada ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              Cobertura prestación: {coberturaPrestacionSeleccionada.utilizadas} /{" "}
              {coberturaPrestacionSeleccionada.maximo} usadas — Restantes:{" "}
              <span className="font-semibold">{coberturaPrestacionSeleccionada.restantes}</span>
            </div>
          ) : form.prestacion_id ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              Esta prestación no tiene cobertura disponible para este paciente.
            </div>
          ) : null} */}
        </label>

        <label className="grid gap-1 text-sm">
          <span>Cobertura anual en especialidad</span>
          <div className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm flex items-center">
            {loadingCobertura
              ? "Consultando..."
              : coberturaEspecialidadSeleccionada
                ? `${coberturaEspecialidadSeleccionada.utilizadas} / ${coberturaEspecialidadSeleccionada.maximo} usadas — Restantes: ${coberturaEspecialidadSeleccionada.restantes}`
                : "Selecciona especialidad para ver cobertura"}
          </div>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Profesional</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.profesional_id}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, profesional_id: event.target.value, fecha: "", hora: "" }))
            }
          >
            <option value="">Seleccionar</option>
            {profesionales.map((item) => (
              <option
                key={item.id}
                value={String(item.id)}
                disabled={
                  Number.isFinite(Number(item.pacientes_mensuales)) &&
                  Number(item.pacientes_mensuales) > 0 &&
                  Number(item.cupo_restante ?? 0) <= 0
                }
              >
                {item.nombre} - {item.especialidad}
                {Number.isFinite(Number(item.pacientes_mensuales)) && Number(item.pacientes_mensuales) > 0
                  ? ` (restantes ${Math.max(Number(item.cupo_restante ?? 0), 0)} de ${Number(item.pacientes_mensuales)})`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Fecha</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.fecha}
            onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value, hora: "" }))}
            disabled={!form.profesional_id || fechasDisponibles.length === 0}
          >
            <option value="">
              {!form.profesional_id
                ? "Selecciona profesional"
                : fechasDisponibles.length === 0
                  ? "Sin dias habilitados"
                  : "Seleccionar fecha"}
            </option>
            {fechasDisponibles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Horario disponible</span>
          <select
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm"
            value={form.hora}
            onChange={(event) => setForm((prev) => ({ ...prev, hora: event.target.value }))}
          >
            <option value="">Seleccionar</option>
            {disponibles.map((hora) => (
              <option key={hora} value={hora}>
                {hora}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm sm:col-span-2">
          <span>Observaciones</span>
          <Input
            value={form.observaciones}
            onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
          />
        </label>

          <div className="sm:col-span-2">
            <Button
              className="bg-coopBlue text-white hover:bg-coopSecondary"
              onClick={handleGuardar}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Confirmar turno"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={successModalOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-coopGreen">
              <CheckCircle2 className="h-5 w-5" />
              Turno registrado exitosamente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            El turno fue guardado correctamente. Serás redirigido al módulo de turnos en unos
            segundos.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PlusCircle, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { CargaManualModal } from "@/components/turnos/CargaManualModal";
import { TurnoDetalleModal } from "@/components/turnos/TurnoDetalleModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { ROLES } from "@/lib/roles";
import { useUser } from "@/lib/user-context";

type HistorialItem = {
  turno_id: number;
  fecha: string | Date;
  hora: string | Date;
  estado_turno: string;
  es_carga_manual?: boolean | number;
  prestacion_id: number;
  prestacion: string;
  profesional_id: number;
  profesional: string;
  estado_atencion: string | null;
};

type FamiliaHistorialItem = HistorialItem & {
  adherente_codigo: number;
  familiar_nombre: string;
  familiar_vinculo: string;
};

type FamiliaHistorialApiResponse = {
  success: boolean;
  data?: {
    items: FamiliaHistorialItem[];
    categoria: string | null;
    mensaje: string | null;
  };
  error?: string;
};

type CoberturaItem = {
  prestacion_id: number;
  prestacion: string;
  especialidad: string;
  maximo: number;
  utilizadas: number;
  restantes: number;
};

type HistorialCompletoResponse = {
  success: boolean;
  data?: {
    historial: HistorialItem[];
    cobertura: CoberturaItem[];
    categoria: string | null;
    paciente?: {
      codSoc: string;
      adherenteCodigo: string;
      nombre: string;
      vinculo: string;
      dni: string;
      edad: number | null;
      tipoBeneficio?: "PROPIO" | "TITULAR" | "NO_DEFINIDO" | string;
    } | null;
    resumen: {
      total_turnos: number;
      atendidos: number;
      cancelados: number;
      ausentes: number;
    };
  };
  error?: string;
};

type PacienteInfo = {
  codSoc: string;
  adherenteCodigo: string;
  nombre: string;
  vinculo: string;
  dni: string;
  edad: string;
};

function toFecha(value: string | Date) {
  return new Date(value).toLocaleDateString("es-AR", { timeZone: "UTC" });
}

function toHora(value: string | Date) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "Sin hora";
    return value.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "Sin hora";

  const hhmmMatch = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    return `${hhmmMatch[1]}:${hhmmMatch[2]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
  }

  return "Sin hora";
}

function progressColor(percent: number) {
  if (percent >= 100) return "bg-red-600";
  if (percent >= 80) return "bg-amber-500";
  return "bg-coopGreen";
}

function estadoClass(estado: string) {
  const normalized = String(estado).toUpperCase();
  if (normalized === "ATENDIDO") return "bg-coopGreen text-white";
  if (normalized === "RESERVADO") return "bg-coopBlue text-white";
  if (normalized === "AUSENTE") return "bg-red-600 text-white";
  return "bg-slate-500 text-white";
}

function normalizeText(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getPsicologiaTipo(value: string) {
  const normalized = normalizeText(value);
  if (!normalized.includes("PSICOLOGIA")) return null;
  if (normalized.includes("INFANTIL")) return "Infantil";
  if (normalized.includes("ADULTO")) return "Adulto";
  return "Psicología";
}

export default function HistorialSocioPage() {
  const params = useParams<{ id: string; adherente: string }>();
  const { role } = useUser();
  const codSoc = useMemo(() => Number(params?.id), [params?.id]);
  const adherente = useMemo(() => Number(params?.adherente), [params?.adherente]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [cobertura, setCobertura] = useState<CoberturaItem[]>([]);
  const [resumen, setResumen] = useState({
    total_turnos: 0,
    atendidos: 0,
    cancelados: 0,
    ausentes: 0,
  });
  const [categoria, setCategoria] = useState<string>("");
  const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isCargaManualOpen, setIsCargaManualOpen] = useState(false);
  const [turnoDetalleId, setTurnoDetalleId] = useState<number | null>(null);
  const [familiaDialogOpen, setFamiliaDialogOpen] = useState(false);
  const [familiaLoading, setFamiliaLoading] = useState(false);
  const [familiaError, setFamiliaError] = useState<string | null>(null);
  const [familiaItems, setFamiliaItems] = useState<FamiliaHistorialItem[]>([]);
  const [familiaMensaje, setFamiliaMensaje] = useState<string | null>(null);
  const canManualLoad = role === ROLES.ADMIN || role === ROLES.DEVELOPER;
  const canDeleteTurno = role === ROLES.ADMIN || role === ROLES.DEVELOPER;
  const podologiaResumen = useMemo(() => {
    const categoriaNormalizada = normalizeText(categoria);
    const isPlus = categoriaNormalizada.includes("PLUS");
    const isBasica = categoriaNormalizada.includes("BASICA");
    if (!isPlus && !isBasica) return null;

    const podologiaItems = cobertura.filter((item) => {
      const prestacion = normalizeText(item.prestacion);
      const especialidad = normalizeText(item.especialidad);
      return prestacion.includes("PODOLOGIA") || especialidad.includes("PODOLOGIA");
    });

    if (podologiaItems.length === 0) return null;

    const usadas = podologiaItems.reduce((acc, item) => acc + Number(item.utilizadas ?? 0), 0);
    const maximoCompartido = isPlus ? 6 : 1;
    const restantes = Math.max(maximoCompartido - usadas, 0);
    const percent = Math.min((usadas / maximoCompartido) * 100, 100);

    return {
      isPlus,
      isBasica,
      usadas,
      maximoCompartido,
      restantes,
      percent,
      prestaciones: podologiaItems.map((item) => item.prestacion),
    };
  }, [categoria, cobertura]);
  const psicologiaBasicaResumen = useMemo(() => {
    const categoriaNormalizada = normalizeText(categoria);
    if (!categoriaNormalizada.includes("BASICA")) return null;
    const psicologiaItems = cobertura.filter((item) => getPsicologiaTipo(item.prestacion) !== null);
    if (psicologiaItems.length === 0) return null;
    const usadas = Number(psicologiaItems[0]?.utilizadas ?? 0);
    const maximoCompartido = 12;
    const restantes = Math.max(maximoCompartido - usadas, 0);
    return { usadas, maximoCompartido, restantes };
  }, [categoria, cobertura]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/historial-completo?cod_soc=${encodeURIComponent(String(codSoc))}&adherente_codigo=${encodeURIComponent(String(adherente))}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const data = (await response.json()) as HistorialCompletoResponse;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "No se pudo cargar historial");
        }

        setHistorial(data.data.historial ?? []);
        setCobertura(data.data.cobertura ?? []);
        setCategoria(data.data.categoria ?? "");
        setPaciente(
          data.data.paciente
            ? {
                codSoc: String(data.data.paciente.codSoc ?? codSoc),
                adherenteCodigo: String(data.data.paciente.adherenteCodigo ?? adherente),
                nombre: String(data.data.paciente.nombre || "No registrado"),
                vinculo: String(data.data.paciente.vinculo || "No registrado"),
                dni: String(data.data.paciente.dni || "No registrado"),
                edad: Number.isFinite(Number(data.data.paciente.edad))
                  ? `${Number(data.data.paciente.edad)} años`
                  : "Sin dato",
              }
            : null
        );
        setResumen(
          data.data.resumen ?? {
            total_turnos: 0,
            atendidos: 0,
            cancelados: 0,
            ausentes: 0,
          }
        );
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar historial");
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isInteger(codSoc) || codSoc <= 0 || !Number.isInteger(adherente) || adherente < 0) {
      setLoading(false);
      setError("Parametros invalidos para historial");
      return () => controller.abort();
    }

    loadData();
    return () => controller.abort();
  }, [adherente, codSoc, reloadToken]);

  useEffect(() => {
    if (!familiaDialogOpen) return;

    const controller = new AbortController();

    async function loadFamiliaHistorial() {
      try {
        setFamiliaLoading(true);
        setFamiliaError(null);
        setFamiliaMensaje(null);

        const response = await fetch(
          `/api/historial-familia-compartida?cod_soc=${encodeURIComponent(String(codSoc))}&adherente_codigo=${encodeURIComponent(String(adherente))}`,
          { cache: "no-store", signal: controller.signal }
        );
        const data = (await response.json()) as FamiliaHistorialApiResponse;
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error ?? "No se pudo cargar el historial familiar");
        }
        setFamiliaItems(Array.isArray(data.data.items) ? data.data.items : []);
        setFamiliaMensaje(data.data.mensaje ?? null);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setFamiliaError(loadError instanceof Error ? loadError.message : "Error al cargar el historial familiar");
        setFamiliaItems([]);
      } finally {
        setFamiliaLoading(false);
      }
    }

    if (!Number.isInteger(codSoc) || codSoc <= 0 || !Number.isInteger(adherente) || adherente < 0) {
      setFamiliaError("Parámetros inválidos");
      setFamiliaLoading(false);
      return () => controller.abort();
    }

    loadFamiliaHistorial();
    return () => controller.abort();
  }, [familiaDialogOpen, codSoc, adherente]);

  async function handleDeleteTurno(turnoId: number) {
    if (!canDeleteTurno) return;

    const confirmar = window.confirm(
      "¿Deseas eliminar este turno? Esta acción eliminará también su historial asociado y no se puede deshacer."
    );
    if (!confirmar) return;

    try {
      const response = await fetch(`/api/turnos/${turnoId}`, { method: "DELETE" });
      const data = (await response.json()) as { success: boolean; error?: string; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "No se pudo eliminar el turno");
      }
      toast.success(data.message ?? "Turno eliminado");
      setReloadToken((prev) => prev + 1);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el turno");
    }
  }

  if (loading) {
    return <Loading label="Cargando historial completo..." />;
  }

  if (error) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">{error}</p>
          <Link href={`/socios/${encodeURIComponent(String(codSoc))}`}>
            <Button variant="outline">Volver al socio</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historial Completo del Paciente</CardTitle>
          <Link href={`/socios/${encodeURIComponent(String(codSoc))}`}>
            <Button variant="outline">Volver</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {paciente?.nombre ?? "No registrado"}
              </p>
              <span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                DNI: {paciente?.dni ?? "No registrado"}
              </span>
              <span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                {paciente?.vinculo ?? "No registrado"}
              </span>
            </div>

            <div className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
              <p>
                <span className="font-medium text-slate-700">Edad:</span> {paciente?.edad ?? "Sin dato"}
              </p>
              <p>
                <span className="font-medium text-slate-700">Socio:</span> {paciente?.codSoc ?? String(codSoc)}
              </p>
              <p>
                <span className="font-medium text-slate-700">Código adherente:</span>{" "}
                {paciente?.adherenteCodigo ?? String(adherente)}
              </p>
              {categoria ? (
                <p>
                  <span className="font-medium text-slate-700">Plan:</span> {categoria}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Total turnos</p>
              <p className="text-2xl font-semibold">{resumen.total_turnos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Atendidos</p>
              <p className="text-2xl font-semibold text-coopGreen">{resumen.atendidos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Cancelados</p>
              <p className="text-2xl font-semibold text-slate-600">{resumen.cancelados}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500">Ausentes</p>
              <p className="text-2xl font-semibold text-red-600">{resumen.ausentes}</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Cobertura del Paciente</CardTitle>
          {categoria ? <p className="text-sm text-slate-600">Plan: {categoria} | {}</p> : null}
        </CardHeader>
        <CardContent>
          {cobertura.length === 0 ? (
            <EmptyState message="No hay cobertura configurada." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cobertura.map((item) => {
                  const percent = item.maximo > 0 ? Math.min((item.utilizadas / item.maximo) * 100, 100) : 0;
                  const sinCobertura = item.maximo <= 0;
                  const esPodologia =
                    normalizeText(item.prestacion).includes("PODOLOGIA") ||
                    normalizeText(item.especialidad).includes("PODOLOGIA");
                  return (
                    <Card key={item.prestacion_id} className={sinCobertura ? "border-red-300" : ""}>
                      <CardContent className="space-y-3 pt-4">
                        <p className="font-medium">{item.prestacion}</p>
                        <p className="text-xs text-slate-500">{item.especialidad}</p>
                        {getPsicologiaTipo(item.prestacion) ? (
                          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                            Tipo de sesión:{" "}
                            <span className="font-semibold">{getPsicologiaTipo(item.prestacion)}</span>
                          </div>
                        ) : null}
                        {podologiaResumen && esPodologia ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                            Sesiones compartidas de podología ({podologiaResumen.isPlus ? "CAT PLUS" : "CAT BÁSICA"}):{" "}
                            <span className="font-semibold">
                              {podologiaResumen.usadas} / {podologiaResumen.maximoCompartido}
                            </span>{" "}
                            - Restantes: <span className="font-semibold">{podologiaResumen.restantes}</span>
                          </div>
                        ) : null}
                        {psicologiaBasicaResumen && getPsicologiaTipo(item.prestacion) ? (
                          <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800">
                            Cupo compartido Psicología CAT BÁSICA:{" "}
                            <span className="font-semibold">
                              {psicologiaBasicaResumen.usadas} / {psicologiaBasicaResumen.maximoCompartido}
                            </span>{" "}
                            - Restantes:{" "}
                            <span className="font-semibold">{psicologiaBasicaResumen.restantes}</span>
                          </div>
                        ) : null}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${progressColor(percent)}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        {sinCobertura ? (
                          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                            No accede a esta especialidad/prestación con su plan.
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-600">
                              {item.utilizadas} / {item.maximo} sesiones usadas
                            </p>
                            <p className="text-sm font-medium">Restantes: {item.restantes}</p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Historial de Turnos</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/turnos/nuevo?cod_soc=${encodeURIComponent(String(codSoc))}&adherente=${encodeURIComponent(
                String(adherente)
              )}&nombre=${encodeURIComponent(paciente?.nombre ?? "Paciente")}&categoria=${encodeURIComponent(categoria ?? "")}`}
            >
              <Button
                type="button"
                variant="outline"
                className="border-teal-600 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
              >
                <PlusCircle className="mr-1 size-4 shrink-0" />
                Crear turno
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 text-slate-800 hover:bg-slate-50"
              onClick={() => setFamiliaDialogOpen(true)}
            >
              <Users className="mr-1 size-4 shrink-0" />
              Ver turnos de familiares (misma cobertura)
            </Button>
            {canManualLoad ? (
              <Button
                variant="outline"
                className="border-teal-600 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                onClick={() => setIsCargaManualOpen(true)}
              >
                <PlusCircle className="mr-1 size-4" />
                Cargar sesión pasada
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <EmptyState message="No hay turnos registrados para este paciente." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Prestacion</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Estado turno</TableHead>
                  <TableHead>Acciones</TableHead>
                  {/* <TableHead>Estado atencion</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((item) => (
                  <TableRow key={item.turno_id}>
                    <TableCell>{toFecha(item.fecha)}</TableCell>
                    <TableCell>{toHora(item.hora)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{item.prestacion}</span>
                        {getPsicologiaTipo(item.prestacion) ? (
                          <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                            {getPsicologiaTipo(item.prestacion)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{item.profesional}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge className={estadoClass(item.estado_turno)}>{item.estado_turno}</Badge>
                        {Number(item.es_carga_manual) === 1 ? (
                          <span
                            title="Esta sesión fue cargada manualmente por la administración"
                            className="rounded-[4px] border border-[#FDE68A] bg-[#FEF3C7] px-1.5 py-0.5 text-[11px] text-[#92400E]"
                          >
                            Carga manual
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTurnoDetalleId(Number(item.turno_id))}
                        >
                          Ver detalle
                        </Button>
                        {canDeleteTurno ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-200 px-2.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => handleDeleteTurno(Number(item.turno_id))}
                          >
                            <Trash2 className="" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    {/* <TableCell>
                      {item.estado_atencion ? (
                        <Badge className={estadoClass(item.estado_atencion)}>{item.estado_atencion}</Badge>
                      ) : (
                        <span className="text-xs text-slate-500">Sin registro</span>
                      )}
                    </TableCell> */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={familiaDialogOpen} onOpenChange={setFamiliaDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,800px)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 space-y-2 px-6 pt-6">
            <DialogTitle className="pr-8">Turnos de familiares (misma cobertura de prestaciones)</DialogTitle>
            <DialogDescription className="text-left text-sm text-slate-600">
              Turnos de otros integrantes del mismo grupo familiar (mismo número de socio) para prestaciones incluidas en la
              cobertura del plan
              {categoria ? (
                <span className="font-medium text-slate-800"> ({categoria})</span>
              ) : null}
              . No incluye los turnos del paciente que estás viendo.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
            {familiaLoading ? (
              <Loading label="Cargando turnos del grupo familiar..." />
            ) : familiaError ? (
              <p className="text-sm text-red-600">{familiaError}</p>
            ) : familiaItems.length === 0 ? (
              <EmptyState
                title="Sin turnos para mostrar"
                message={familiaMensaje ?? "No hay turnos de otros familiares que coincidan con la cobertura del plan."}
              />
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <Table className="w-full min-w-[920px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[11%]" />
                    <col className="w-[9%]" />
                    <col className="w-[7%]" />
                    <col className="w-[20%]" />
                    <col className="w-[18%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="whitespace-normal align-bottom leading-tight">
                        Familiar
                      </TableHead>
                      <TableHead className="whitespace-normal align-bottom leading-tight">Vínculo</TableHead>
                      <TableHead className="align-bottom">Fecha</TableHead>
                      <TableHead className="align-bottom">Hora</TableHead>
                      <TableHead className="whitespace-normal align-bottom leading-tight">Prestación</TableHead>
                      <TableHead className="whitespace-normal align-bottom leading-tight">Profesional</TableHead>
                      <TableHead className="align-bottom">Estado</TableHead>
                      <TableHead className="align-bottom">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {familiaItems.map((item) => (
                      <TableRow key={item.turno_id} className="align-top">
                        <TableCell className="wrap-break-word whitespace-normal py-3 align-top font-medium leading-snug text-slate-900">
                          {item.familiar_nombre}
                        </TableCell>
                        <TableCell className="wrap-break-word whitespace-normal py-3 align-top leading-snug text-slate-600">
                          {item.familiar_vinculo}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 align-top tabular-nums text-slate-800">
                          {toFecha(item.fecha)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 align-top tabular-nums text-slate-800">
                          {toHora(item.hora)}
                        </TableCell>
                        <TableCell className="wrap-break-word whitespace-normal py-3 align-top leading-snug">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                            <span>{item.prestacion}</span>
                            {getPsicologiaTipo(item.prestacion) ? (
                              <span className="w-fit shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                                {getPsicologiaTipo(item.prestacion)}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="wrap-break-word whitespace-normal py-3 align-top leading-snug text-slate-800">
                          {item.profesional}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className={`${estadoClass(item.estado_turno)} whitespace-nowrap`}>
                            {item.estado_turno}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <Button size="sm" variant="outline" onClick={() => setTurnoDetalleId(Number(item.turno_id))}>
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CargaManualModal
        isOpen={isCargaManualOpen}
        onClose={() => setIsCargaManualOpen(false)}
        onSuccess={() => setReloadToken((prev) => prev + 1)}
        codSoc={codSoc}
        adherenteCodigo={adherente}
        nombrePaciente={paciente?.nombre ?? "Paciente"}
      />

      <TurnoDetalleModal
        isOpen={turnoDetalleId !== null}
        turnoId={turnoDetalleId}
        onClose={() => setTurnoDetalleId(null)}
        onSaved={() => setReloadToken((prev) => prev + 1)}
      />
    </div>
  );
}

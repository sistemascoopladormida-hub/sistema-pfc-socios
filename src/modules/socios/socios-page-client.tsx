"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, Users } from "lucide-react";
import { motion } from "framer-motion";

import { DataBadge } from "@/components/ui/data-badge";
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
import { Input } from "@/components/ui/input";
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

type SocioListadoRow = {
  COD_SOC: number | string;
  APELLIDOS: string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
  FECHA_NACIMIENTO?: string;
  EDAD?: number | null;
  ES_HIJO?: boolean;
  ES_HIJO_MAYOR_18?: boolean;
  REQUIERE_CUOTA_PROPIA?: boolean;
  TIPO_BENEFICIO?: "PROPIO" | "TITULAR" | "NO_DEFINIDO" | string;
};

type ApiResponse = {
  success: boolean;
  data?: SocioListadoRow[];
  error?: string;
};

function getBeneficioBadgeClass(tipo: string, esHijoMayor18: boolean) {
  if (esHijoMayor18 || tipo === "PROPIO") {
    return "bg-amber-500 text-white";
  }
  if (tipo === "TITULAR") {
    return "bg-coopGreen text-white";
  }
  return "bg-slate-500 text-white";
}

function getBeneficioLabel(row: SocioListadoRow) {
  if (row.ES_HIJO_MAYOR_18 || row.TIPO_BENEFICIO === "PROPIO") {
    return "Beneficio propio";
  }
  if (row.TIPO_BENEFICIO === "TITULAR") {
    return "Beneficio titular";
  }
  return "Por definir";
}

export function SociosPageClient() {
  const { role } = useUser();
  const [query, setQuery] = useState("");
  const [socios, setSocios] = useState<SocioListadoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [grupoLoading, setGrupoLoading] = useState(false);
  const [grupoError, setGrupoError] = useState<string | null>(null);
  const [grupoRows, setGrupoRows] = useState<SocioListadoRow[]>([]);
  const [grupoCodSoc, setGrupoCodSoc] = useState<string>("");

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSocios() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetch(`/api/socios?buscar=${encodeURIComponent(query.trim())}`, {
          method: "GET",
          signal: abortController.signal,
          cache: "no-store",
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "Error consultando socios");
        }

        setSocios(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setLoadError("No se pudieron cargar los socios del sistema Procoop");
      } finally {
        setIsLoading(false);
      }
    }

    loadSocios();

    return () => {
      abortController.abort();
    };
  }, [query]);

  const sociosFiltrados = useMemo(() => socios, [socios]);
  const resumenBeneficios = useMemo(() => {
    return sociosFiltrados.reduce(
      (acc, row) => {
        const esHijoMayor18 = Boolean(row.ES_HIJO_MAYOR_18);
        const esHijo = Boolean(row.ES_HIJO);
        const vinculoNormalizado = String(row.VINCULO ?? "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (esHijoMayor18) {
          acc.hijosMayores18 += 1;
        } else if (esHijo) {
          acc.hijosMenores18 += 1;
        }

        if (vinculoNormalizado === "CONYUGE") {
          acc.conyuges += 1;
        }
        if (vinculoNormalizado === "OTROS" || vinculoNormalizado === "OTRO") {
          acc.otros += 1;
        }

        if (vinculoNormalizado === "TITULAR") {
          acc.beneficioTitular += 1;
        }
        return acc;
      },
      {
        hijosMayores18: 0,
        hijosMenores18: 0,
        conyuges: 0,
        otros: 0,
        beneficioTitular: 0,
      }
    );
  }, [sociosFiltrados]);

  async function handleVerGrupo(codSocRaw: number | string) {
    try {
      const codSoc = String(codSocRaw);
      setGrupoCodSoc(codSoc);
      setGrupoOpen(true);
      setGrupoLoading(true);
      setGrupoError(null);
      setGrupoRows([]);

      const response = await fetch(`/api/socios/${encodeURIComponent(codSoc)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Error cargando grupo familiar");
      }

      setGrupoRows(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      setGrupoError(error instanceof Error ? error.message : "No se pudo cargar el grupo familiar");
    } finally {
      setGrupoLoading(false);
    }
  }

  function buildTurnoUrl(item: SocioListadoRow) {
    const nombre = item.ADHERENTE_NOMBRE || item.APELLIDOS || "Paciente";
    return `/turnos/nuevo?cod_soc=${encodeURIComponent(String(item.COD_SOC))}&adherente=${encodeURIComponent(
      String(item.ADHERENTE_CODIGO ?? 0)
    )}&nombre=${encodeURIComponent(nombre)}&categoria=${encodeURIComponent(item.DES_CAT ?? "")}`;
  }

  function buildHistorialUrl(item: SocioListadoRow) {
    return `/socios/${encodeURIComponent(String(item.COD_SOC))}/${encodeURIComponent(
      String(item.ADHERENTE_CODIGO ?? 0)
    )}/historial`;
  }

  if (!canAccessModule(role, "socios")) {
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
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Gestion de Socios PFC</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Cargando socios PFC...</p>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Error al cargar socios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto space-y-6">
      <PageHeader title="Socios PFC" breadcrumbs={["gestión de adherentes"]} />

      <Card className="bg-white">
        <CardHeader className="space-y-4">
          <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.08em] text-pfcText-muted">
            Búsqueda de socios
          </CardTitle>
          <motion.div whileFocus={{ scaleX: 1 }} initial={{ scaleX: 0.99 }} className="relative max-w-lg origin-left">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pfcText-muted" />
            <Input
              placeholder="Buscar por apellido, DNI o número de socio..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 border-[#D1D9D4] pl-10 placeholder:italic placeholder:text-pfcText-muted focus-visible:border-[#0D6E5A] focus-visible:ring-[3px] focus-visible:ring-[#0D6E5A]/20"
              autoFocus
            />
          </motion.div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/40 px-2 py-1 text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              HIJO/A +18 (beneficio propio)
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-[#B7D7CC] bg-[#EAF6F2]/30 px-2 py-1 text-[#0D6E5A]">
              <span className="h-2 w-2 rounded-full bg-[#0D6E5A]" />
              Menor de 18 / cónyuge / otros (beneficio titular)
            </span>
          </div>
        </CardHeader>
      </Card>

      <Card className="bg-white">
        <CardContent className="pt-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="overflow-hidden ring-1 ring-amber-200">
            <div className="h-full border-l-[3px] border-amber-500 pl-1">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-pfcText-muted">HIJO/A +18</p>
              <p className="font-display text-[32px] leading-none text-amber-600">{resumenBeneficios.hijosMayores18}</p>
            </CardContent>
            </div>
          </Card>
          <Card className="overflow-hidden ring-1 ring-[#B7D7CC]">
            <div className="h-full border-l-[3px] border-[#0D6E5A] pl-1">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-pfcText-muted">HIJO/A menor de 18</p>
              <p className="font-display text-[32px] leading-none text-[#0D6E5A]">{resumenBeneficios.hijosMenores18}</p>
            </CardContent>
            </div>
          </Card>
          <Card className="overflow-hidden ring-1 ring-[#D6C4A8]">
            <div className="h-full border-l-[3px] border-[#B45309] pl-1">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-pfcText-muted">CONYUGE</p>
              <p className="font-display text-[32px] leading-none text-[#B45309]">{resumenBeneficios.conyuges}</p>
            </CardContent>
            </div>
          </Card>
          <Card className="overflow-hidden ring-1 ring-[#D4CCF7]">
            <div className="h-full border-l-[3px] border-[#6D28D9] pl-1">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-pfcText-muted">OTROS</p>
              <p className="font-display text-[32px] leading-none text-[#6D28D9]">{resumenBeneficios.otros}</p>
            </CardContent>
            </div>
          </Card>
          <Card className="overflow-hidden ring-1 ring-[#C8D7E8]">
            <div className="h-full border-l-[3px] border-[#2563EB] pl-1">
            <CardContent className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-pfcText-muted">Socios titulares</p>
              <p className="font-display text-[32px] leading-none text-[#2563EB]">{resumenBeneficios.beneficioTitular}</p>
            </CardContent>
            </div>
          </Card>
        </div>

        {sociosFiltrados.length === 0 ? (
          <EmptyState message="No hay datos disponibles" />
        ) : (
          <Table className="min-w-[1150px]">
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Vinculo</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Regla beneficio</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sociosFiltrados.map((socio) => (
                <TableRow key={`${socio.COD_SOC}-${socio.ADHERENTE_CODIGO}-${socio.DNI_ADHERENTE}`}>
                  <TableCell>{socio.COD_SOC || "No registrado"}</TableCell>
                  <TableCell>{socio.ADHERENTE_NOMBRE || socio.APELLIDOS || "No registrado"}</TableCell>
                  <TableCell className="min-w-[190px]">
                    <div className="flex items-center gap-2">
                      <span>{socio.VINCULO || "No registrado"}</span>
                      {socio.ES_HIJO_MAYOR_18 ? <DataBadge kind="warning">HIJO/A +18</DataBadge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {Number.isFinite(Number(socio.EDAD)) ? `${Number(socio.EDAD)} años` : "Sin dato"}
                  </TableCell>
                  <TableCell>{socio.DNI_ADHERENTE || "No registrado"}</TableCell>
                  <TableCell>
                    {socio.DES_CAT ? (
                      <DataBadge kind={String(socio.DES_CAT).toUpperCase().includes("PLUS") ? "cat-plus" : "cat-basica"}>
                        {socio.DES_CAT}
                      </DataBadge>
                    ) : (
                      "No registrado"
                    )}
                  </TableCell>
                  <TableCell>
                    <DataBadge
                      kind={
                        getBeneficioBadgeClass(
                          String(socio.TIPO_BENEFICIO ?? ""),
                          Boolean(socio.ES_HIJO_MAYOR_18)
                        ).includes("amber")
                          ? "beneficio-propio"
                          : "beneficio-titular"
                      }
                    >
                      {getBeneficioLabel(socio)}
                    </DataBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleVerGrupo(socio.COD_SOC)}
                      >
                        <Users className="h-4 w-4" />
                        Ver grupo
                      </Button>
                      <Link href={buildTurnoUrl(socio)}>
                        <Button size="sm" variant="outline" className="gap-2">
                          Crear turno
                        </Button>
                      </Link>
                      <Link href={buildHistorialUrl(socio)}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Historial
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      </Card>

      <Dialog open={grupoOpen} onOpenChange={setGrupoOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Grupo familiar del socio {grupoCodSoc}</DialogTitle>
            <DialogDescription>Listado de titulares y adherentes vinculados.</DialogDescription>
          </DialogHeader>

          {grupoLoading ? (
            <p className="text-sm text-slate-600">Cargando grupo familiar...</p>
          ) : grupoError ? (
            <p className="text-sm text-red-600">{grupoError}</p>
          ) : grupoRows.length === 0 ? (
            <EmptyState message="No se encontraron integrantes para este socio." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {grupoRows.map((item) => (
                <Card key={`${item.COD_SOC}-${item.ADHERENTE_CODIGO}-${item.DNI_ADHERENTE}`} className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {item.ADHERENTE_NOMBRE || item.APELLIDOS || "Sin nombre"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col space-y-2 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold">Vinculo:</span> {item.VINCULO || "No registrado"}
                    </p>
                    <p>
                      <span className="font-semibold">Edad:</span>{" "}
                      {Number.isFinite(Number(item.EDAD)) ? `${Number(item.EDAD)} años` : "Sin dato"}
                    </p>
                    <p>
                      <span className="font-semibold">DNI:</span> {item.DNI_ADHERENTE || "No registrado"}
                    </p>
                    <p>
                      <span className="font-semibold">Categoria:</span> {item.DES_CAT || "No registrado"}
                    </p>
                    <div>
                      <DataBadge
                        kind={
                          getBeneficioBadgeClass(
                            String(item.TIPO_BENEFICIO ?? ""),
                            Boolean(item.ES_HIJO_MAYOR_18)
                          ).includes("amber")
                            ? "beneficio-propio"
                            : "beneficio-titular"
                        }
                      >
                        {getBeneficioLabel(item)}
                      </DataBadge>
                    </div>
                    <div className="mt-auto flex items-center gap-3 pt-2">
                      <Link href={buildTurnoUrl(item)} className="flex-1">
                        <Button
                          size="sm"
                          className="w-full justify-center bg-coopBlue text-white hover:bg-coopSecondary"
                        >
                          Crear turno
                        </Button>
                      </Link>
                      <Link href={buildHistorialUrl(item)} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full justify-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Ver historial
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

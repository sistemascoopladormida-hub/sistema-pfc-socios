"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarPlus2, ClipboardList, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { DataBadge } from "@/components/ui/data-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  resumen?: {
    total_resultados: number;
    titulares_total: number;
    hijos_mayores_18: number;
    hijos_menores_18: number;
    conyuges_total: number;
    otros_total: number;
  };
  error?: string;
};

const SOCIOS_PAGE_LIMIT = 500;
type SocioCardFilter = "TODOS" | "HIJOS_MAYORES" | "HIJOS_MENORES" | "CONYUGES" | "OTROS" | "TITULARES";

function normalizeVinculo(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isConyugeVinculo(vinculoNormalizado: string) {
  return vinculoNormalizado.startsWith("CONYUGE") || vinculoNormalizado.includes("CONYUG");
}

function isOtrosVinculo(vinculoNormalizado: string) {
  return vinculoNormalizado === "OTROS" || vinculoNormalizado === "OTRO" || vinculoNormalizado.startsWith("OTR");
}

function getBeneficioLabel(row: SocioListadoRow) {
  if (row.ES_HIJO_MAYOR_18 || row.TIPO_BENEFICIO === "PROPIO") return "Beneficio propio";
  if (row.TIPO_BENEFICIO === "TITULAR") return "Beneficio titular";
  return "Por definir";
}

function ActionTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-md transition-all duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100">
      {label}
    </span>
  );
}

function cardFilterToSegmento(cardFilter: SocioCardFilter): string {
  if (cardFilter === "TODOS") return "";
  return cardFilter;
}

export function SociosPageClient() {
  const { role } = useUser();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [socios, setSocios] = useState<SocioListadoRow[]>([]);
  const [resumenApi, setResumenApi] = useState<{
    total_resultados: number;
    titulares_total: number;
    hijos_mayores_18: number;
    hijos_menores_18: number;
    conyuges_total: number;
    otros_total: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [grupoLoading, setGrupoLoading] = useState(false);
  const [grupoError, setGrupoError] = useState<string | null>(null);
  const [grupoRows, setGrupoRows] = useState<SocioListadoRow[]>([]);
  const [grupoCodSoc, setGrupoCodSoc] = useState<string>("");
  const [cardFilter, setCardFilter] = useState<SocioCardFilter>("TODOS");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const foco = String(searchParams.get("foco") ?? "").toLowerCase();
    if (foco === "hijos-mayores") {
      setCardFilter("HIJOS_MAYORES");
    }
  }, [searchParams]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSocios() {
      const isFirstLoad = !hasLoadedOnceRef.current;
      try {
        if (isFirstLoad) setIsLoading(true);
        else setIsRefreshing(true);
        setLoadError(null);

        const response = await fetch(
          `/api/socios?buscar=${encodeURIComponent(debouncedQuery)}&limit=${SOCIOS_PAGE_LIMIT}&segmento=${encodeURIComponent(cardFilterToSegmento(cardFilter))}`,
          { method: "GET", signal: abortController.signal, cache: "no-store" }
        );
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || !data.success) throw new Error(data.error ?? "Error consultando socios");

        setSocios(Array.isArray(data.data) ? data.data : []);
        setResumenApi(data.resumen ?? null);
        hasLoadedOnceRef.current = true;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (isFirstLoad) setLoadError("No se pudieron cargar los socios");
        else toast.error("No se pudo actualizar el listado.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }

    loadSocios();
    return () => abortController.abort();
  }, [debouncedQuery, cardFilter]);

  const resumenBeneficios = useMemo(
    () =>
      socios.reduce(
        (acc, row) => {
          const esHijoMayor18 = Boolean(row.ES_HIJO_MAYOR_18);
          const esHijo = Boolean(row.ES_HIJO);
          const vinculoNormalizado = normalizeVinculo(row.VINCULO);

          if (esHijoMayor18) acc.hijosMayores18 += 1;
          else if (esHijo) acc.hijosMenores18 += 1;
          if (isConyugeVinculo(vinculoNormalizado)) acc.conyuges += 1;
          if (isOtrosVinculo(vinculoNormalizado)) acc.otros += 1;
          if (vinculoNormalizado === "TITULAR") acc.beneficioTitular += 1;
          return acc;
        },
        { hijosMayores18: 0, hijosMenores18: 0, conyuges: 0, otros: 0, beneficioTitular: 0 }
      ),
    [socios]
  );

  const sociosFiltrados = useMemo(() => {
    if (cardFilter === "TODOS") return socios;
    return socios.filter((row) => {
      const vinculoNormalizado = normalizeVinculo(row.VINCULO);
      const esHijoMayor18 = Boolean(row.ES_HIJO_MAYOR_18);
      const esHijo = Boolean(row.ES_HIJO);
      const esHijoMenor18 = esHijo && !esHijoMayor18;

      if (cardFilter === "HIJOS_MAYORES") return esHijoMayor18;
      if (cardFilter === "HIJOS_MENORES") return esHijoMenor18;
      if (cardFilter === "CONYUGES") return isConyugeVinculo(vinculoNormalizado);
      if (cardFilter === "OTROS") return isOtrosVinculo(vinculoNormalizado);
      if (cardFilter === "TITULARES") return vinculoNormalizado === "TITULAR";
      return true;
    });
  }, [socios, cardFilter]);

  const summaryCards = [
    {
      key: "HIJOS_MAYORES" as const,
      label: "Hijo/a +18",
      value: resumenApi?.hijos_mayores_18 ?? resumenBeneficios.hijosMayores18,
    },
    {
      key: "HIJOS_MENORES" as const,
      label: "Hijo/a menor de 18",
      value: resumenApi?.hijos_menores_18 ?? resumenBeneficios.hijosMenores18,
    },
    {
      key: "CONYUGES" as const,
      label: "Conyuges",
      value: resumenApi?.conyuges_total ?? resumenBeneficios.conyuges,
    },
    {
      key: "OTROS" as const,
      label: "Otros",
      value: resumenApi?.otros_total ?? resumenBeneficios.otros,
    },
    {
      key: "TITULARES" as const,
      label: "Titulares",
      value: resumenApi?.titulares_total ?? resumenBeneficios.beneficioTitular,
    },
  ];

  function toggleCardFilter(nextFilter: SocioCardFilter) {
    setCardFilter((prev) => (prev === nextFilter ? "TODOS" : nextFilter));
    setQuery("");
    setDebouncedQuery("");
  }

  async function handleVerGrupo(codSocRaw: number | string) {
    try {
      const codSoc = String(codSocRaw);
      setGrupoCodSoc(codSoc);
      setGrupoOpen(true);
      setGrupoLoading(true);
      setGrupoError(null);
      setGrupoRows([]);

      const response = await fetch(`/api/socios/${encodeURIComponent(codSoc)}`, { method: "GET", cache: "no-store" });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) throw new Error(data.error ?? "Error cargando grupo familiar");
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
    return `/socios/${encodeURIComponent(String(item.COD_SOC))}/${encodeURIComponent(String(item.ADHERENTE_CODIGO ?? 0))}/historial`;
  }

  if (!canAccessModule(role, "socios")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No tienes permisos para acceder a este modulo.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Card><CardContent className="py-8 text-sm text-slate-500">Cargando socios...</CardContent></Card>;
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error al cargar socios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="module-shell space-y-6">
      <PageHeader title="Socios PFC" breadcrumbs={["Gestion de adherentes"]} />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Buscar socios</CardTitle>
          <div className="relative max-w-xl">
            <Search className="absolute z-50 left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Apellido, DNI o numero de socio"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Se muestran hasta {SOCIOS_PAGE_LIMIT} filas por busqueda para mantener la vista rapida.
          </p>
        </CardHeader>
      </Card>

      <div className="stat-grid">
        {summaryCards.map((item) => (
          <Card
            key={item.key}
            className={`transition-all duration-150 ${
              cardFilter === item.key ? "ring-2 ring-primary/30" : "hover:ring-1 hover:ring-primary/20"
            }`}
          >
            <CardContent className="py-5">
              <button
                type="button"
                onClick={() => toggleCardFilter(item.key)}
                className="group w-full cursor-pointer text-left"
                title="Este bloque funciona como filtro"
              >
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
                <p className="mt-2 text-xs text-primary/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  Click para filtrar
                </p>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado de socios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRefreshing ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Actualizando listado...
            </div>
          ) : null}
          {cardFilter !== "TODOS" ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <span>
                Filtro activo:{" "}
                {summaryCards.find((item) => item.key === cardFilter)?.label.toLowerCase() ?? "segmento"}
              </span>
              <Button size="sm" variant="outline" onClick={() => setCardFilter("TODOS")}>
                Quitar filtro
              </Button>
            </div>
          ) : null}

          {sociosFiltrados.length === 0 ? (
            <EmptyState message="No hay datos disponibles" />
          ) : (
            <>
              <div className="hidden min-[1400px]:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Socio</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Vinculo</TableHead>
                      <TableHead>Edad</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Beneficio</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sociosFiltrados.map((socio) => (
                      <TableRow key={`${socio.COD_SOC}-${socio.ADHERENTE_CODIGO}-${socio.DNI_ADHERENTE}`}>
                        <TableCell>{socio.COD_SOC || "No registrado"}</TableCell>
                        <TableCell className="font-medium text-foreground">{socio.ADHERENTE_NOMBRE || socio.APELLIDOS || "No registrado"}</TableCell>
                        <TableCell>{socio.VINCULO || "No registrado"}</TableCell>
                        <TableCell>{Number.isFinite(Number(socio.EDAD)) ? `${Number(socio.EDAD)} anos` : "Sin dato"}</TableCell>
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
                          <DataBadge kind={socio.ES_HIJO_MAYOR_18 || socio.TIPO_BENEFICIO === "PROPIO" ? "beneficio-propio" : "beneficio-titular"}>
                            {getBeneficioLabel(socio)}
                          </DataBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <div className="group relative">
                              <ActionTooltip label="Ver grupo familiar" />
                              <Button
                                size="icon-sm"
                                variant="outline"
                                onClick={() => handleVerGrupo(socio.COD_SOC)}
                                aria-label="Ver grupo familiar"
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="group relative">
                              <ActionTooltip label="Crear turno" />
                              <Link href={buildTurnoUrl(socio)} aria-label="Crear turno">
                                <Button size="icon-sm" variant="outline">
                                  <CalendarPlus2 className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                            <div className="group relative">
                              <ActionTooltip label="Ver historial" />
                              <Link href={buildHistorialUrl(socio)} aria-label="Ver historial">
                                <Button size="icon-sm" variant="outline">
                                  <ClipboardList className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 min-[1400px]:hidden">
                {sociosFiltrados.map((socio) => (
                  <div key={`${socio.COD_SOC}-${socio.ADHERENTE_CODIGO}-${socio.DNI_ADHERENTE}`} className="data-card space-y-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">{socio.ADHERENTE_NOMBRE || socio.APELLIDOS || "No registrado"}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Socio {socio.COD_SOC} · {socio.VINCULO || "Sin vinculo"}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="field-help">DNI</p>
                        <p className="field-label">{socio.DNI_ADHERENTE || "No registrado"}</p>
                      </div>
                      <div>
                        <p className="field-help">Edad</p>
                        <p className="field-label">{Number.isFinite(Number(socio.EDAD)) ? `${Number(socio.EDAD)} anos` : "Sin dato"}</p>
                      </div>
                      <div>
                        <p className="field-help">Categoria</p>
                        <div className="pt-1">
                          {socio.DES_CAT ? (
                            <DataBadge kind={String(socio.DES_CAT).toUpperCase().includes("PLUS") ? "cat-plus" : "cat-basica"}>
                              {socio.DES_CAT}
                            </DataBadge>
                          ) : (
                            <span className="field-label">No registrado</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="field-help">Beneficio</p>
                        <div className="pt-1">
                          <DataBadge kind={socio.ES_HIJO_MAYOR_18 || socio.TIPO_BENEFICIO === "PROPIO" ? "beneficio-propio" : "beneficio-titular"}>
                            {getBeneficioLabel(socio)}
                          </DataBadge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="group relative sm:flex-1">
                        <ActionTooltip label="Ver grupo familiar" />
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleVerGrupo(socio.COD_SOC)}
                          aria-label="Ver grupo familiar"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="group relative sm:flex-1">
                        <ActionTooltip label="Crear turno" />
                        <Link href={buildTurnoUrl(socio)} className="sm:flex-1" aria-label="Crear turno">
                          <Button variant="outline" className="w-full">
                            <CalendarPlus2 className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                      <div className="group relative sm:flex-1">
                        <ActionTooltip label="Ver historial" />
                        <Link href={buildHistorialUrl(socio)} className="sm:flex-1" aria-label="Ver historial">
                          <Button variant="outline" className="w-full">
                            <ClipboardList className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={grupoOpen} onOpenChange={setGrupoOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Grupo familiar del socio {grupoCodSoc}</DialogTitle>
            <DialogDescription>Titulares y adherentes vinculados.</DialogDescription>
          </DialogHeader>

          {grupoLoading ? (
            <p className="text-sm text-slate-500">Cargando grupo familiar...</p>
          ) : grupoError ? (
            <p className="text-sm text-rose-500">{grupoError}</p>
          ) : grupoRows.length === 0 ? (
            <EmptyState message="No se encontraron integrantes para este socio." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {grupoRows.map((item) => (
                <Card key={`${item.COD_SOC}-${item.ADHERENTE_CODIGO}-${item.DNI_ADHERENTE}`} className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {item.ADHERENTE_NOMBRE || item.APELLIDOS || "Sin nombre"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col gap-2 text-sm">
                    <p><span className="font-medium text-foreground">Vinculo:</span> {item.VINCULO || "No registrado"}</p>
                    <p><span className="font-medium text-foreground">Edad:</span> {Number.isFinite(Number(item.EDAD)) ? `${Number(item.EDAD)} anos` : "Sin dato"}</p>
                    <p><span className="font-medium text-foreground">DNI:</span> {item.DNI_ADHERENTE || "No registrado"}</p>
                    <p><span className="font-medium text-foreground">Categoria:</span> {item.DES_CAT || "No registrado"}</p>
                    <div className="pt-1">
                      <DataBadge kind={item.ES_HIJO_MAYOR_18 || item.TIPO_BENEFICIO === "PROPIO" ? "beneficio-propio" : "beneficio-titular"}>
                        {getBeneficioLabel(item)}
                      </DataBadge>
                    </div>
                    <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row">
                      <div className="group relative sm:flex-1">
                        <ActionTooltip label="Crear turno" />
                        <Link href={buildTurnoUrl(item)} className="sm:flex-1" aria-label="Crear turno">
                          <Button className="w-full">
                            <CalendarPlus2 className="h-4 w-4" />
                            <p>Crear turno</p>
                          </Button>
                        </Link>
                      </div>
                      <div className="group relative sm:flex-1">
                        <ActionTooltip label="Ver historial" />
                        <Link href={buildHistorialUrl(item)} className="sm:flex-1" aria-label="Ver historial">
                          <Button variant="outline" className="w-full">
                            <ClipboardList className="h-4 w-4" />
                            <p>Ver historial</p>
                          </Button>
                        </Link>
                      </div>
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

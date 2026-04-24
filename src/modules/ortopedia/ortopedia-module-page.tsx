"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edit3, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canAccessModule, useUser } from "@/lib/user-context";

type OrtopediaSection = "gestion" | "asignacion" | "stock" | "prestamos";

type Elemento = {
  id: number;
  nombre: string;
  descripcion: string;
  stock_total: number;
  stock_disponible: number;
  activo: boolean;
};

type Prestamo = {
  id: number;
  elemento_id: number;
  elemento_nombre: string;
  cod_soc: number;
  adherente_codigo: number;
  paciente_nombre: string;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  estado: "ACTIVO" | "VENCIDO" | "DEVUELTO" | string;
  observaciones: string;
  certificado_presentado: boolean;
  renovaciones: number;
  certificado_ruta?: string | null;
  certificado_nombre?: string | null;
};

type SocioSearchRow = {
  COD_SOC: number | string;
  ADHERENTE_CODIGO: number | string;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
  VINCULO: string;
  DNI_ADHERENTE: string;
  DES_CAT: string;
};

type ApiResponse = {
  success: boolean;
  data?: {
    elementos: Elemento[];
    prestamos: Prestamo[];
  };
  error?: string;
};

type ElementoModalMode = "create" | "edit";

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

const sectionToModule = {
  gestion: "ortopedia-gestion",
  asignacion: "ortopedia-asignacion",
  stock: "ortopedia-stock",
  prestamos: "ortopedia-prestamos",
} as const;

const sectionTitles: Record<OrtopediaSection, string> = {
  gestion: "Gestion de elementos ortopedicos",
  asignacion: "Asignacion de elementos ortopedicos",
  stock: "Stock de elementos ortopedicos",
  prestamos: "Prestamos de elementos ortopedicos",
};

export function OrtopediaModulePage({ section }: { section: OrtopediaSection }) {
  const { role } = useUser();
  const [loading, setLoading] = useState(true);
  const [elementos, setElementos] = useState<Elemento[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);

  const [elementoModalOpen, setElementoModalOpen] = useState(false);
  const [elementoModalMode, setElementoModalMode] = useState<ElementoModalMode>("create");
  const [elementoEditId, setElementoEditId] = useState<number | null>(null);
  const [elementoNombre, setElementoNombre] = useState("");
  const [elementoDescripcion, setElementoDescripcion] = useState("");
  const [elementoStock, setElementoStock] = useState("0");
  const [elementoActivo, setElementoActivo] = useState(true);
  const [guardandoElemento, setGuardandoElemento] = useState(false);

  const [socioQuery, setSocioQuery] = useState("");
  const [socioResults, setSocioResults] = useState<SocioSearchRow[]>([]);
  const [showSocioResults, setShowSocioResults] = useState(false);
  const [searchingSocios, setSearchingSocios] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState<SocioSearchRow | null>(null);
  const [selectedElementoId, setSelectedElementoId] = useState("");
  const [prestamoObs, setPrestamoObs] = useState("");
  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [renovarPrestamoId, setRenovarPrestamoId] = useState<number | null>(null);
  const [renovarObs, setRenovarObs] = useState("");
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [renovando, setRenovando] = useState(false);
  const socioSearchRef = useRef<HTMLDivElement | null>(null);

  const elementosDisponibles = useMemo(
    () => elementos.filter((item) => item.activo && Number(item.stock_disponible) > 0),
    [elementos]
  );

  async function fetchData() {
    const response = await fetch("/api/ortopedia", { cache: "no-store" });
    const data = (await response.json()) as ApiResponse;
    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error ?? "No se pudo cargar ortopedia");
    }
    setElementos(data.data.elementos ?? []);
    setPrestamos(data.data.prestamos ?? []);
  }

  useEffect(() => {
    fetchData()
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "No se pudo cargar ortopedia");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showSocioResults || section !== "asignacion") return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (socioSearchRef.current?.contains(target)) return;
      setShowSocioResults(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [section, showSocioResults]);

  useEffect(() => {
    if (!showSocioResults || section !== "asignacion") return;
    const q = socioQuery.trim();
    if (q.length < 2) {
      setSocioResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchingSocios(true);
        const response = await fetch(`/api/socios?buscar=${encodeURIComponent(q)}&limit=40`, { cache: "no-store" });
        const data = (await response.json()) as { success: boolean; data?: SocioSearchRow[]; error?: string };
        if (!response.ok || !data.success) throw new Error(data.error ?? "No se pudieron buscar socios");
        setSocioResults(data.data ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error buscando socios");
      } finally {
        setSearchingSocios(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [section, socioQuery, showSocioResults]);

  function abrirModalCrearElemento() {
    setElementoModalMode("create");
    setElementoEditId(null);
    setElementoNombre("");
    setElementoDescripcion("");
    setElementoStock("0");
    setElementoActivo(true);
    setElementoModalOpen(true);
  }

  function abrirModalEditarElemento(item: Elemento) {
    setElementoModalMode("edit");
    setElementoEditId(item.id);
    setElementoNombre(item.nombre);
    setElementoDescripcion(item.descripcion ?? "");
    setElementoStock(String(item.stock_total));
    setElementoActivo(Boolean(item.activo));
    setElementoModalOpen(true);
  }

  async function handleGuardarElemento() {
    const stock = Number(elementoStock);
    if (!elementoNombre.trim()) {
      toast.error("Ingresa nombre del elemento");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      toast.error("Stock total invalido");
      return;
    }

    try {
      setGuardandoElemento(true);
      const isCreate = elementoModalMode === "create";
      const endpoint = isCreate ? "/api/ortopedia" : `/api/ortopedia/${elementoEditId}`;
      const method = isCreate ? "POST" : "PUT";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: elementoNombre,
          descripcion: elementoDescripcion,
          stock_total: stock,
          activo: elementoActivo,
        }),
      });
      const data = (await response.json()) as { success: boolean; error?: string; message?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo guardar el elemento");
        return;
      }

      toast.success(data.message ?? (isCreate ? "Elemento creado" : "Elemento actualizado"));
      setElementoModalOpen(false);
      await fetchData();
    } finally {
      setGuardandoElemento(false);
    }
  }

  async function handleEliminarElemento(item: Elemento) {
    if (!window.confirm(`Eliminar "${item.nombre}"?`)) return;
    const response = await fetch(`/api/ortopedia/${item.id}`, { method: "DELETE" });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo eliminar el elemento");
      return;
    }
    toast.success(data.message ?? "Elemento eliminado");
    await fetchData();
  }

  async function handleRegistrarPrestamo() {
    if (!selectedSocio) {
      toast.error("Selecciona socio o adherente");
      return;
    }
    const elementoId = Number(selectedElementoId);
    if (!Number.isInteger(elementoId) || elementoId <= 0) {
      toast.error("Selecciona un elemento");
      return;
    }

    const response = await fetch("/api/ortopedia/prestamos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        elemento_id: elementoId,
        cod_soc: Number(selectedSocio.COD_SOC),
        adherente_codigo: Number(selectedSocio.ADHERENTE_CODIGO),
        paciente_nombre: selectedSocio.ADHERENTE_NOMBRE || selectedSocio.APELLIDOS,
        observaciones: prestamoObs,
      }),
    });

    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo registrar prestamo");
      return;
    }

    toast.success(data.message ?? "Prestamo registrado");
    setSelectedElementoId("");
    setPrestamoObs("");
    await fetchData();
  }

  function abrirRenovacion(prestamoId: number) {
    setRenovarPrestamoId(prestamoId);
    setRenovarObs("");
    setCertificadoFile(null);
    setRenovarDialogOpen(true);
  }

  async function confirmarRenovacion() {
    if (!renovarPrestamoId) return;
    if (!certificadoFile) {
      toast.error("Debes adjuntar la imagen del certificado medico");
      return;
    }

    try {
      setRenovando(true);
      const formData = new FormData();
      formData.append("observaciones", renovarObs);
      formData.append("certificado", certificadoFile);

      const response = await fetch(`/api/ortopedia/prestamos/${renovarPrestamoId}/renovar`, {
        method: "PUT",
        body: formData,
      });
      const data = (await response.json()) as { success: boolean; error?: string; message?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo renovar");
        return;
      }

      toast.success(data.message ?? "Renovado");
      setRenovarDialogOpen(false);
      setRenovarPrestamoId(null);
      setCertificadoFile(null);
      setRenovarObs("");
      await fetchData();
    } finally {
      setRenovando(false);
    }
  }

  async function handleDevolver(prestamoId: number) {
    if (!window.confirm("Confirmas la devolucion del elemento?")) return;
    const response = await fetch(`/api/ortopedia/prestamos/${prestamoId}/devolver`, { method: "PUT" });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo registrar devolucion");
      return;
    }
    toast.success(data.message ?? "Devolucion registrada");
    await fetchData();
  }

  if (!canAccessModule(role, sectionToModule[section])) {
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

  if (loading) {
    return <Loading label="Cargando modulo de ortopedia..." />;
  }

  return (
    <div className="module-shell space-y-6">
      <PageHeader title={sectionTitles[section]} breadcrumbs={["Ortopedia"]} />

      {section === "gestion" ? (
        <>
          <div className="flex justify-end">
            <Button onClick={abrirModalCrearElemento}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo elemento
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Elementos registrados</CardTitle>
            </CardHeader>
            <CardContent>
              {elementos.length === 0 ? (
                <EmptyState message="Todavia no hay elementos ortopedicos cargados." />
              ) : (
                <>
                  <div className="hidden min-[1400px]:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Elemento</TableHead>
                          <TableHead>Descripcion</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Disponible</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {elementos.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-foreground">{item.nombre}</TableCell>
                            <TableCell>{item.descripcion || "-"}</TableCell>
                            <TableCell>{item.stock_total}</TableCell>
                            <TableCell>{item.stock_disponible}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => abrirModalEditarElemento(item)}>
                                  <Edit3 className="mr-1 h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleEliminarElemento(item)}>
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Eliminar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 min-[1400px]:hidden">
                    {elementos.map((item) => (
                      <div key={item.id} className="data-card space-y-4">
                        <div>
                          <p className="text-base font-semibold text-foreground">{item.nombre}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{item.descripcion || "Sin descripcion"}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><p className="field-help">Stock total</p><p className="field-label">{item.stock_total}</p></div>
                          <div><p className="field-help">Disponible</p><p className="field-label">{item.stock_disponible}</p></div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button variant="outline" className="sm:flex-1" onClick={() => abrirModalEditarElemento(item)}>
                            <Edit3 className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="destructive" className="sm:flex-1" onClick={() => handleEliminarElemento(item)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {section === "asignacion" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asignar prestamo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={socioSearchRef} className="relative">
              <input
                value={socioQuery}
                onFocus={() => setShowSocioResults(true)}
                onChange={(e) => {
                  setSocioQuery(e.target.value);
                  setShowSocioResults(true);
                  setSelectedSocio(null);
                }}
                placeholder="Buscar socio o adherente"
                className="h-11 w-full rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
              />
              {showSocioResults ? (
                <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-border bg-popover shadow-lg">
                  {searchingSocios ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Buscando socios...</p>
                  ) : socioResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">Sin resultados</p>
                  ) : (
                    socioResults.map((row) => (
                      <button
                        type="button"
                        key={`${row.COD_SOC}-${row.ADHERENTE_CODIGO}-${row.DNI_ADHERENTE}`}
                        className="w-full border-b border-border px-4 py-3 text-left hover:bg-muted"
                        onClick={() => {
                          setSelectedSocio(row);
                          setSocioQuery(`${row.COD_SOC} - ${row.ADHERENTE_NOMBRE || row.APELLIDOS} (${row.VINCULO || "-"})`);
                          setShowSocioResults(false);
                        }}
                      >
                        <div className="font-medium text-foreground">{row.ADHERENTE_NOMBRE || row.APELLIDOS}</div>
                        <div className="text-xs text-slate-500">Socio {row.COD_SOC} · DNI {row.DNI_ADHERENTE || "-"}</div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="field-grid field-grid-2">
              <label className="grid gap-2">
                <span className="field-label">Elemento</span>
                <select
                  value={selectedElementoId}
                  onChange={(e) => setSelectedElementoId(e.target.value)}
                  className="h-11 rounded-2xl border border-border bg-input px-3 text-sm text-foreground outline-none"
                >
                  <option value="">Seleccionar elemento disponible</option>
                  {elementosDisponibles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre} (disp: {item.stock_disponible}/{item.stock_total})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="field-label">Observaciones</span>
                <input
                  value={prestamoObs}
                  onChange={(e) => setPrestamoObs(e.target.value)}
                  placeholder="Opcional"
                  className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleRegistrarPrestamo}>Registrar prestamo</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "stock" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock de elementos</CardTitle>
          </CardHeader>
          <CardContent>
            {elementos.length === 0 ? (
              <EmptyState message="Todavia no hay elementos ortopedicos cargados." />
            ) : (
              <div className="space-y-3">
                {elementos.map((item) => (
                  <div key={item.id} className="data-card">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-foreground">{item.nombre}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{item.descripcion || "Sin descripcion"}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div><p className="field-help">Stock total</p><p className="field-label">{item.stock_total}</p></div>
                      <div><p className="field-help">Disponible</p><p className="field-label">{item.stock_disponible}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {section === "prestamos" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prestamos de elementos</CardTitle>
          </CardHeader>
          <CardContent>
            {prestamos.length === 0 ? (
              <EmptyState message="No hay prestamos registrados." />
            ) : (
              <div className="space-y-3">
                {prestamos.map((item) => (
                  <div key={item.id} className="data-card space-y-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">{item.paciente_nombre}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {item.elemento_nombre} · Socio {item.cod_soc} · Adherente {item.adherente_codigo}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="field-help">Prestamo</p><p className="field-label">{formatDate(item.fecha_prestamo)}</p></div>
                      <div><p className="field-help">Vencimiento</p><p className="field-label">{formatDate(item.fecha_vencimiento)}</p></div>
                      <div><p className="field-help">Estado</p><p className="field-label">{item.estado}</p></div>
                      <div><p className="field-help">Renovaciones</p><p className="field-label">{item.renovaciones}</p></div>
                    </div>

                    <div className="flex flex-col gap-2 lg:flex-row">
                      {item.certificado_ruta ? (
                        <a
                          href={`/api/ortopedia/prestamos/${item.id}/certificado`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          Ver certificado
                        </a>
                      ) : (
                        <div className="inline-flex h-11 items-center rounded-2xl border border-border px-4 text-sm text-slate-500">
                          Sin certificado
                        </div>
                      )}

                      {(item.estado === "ACTIVO" || item.estado === "VENCIDO") ? (
                        <>
                          <Button variant="outline" onClick={() => abrirRenovacion(item.id)}>
                            Renovar 60 dias
                          </Button>
                          <Button variant="outline" onClick={() => handleDevolver(item.id)}>
                            Devolver
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={elementoModalOpen}
        onOpenChange={(open) => {
          if (!guardandoElemento) setElementoModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{elementoModalMode === "create" ? "Nuevo elemento" : "Editar elemento"}</DialogTitle>
            <DialogDescription>Completa nombre, descripcion y stock.</DialogDescription>
          </DialogHeader>
          <div className="field-grid">
            <label className="grid gap-2">
              <span className="field-label">Nombre</span>
              <input
                value={elementoNombre}
                onChange={(e) => setElementoNombre(e.target.value)}
                placeholder="Ej: Silla de ruedas"
                className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                disabled={guardandoElemento}
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">Descripcion</span>
              <input
                value={elementoDescripcion}
                onChange={(e) => setElementoDescripcion(e.target.value)}
                placeholder="Detalle opcional"
                className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                disabled={guardandoElemento}
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">Stock total</span>
              <input
                type="number"
                min={0}
                value={elementoStock}
                onChange={(e) => setElementoStock(e.target.value)}
                className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                disabled={guardandoElemento}
              />
            </label>
            {elementoModalMode === "edit" ? (
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={elementoActivo}
                  onChange={(e) => setElementoActivo(e.target.checked)}
                  disabled={guardandoElemento}
                />
                Elemento activo
              </label>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setElementoModalOpen(false)} disabled={guardandoElemento}>
                Cancelar
              </Button>
              <Button onClick={handleGuardarElemento} disabled={guardandoElemento}>
                {guardandoElemento ? "Guardando..." : elementoModalMode === "create" ? "Crear elemento" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renovarDialogOpen}
        onOpenChange={(open) => {
          if (!renovando) setRenovarDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Renovar prestamo por 60 dias</DialogTitle>
            <DialogDescription>Adjunta la imagen del certificado medico.</DialogDescription>
          </DialogHeader>
          <div className="field-grid">
            <label className="grid gap-2">
              <span className="field-label">Certificado medico</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCertificadoFile(e.target.files?.[0] ?? null)}
                className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground"
                disabled={renovando}
              />
              {certificadoFile ? <span className="field-help">Archivo: {certificadoFile.name}</span> : null}
            </label>
            <label className="grid gap-2">
              <span className="field-label">Observaciones</span>
              <textarea
                value={renovarObs}
                onChange={(e) => setRenovarObs(e.target.value)}
                className="min-h-28 rounded-2xl border border-border bg-input px-4 py-3 text-sm text-foreground"
                disabled={renovando}
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setRenovarDialogOpen(false)} disabled={renovando}>
                Cancelar
              </Button>
              <Button onClick={confirmarRenovacion} disabled={!certificadoFile || renovando}>
                {renovando ? "Guardando..." : "Confirmar renovacion"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
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
import { OrtopediaAsignacionSection } from "@/modules/ortopedia/ortopedia-asignacion-section";
import { OrtopediaPrestamosSection } from "@/modules/ortopedia/ortopedia-prestamos-section";
import { CERTIFICADO_ACCEPT } from "@/modules/ortopedia/prestamo-utils";
import type { Elemento, PrestamoExpediente } from "@/modules/ortopedia/types";

type OrtopediaSection = "gestion" | "asignacion" | "stock" | "prestamos";

type ApiResponse = {
  success: boolean;
  data?: {
    elementos: Elemento[];
    prestamos: PrestamoExpediente[];
  };
  error?: string;
};

type ElementoModalMode = "create" | "edit";

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
  const [refreshing, setRefreshing] = useState(false);
  const [elementos, setElementos] = useState<Elemento[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoExpediente[]>([]);

  const [elementoModalOpen, setElementoModalOpen] = useState(false);
  const [elementoModalMode, setElementoModalMode] = useState<ElementoModalMode>("create");
  const [elementoEditId, setElementoEditId] = useState<number | null>(null);
  const [elementoNombre, setElementoNombre] = useState("");
  const [elementoDescripcion, setElementoDescripcion] = useState("");
  const [elementoStock, setElementoStock] = useState("0");
  const [elementoActivo, setElementoActivo] = useState(true);
  const [guardandoElemento, setGuardandoElemento] = useState(false);

  const [renovarDialogOpen, setRenovarDialogOpen] = useState(false);
  const [renovarPrestamoId, setRenovarPrestamoId] = useState<number | null>(null);
  const [renovarObs, setRenovarObs] = useState("");
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [renovando, setRenovando] = useState(false);

  async function fetchData(options?: { silent?: boolean }) {
    if (!options?.silent) setRefreshing(true);
    const response = await fetch("/api/ortopedia", { cache: "no-store" });
    const data = (await response.json()) as ApiResponse;
    if (!response.ok || !data.success || !data.data) {
      throw new Error(data.error ?? "No se pudo cargar ortopedia");
    }
    setElementos(data.data.elementos ?? []);
    setPrestamos(data.data.prestamos ?? []);
    if (!options?.silent) setRefreshing(false);
  }

  useEffect(() => {
    fetchData({ silent: true })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "No se pudo cargar ortopedia");
      })
      .finally(() => setLoading(false));
  }, []);

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
        <OrtopediaAsignacionSection elementos={elementos} onRegistered={() => fetchData()} />
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
        <OrtopediaPrestamosSection
          prestamos={prestamos}
          loading={refreshing}
          onRefresh={() => fetchData()}
          onRenovar={abrirRenovacion}
          onDevolver={handleDevolver}
        />
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
                accept={CERTIFICADO_ACCEPT}
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

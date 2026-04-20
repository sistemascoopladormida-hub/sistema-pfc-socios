"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edit3, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

export default function OrtopediaPage() {
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
      throw new Error(data.error ?? "No se pudo cargar módulo de ortopedia");
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
    if (!showSocioResults) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (socioSearchRef.current?.contains(target)) return;
      setShowSocioResults(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSocioResults]);

  useEffect(() => {
    if (!showSocioResults) return;
    const q = socioQuery.trim();
    if (q.length < 2) {
      setSocioResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearchingSocios(true);
        const response = await fetch(`/api/socios?buscar=${encodeURIComponent(q)}&limit=40`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { success: boolean; data?: SocioSearchRow[]; error?: string };
        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "No se pudieron buscar socios");
        }
        setSocioResults(data.data ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error buscando socios");
      } finally {
        setSearchingSocios(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [socioQuery, showSocioResults]);

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
      toast.error("Stock total inválido");
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
    const confirm = window.confirm(
      `¿Eliminar "${item.nombre}"?\nNo se eliminará si tiene préstamos activos o vencidos.`
    );
    if (!confirm) return;

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
      toast.error("Selecciona socio/adherente");
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
      toast.error(data.error ?? "No se pudo registrar préstamo");
      return;
    }

    toast.success(data.message ?? "Préstamo registrado");
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
      toast.error("Debes adjuntar una imagen del certificado médico");
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
    const confirm = window.confirm("¿Confirmas devolución del elemento?");
    if (!confirm) return;
    const response = await fetch(`/api/ortopedia/prestamos/${prestamoId}/devolver`, { method: "PUT" });
    const data = (await response.json()) as { success: boolean; error?: string; message?: string };
    if (!response.ok || !data.success) {
      toast.error(data.error ?? "No se pudo registrar devolución");
      return;
    }
    toast.success(data.message ?? "Devolución registrada");
    await fetchData();
  }

  if (!canAccessModule(role, "ortopedia")) {
    return (
      <Card className="overflow-visible bg-white">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No tienes permisos para acceder a este módulo.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <Loading label="Cargando módulo de ortopedia..." />;
  }

  return (
    <div className="mx-auto space-y-6">
      <PageHeader title="Elementos Ortopédicos" breadcrumbs={["gestión de préstamos"]} />

      <Card className="relative z-40 overflow-visible bg-white">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Gestión de elementos ortopédicos</CardTitle>
          <Button onClick={abrirModalCrearElemento} className="h-10 bg-[#0D6E5A] text-white hover:bg-[#0B5B4B]">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo elemento
          </Button>
        </CardHeader>
      </Card>

      <Card className="relative z-40 overflow-visible bg-white">
        <CardHeader>
          <CardTitle className="text-base">Asignar préstamo (60 días)</CardTitle>
        </CardHeader>
        <CardContent className="relative overflow-visible space-y-3">
          <div ref={socioSearchRef} className="relative z-50">
            <input
              value={socioQuery}
              onFocus={() => setShowSocioResults(true)}
              onChange={(e) => {
                setSocioQuery(e.target.value);
                setShowSocioResults(true);
                setSelectedSocio(null);
              }}
              placeholder="Buscar socio/adherente por nombre, DNI o número de socio..."
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
            />
            {showSocioResults && (
              <div className="absolute z-80 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-md">
                {searchingSocios ? (
                  <p className="px-3 py-2 text-sm text-slate-500">Buscando socios...</p>
                ) : socioResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">Sin resultados</p>
                ) : (
                  socioResults.map((row) => (
                    <button
                      type="button"
                      key={`${row.COD_SOC}-${row.ADHERENTE_CODIGO}-${row.DNI_ADHERENTE}`}
                      className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setSelectedSocio(row);
                        setSocioQuery(
                          `${row.COD_SOC} - ${row.ADHERENTE_NOMBRE || row.APELLIDOS} (${row.VINCULO || "—"})`
                        );
                        setShowSocioResults(false);
                      }}
                    >
                      <div className="font-medium">{row.ADHERENTE_NOMBRE || row.APELLIDOS}</div>
                      <div className="text-xs text-slate-500">
                        Socio {row.COD_SOC} · Adherente {row.ADHERENTE_CODIGO} · DNI {row.DNI_ADHERENTE || "—"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={selectedElementoId}
              onChange={(e) => setSelectedElementoId(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
            >
              <option value="">Seleccionar elemento disponible</option>
              {elementosDisponibles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre} (disp: {item.stock_disponible}/{item.stock_total})
                </option>
              ))}
            </select>
            <input
              value={prestamoObs}
              onChange={(e) => setPrestamoObs(e.target.value)}
              placeholder="Observaciones (opcional)"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 md:col-span-2"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleRegistrarPrestamo} className="bg-[#0D6E5A] text-white hover:bg-[#0B5B4B]">
              Registrar préstamo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base">Stock de elementos</CardTitle>
        </CardHeader>
        <CardContent>
          {elementos.length === 0 ? (
            <EmptyState message="Todavía no hay elementos ortopédicos cargados." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Elemento</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Disponible</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {elementos.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nombre}</TableCell>
                    <TableCell>{item.descripcion || "—"}</TableCell>
                    <TableCell>{item.stock_total}</TableCell>
                    <TableCell>{item.stock_disponible}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => abrirModalEditarElemento(item)}>
                          <Edit3 className="mr-1 h-3.5 w-3.5" />
                          Detalle
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEliminarElemento(item)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base">Préstamos de elementos ortopédicos</CardTitle>
        </CardHeader>
        <CardContent>
          {prestamos.length === 0 ? (
            <EmptyState message="No hay préstamos registrados." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Elemento</TableHead>
                  <TableHead>Préstamo</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Renovaciones</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestamos.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.paciente_nombre}
                      <div className="text-xs text-slate-500">
                        Socio {item.cod_soc} · Adherente {item.adherente_codigo}
                      </div>
                    </TableCell>
                    <TableCell>{item.elemento_nombre}</TableCell>
                    <TableCell>{formatDate(item.fecha_prestamo)}</TableCell>
                    <TableCell>{formatDate(item.fecha_vencimiento)}</TableCell>
                    <TableCell>{item.estado}</TableCell>
                    <TableCell>{item.renovaciones}</TableCell>
                    <TableCell>
                      {item.certificado_ruta ? (
                        <a
                          href={`/api/ortopedia/prestamos/${item.id}/certificado`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          title={item.certificado_nombre ?? "Ver certificado"}
                        >
                          Ver certificado
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">Sin archivo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(item.estado === "ACTIVO" || item.estado === "VENCIDO") && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => abrirRenovacion(item.id)}>
                              Renovar 60d
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDevolver(item.id)}>
                              Devolver
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={elementoModalOpen}
        onOpenChange={(open) => {
          if (!guardandoElemento) setElementoModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {elementoModalMode === "create" ? "Nuevo elemento ortopédico" : "Detalle / edición de elemento"}
            </DialogTitle>
            <DialogDescription>
              {elementoModalMode === "create"
                ? "Carga un nuevo elemento para el stock de la cooperativa."
                : "Puedes actualizar datos y stock del elemento seleccionado."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span>Nombre</span>
              <input
                value={elementoNombre}
                onChange={(e) => setElementoNombre(e.target.value)}
                placeholder="Ej: Silla de ruedas"
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
                disabled={guardandoElemento}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Descripción</span>
              <input
                value={elementoDescripcion}
                onChange={(e) => setElementoDescripcion(e.target.value)}
                placeholder="Detalle opcional"
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
                disabled={guardandoElemento}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Stock total</span>
              <input
                type="number"
                min={0}
                value={elementoStock}
                onChange={(e) => setElementoStock(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
                disabled={guardandoElemento}
              />
            </label>
            {elementoModalMode === "edit" ? (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={elementoActivo}
                  onChange={(e) => setElementoActivo(e.target.checked)}
                  disabled={guardandoElemento}
                />
                Elemento activo
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setElementoModalOpen(false)} disabled={guardandoElemento}>
                Cancelar
              </Button>
              <Button
                onClick={handleGuardarElemento}
                disabled={guardandoElemento}
                className="bg-[#0D6E5A] text-white hover:bg-[#0B5B4B]"
              >
                {guardandoElemento
                  ? "Guardando..."
                  : elementoModalMode === "create"
                    ? "Crear elemento"
                    : "Guardar cambios"}
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
            <DialogTitle>Renovar préstamo por 60 días</DialogTitle>
            <DialogDescription>
              Adjunta la imagen del certificado médico para registrar la renovación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="grid gap-1 text-sm">
              <span>Certificado médico (imagen)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCertificadoFile(e.target.files?.[0] ?? null)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                disabled={renovando}
              />
              {certificadoFile ? (
                <span className="text-xs text-slate-600">Archivo: {certificadoFile.name}</span>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span>Observaciones (opcional)</span>
              <textarea
                value={renovarObs}
                onChange={(e) => setRenovarObs(e.target.value)}
                className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={renovando}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenovarDialogOpen(false)} disabled={renovando}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarRenovacion}
                disabled={!certificadoFile || renovando}
                className="bg-[#0D6E5A] text-white hover:bg-[#0B5B4B]"
              >
                {renovando ? "Guardando..." : "Confirmar renovación"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  Edit3,
  ExternalLink,
  FileImage,
  FileText,
  Package,
  Phone,
  RotateCcw,
  Upload,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CERTIFICADO_ACCEPT,
  formatDate,
  formatDateTime,
  formatDni,
  prestamoEstadoLabel,
  prestamoEstadoVariant,
  resolveCertificadoHref,
  tramiteDisplay,
} from "@/modules/ortopedia/prestamo-utils";
import type { PrestamoExpediente } from "@/modules/ortopedia/types";

type Props = {
  prestamos: PrestamoExpediente[];
  loading?: boolean;
  initialPrestamoId?: number | null;
  onRefresh: () => Promise<void>;
  onRenovar: (prestamoId: number) => void;
  onDevolver: (prestamoId: number) => Promise<void>;
};

function PrestamoCardSkeleton() {
  return (
    <div className="data-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3 transition-colors hover:bg-muted/40">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function PrestamoCard({
  prestamo,
  onOpen,
  onRenovar,
  onDevolver,
  onUploadCertificado,
}: {
  prestamo: PrestamoExpediente;
  onOpen: () => void;
  onDevolver: () => Promise<void>;
  onRenovar: () => void;
  onUploadCertificado: () => void;
}) {
  const tramite = tramiteDisplay(prestamo);
  const certificadoHref = resolveCertificadoHref(prestamo);
  const puedeGestionar = prestamo.estado === "ACTIVO" || prestamo.estado === "VENCIDO";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="data-card group w-full space-y-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <p className="text-base font-semibold text-foreground">{prestamo.elemento_nombre}</p>
          </div>
          <p className="text-xs text-slate-500">Prestamo #{prestamo.id}</p>
        </div>
        <Badge variant={prestamoEstadoVariant(prestamo.estado)}>{prestamoEstadoLabel(prestamo.estado)}</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <InfoBlock
          label="Socio"
          value={`${prestamo.titular_nombre} · Cuenta ${prestamo.cod_soc}`}
          icon={<User className="h-3.5 w-3.5" />}
        />
        <InfoBlock label="Categoria" value={prestamo.socio_categoria} icon={<Users className="h-3.5 w-3.5" />} />
        <InfoBlock
          label="Beneficiario"
          value={`${prestamo.paciente_nombre} · ${prestamo.beneficiario_vinculo}${prestamo.beneficiario_edad != null ? ` · ${prestamo.beneficiario_edad} años` : ""}`}
          icon={<User className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{tramite.titulo}</p>
        {tramite.esTitular ? (
          <p className="text-sm font-medium text-foreground">Titular del servicio</p>
        ) : (
          <div className="space-y-1 text-sm text-foreground">
            <p className="font-medium">{tramite.nombre}</p>
            <p className="text-slate-500">DNI {formatDni(tramite.dni)} · {tramite.vinculo}</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoBlock label="Fecha prestamo" value={formatDate(prestamo.fecha_prestamo)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
        <InfoBlock label="Devolucion prevista" value={formatDate(prestamo.fecha_vencimiento)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
        <InfoBlock label="Devolucion real" value={formatDate(prestamo.fecha_devolucion)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
      </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {certificadoHref ? (
            <a
              href={certificadoHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
              Ver certificado
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <>
              <span className="text-sm text-slate-500">Sin certificado adjunto</span>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadCertificado();
                }}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                Subir certificado
              </Button>
            </>
          )}
        </div>

        {puedeGestionar ? (
          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()} role="presentation">
            <Button size="sm" variant="outline" onClick={onRenovar}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Renovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => void onDevolver()}>
              Devolver
            </Button>
          </div>
        ) : null}
      </div>

      {prestamo.observaciones ? (
        <p className="text-sm text-slate-500 line-clamp-2">
          <span className="font-medium text-foreground">Observaciones:</span> {prestamo.observaciones}
        </p>
      ) : null}
    </button>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

export function OrtopediaPrestamosSection({ prestamos, loading, initialPrestamoId, onRefresh, onRenovar, onDevolver }: Props) {
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<PrestamoExpediente | null>(null);
  const [editTramiteEsTitular, setEditTramiteEsTitular] = useState(true);
  const [editTramiteNombre, setEditTramiteNombre] = useState("");
  const [editTramiteDni, setEditTramiteDni] = useState("");
  const [editTramiteTelefono, setEditTramiteTelefono] = useState("");
  const [editTramiteVinculo, setEditTramiteVinculo] = useState("");
  const [editObservaciones, setEditObservaciones] = useState("");
  const [editCertificado, setEditCertificado] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!initialPrestamoId || prestamos.length === 0) return;
    const match = prestamos.find((item) => item.id === initialPrestamoId);
    if (match) {
      setSelected(match);
      setDetalleOpen(true);
    }
  }, [initialPrestamoId, prestamos]);

  function abrirDetalle(prestamo: PrestamoExpediente) {
    setSelected(prestamo);
    setDetalleOpen(true);
  }

  function abrirEdicion(prestamo: PrestamoExpediente) {
    setSelected(prestamo);
    const esTitular = prestamo.tramite_es_titular || !prestamo.tramite_nombre;
    setEditTramiteEsTitular(esTitular);
    setEditTramiteNombre(prestamo.tramite_nombre ?? prestamo.titular_nombre ?? "");
    setEditTramiteDni(prestamo.tramite_dni ?? "");
    setEditTramiteTelefono(prestamo.tramite_telefono ?? "");
    setEditTramiteVinculo(prestamo.tramite_vinculo ?? "Titular");
    setEditObservaciones(prestamo.observaciones ?? "");
    setEditCertificado(null);
    setEditOpen(true);
  }

  async function guardarEdicion() {
    if (!selected) return;
    if (!editTramiteEsTitular) {
      if (!editTramiteNombre.trim()) {
        toast.error("Nombre del tramite es obligatorio");
        return;
      }
      if (!editTramiteDni.trim()) {
        toast.error("DNI del tramite es obligatorio");
        return;
      }
    }

    try {
      setGuardando(true);
      const formData = new FormData();
      formData.append("tramite_es_titular", String(editTramiteEsTitular));
      formData.append("tramite_nombre", editTramiteNombre);
      formData.append("tramite_dni", editTramiteDni);
      formData.append("tramite_telefono", editTramiteTelefono);
      formData.append("tramite_vinculo", editTramiteEsTitular ? "Titular" : editTramiteVinculo);
      formData.append("observaciones", editObservaciones);
      if (editCertificado) formData.append("certificado", editCertificado);

      const response = await fetch(`/api/ortopedia/prestamos/${selected.id}`, { method: "PUT", body: formData });
      const data = (await response.json()) as { success: boolean; error?: string; message?: string; data?: PrestamoExpediente };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo actualizar el expediente");
        return;
      }

      toast.success(data.message ?? "Expediente actualizado");
      setEditOpen(false);
      setDetalleOpen(false);
      await onRefresh();
    } finally {
      setGuardando(false);
    }
  }

  const certificadoHref = selected ? resolveCertificadoHref(selected) : null;
  const tramite = selected ? tramiteDisplay(selected) : null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Expedientes de prestamos</CardTitle>
          <span className="text-xs text-slate-500">{prestamos.length} registros</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <PrestamoCardSkeleton />
              <PrestamoCardSkeleton />
            </div>
          ) : prestamos.length === 0 ? (
            <EmptyState message="No hay prestamos registrados." />
          ) : (
            <div className="space-y-3">
              {prestamos.map((item) => (
                <PrestamoCard
                  key={item.id}
                  prestamo={item}
                  onOpen={() => abrirDetalle(item)}
                  onRenovar={() => onRenovar(item.id)}
                  onDevolver={() => onDevolver(item.id)}
                  onUploadCertificado={() => abrirEdicion(item)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Detalle del prestamo</DialogTitle>
                <DialogDescription>
                  {selected.elemento_nombre} · Socio {selected.cod_soc}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <DetailSection title="Informacion del prestamo">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock label="Elemento" value={selected.elemento_nombre} />
                    <InfoBlock label="Estado" value={prestamoEstadoLabel(selected.estado)} />
                    <InfoBlock label="Fecha prestamo" value={formatDate(selected.fecha_prestamo)} />
                    <InfoBlock label="Devolucion prevista" value={formatDate(selected.fecha_vencimiento)} />
                    <InfoBlock label="Devolucion real" value={formatDate(selected.fecha_devolucion)} />
                    <InfoBlock label="Duracion" value={selected.duracion_dias != null ? `${selected.duracion_dias} dias` : "-"} />
                    <InfoBlock label="Renovaciones" value={String(selected.renovaciones)} />
                  </div>
                </DetailSection>

                <DetailSection title="Beneficiario">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock label="Nombre" value={selected.paciente_nombre} />
                    <InfoBlock label="Cuenta" value={String(selected.cod_soc)} />
                    <InfoBlock label="DNI" value={formatDni(selected.beneficiario_dni)} />
                    <InfoBlock label="Vinculo" value={selected.beneficiario_vinculo} />
                    <InfoBlock label="Edad" value={selected.beneficiario_edad != null ? `${selected.beneficiario_edad} años` : "-"} />
                    <InfoBlock label="Plan / Categoria" value={selected.socio_categoria} />
                  </div>
                </DetailSection>

                <DetailSection title="Persona que realizo el tramite">
                  {tramite?.esTitular ? (
                    <p className="text-sm font-medium text-foreground">Titular del servicio · {tramite.nombre}</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoBlock label="Nombre" value={tramite?.nombre ?? "-"} />
                      <InfoBlock label="DNI" value={formatDni(tramite?.dni)} />
                      <InfoBlock label="Telefono" value={tramite?.telefono || "No registrado"} icon={<Phone className="h-3.5 w-3.5" />} />
                      <InfoBlock label="Vinculo" value={tramite?.vinculo ?? "-"} />
                    </div>
                  )}
                </DetailSection>

                <DetailSection title="Certificado">
                  {certificadoHref ? (
                    <div className="space-y-3">
                      {selected.certificado_es_imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={certificadoHref}
                          alt="Certificado medico"
                          className="max-h-64 w-full rounded-xl border border-border object-contain bg-background"
                        />
                      ) : (
                        <a
                          href={certificadoHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                        >
                          <FileText className="h-4 w-4" />
                          Abrir PDF
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {selected.fecha_certificado ? (
                        <p className="text-xs text-slate-500">Cargado el {formatDateTime(selected.fecha_certificado)}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Sin certificado adjunto</p>
                  )}
                </DetailSection>

                <DetailSection title="Observaciones">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.observaciones || "Sin observaciones"}</p>
                </DetailSection>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => abrirEdicion(selected)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Editar expediente
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => !guardando && setEditOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar expediente</DialogTitle>
            <DialogDescription>
              Podes modificar tramite, observaciones y certificado. Elemento, beneficiario y fechas no son editables.
            </DialogDescription>
          </DialogHeader>

          <div className="field-grid">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={editTramiteEsTitular}
                onChange={(e) => setEditTramiteEsTitular(e.target.checked)}
                disabled={guardando}
              />
              El tramite lo realiza el titular
            </label>

            {!editTramiteEsTitular ? (
              <>
                <label className="grid gap-2">
                  <span className="field-label">Nombre completo *</span>
                  <input
                    value={editTramiteNombre}
                    onChange={(e) => setEditTramiteNombre(e.target.value)}
                    className="h-11 rounded-2xl border border-border bg-input px-4 text-sm"
                    disabled={guardando}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">DNI *</span>
                  <input
                    value={editTramiteDni}
                    onChange={(e) => setEditTramiteDni(e.target.value)}
                    className="h-11 rounded-2xl border border-border bg-input px-4 text-sm"
                    disabled={guardando}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Telefono</span>
                  <input
                    value={editTramiteTelefono}
                    onChange={(e) => setEditTramiteTelefono(e.target.value)}
                    className="h-11 rounded-2xl border border-border bg-input px-4 text-sm"
                    disabled={guardando}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="field-label">Vinculo</span>
                  <input
                    value={editTramiteVinculo}
                    onChange={(e) => setEditTramiteVinculo(e.target.value)}
                    className="h-11 rounded-2xl border border-border bg-input px-4 text-sm"
                    disabled={guardando}
                  />
                </label>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-slate-500">
                Datos del titular: {editTramiteNombre || selected?.titular_nombre || "-"} · DNI {formatDni(editTramiteDni)}
              </div>
            )}

            <label className="grid gap-2">
              <span className="field-label">Observaciones</span>
              <textarea
                value={editObservaciones}
                onChange={(e) => setEditObservaciones(e.target.value)}
                className="min-h-24 rounded-2xl border border-border bg-input px-4 py-3 text-sm"
                disabled={guardando}
              />
            </label>

            <label className="grid gap-2">
              <span className="field-label">Subir certificado</span>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-slate-400" />
                <input
                  type="file"
                  accept={CERTIFICADO_ACCEPT}
                  onChange={(e) => setEditCertificado(e.target.files?.[0] ?? null)}
                  className="flex-1 text-sm"
                  disabled={guardando}
                />
              </div>
              {editCertificado ? (
                <span className="text-xs text-slate-500">{editCertificado.name}</span>
              ) : certificadoHref ? (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <FileImage className="h-3.5 w-3.5" />
                  Ya existe un certificado cargado
                </span>
              ) : null}
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={() => void guardarEdicion()} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Elemento, SocioGrupoRow, SocioSearchRow } from "@/modules/ortopedia/types";
import { CERTIFICADO_ACCEPT } from "@/modules/ortopedia/prestamo-utils";

type Props = {
  elementos: Elemento[];
  onRegistered: () => Promise<void>;
};

function normalizeVinculo(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findTitular(rows: SocioGrupoRow[]) {
  return rows.find((row) => normalizeVinculo(row.VINCULO) === "TITULAR") ?? null;
}

export function OrtopediaAsignacionSection({ elementos, onRegistered }: Props) {
  const elementosDisponibles = useMemo(
    () => elementos.filter((item) => item.activo && Number(item.stock_disponible) > 0),
    [elementos]
  );

  const [socioQuery, setSocioQuery] = useState("");
  const [socioResults, setSocioResults] = useState<SocioSearchRow[]>([]);
  const [showSocioResults, setShowSocioResults] = useState(false);
  const [searchingSocios, setSearchingSocios] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState<SocioSearchRow | null>(null);
  const [titularGrupo, setTitularGrupo] = useState<SocioGrupoRow | null>(null);
  const [selectedElementoId, setSelectedElementoId] = useState("");
  const [prestamoObs, setPrestamoObs] = useState("");
  const [tramiteEsTitular, setTramiteEsTitular] = useState(true);
  const [tramiteNombre, setTramiteNombre] = useState("");
  const [tramiteDni, setTramiteDni] = useState("");
  const [tramiteTelefono, setTramiteTelefono] = useState("");
  const [tramiteVinculo, setTramiteVinculo] = useState("");
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const socioSearchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (socioSearchRef.current?.contains(target)) return;
      setShowSocioResults(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  }, [socioQuery, showSocioResults]);

  useEffect(() => {
    if (!selectedSocio) {
      setTitularGrupo(null);
      return;
    }

    const codSoc = Number(selectedSocio.COD_SOC);
    if (!Number.isInteger(codSoc) || codSoc <= 0) return;

    fetch(`/api/socios/${codSoc}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { success: boolean; data?: SocioGrupoRow[] };
        if (!response.ok || !data.success) return;
        setTitularGrupo(findTitular(data.data ?? []));
      })
      .catch(() => setTitularGrupo(null));
  }, [selectedSocio]);

  useEffect(() => {
    if (!tramiteEsTitular || !titularGrupo) return;
    setTramiteNombre(String(titularGrupo.ADHERENTE_NOMBRE || titularGrupo.APELLIDOS || "").trim());
    setTramiteDni(String(titularGrupo.DNI_ADHERENTE || "").trim());
    setTramiteTelefono("");
    setTramiteVinculo("Titular");
  }, [tramiteEsTitular, titularGrupo]);

  function resetForm() {
    setSelectedElementoId("");
    setPrestamoObs("");
    setTramiteEsTitular(true);
    setTramiteNombre("");
    setTramiteDni("");
    setTramiteTelefono("");
    setTramiteVinculo("");
    setCertificadoFile(null);
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
    if (!tramiteEsTitular) {
      if (!tramiteNombre.trim()) {
        toast.error("Nombre del tramite es obligatorio");
        return;
      }
      if (!tramiteDni.trim()) {
        toast.error("DNI del tramite es obligatorio");
        return;
      }
    }

    try {
      setRegistrando(true);
      const formData = new FormData();
      formData.append("elemento_id", String(elementoId));
      formData.append("cod_soc", String(selectedSocio.COD_SOC));
      formData.append("adherente_codigo", String(selectedSocio.ADHERENTE_CODIGO));
      formData.append("paciente_nombre", selectedSocio.ADHERENTE_NOMBRE || selectedSocio.APELLIDOS);
      formData.append("observaciones", prestamoObs);
      formData.append("tramite_es_titular", String(tramiteEsTitular));
      formData.append("tramite_nombre", tramiteNombre);
      formData.append("tramite_dni", tramiteDni);
      formData.append("tramite_telefono", tramiteTelefono);
      formData.append("tramite_vinculo", tramiteEsTitular ? "Titular" : tramiteVinculo);
      if (certificadoFile) formData.append("certificado", certificadoFile);

      const response = await fetch("/api/ortopedia/prestamos", { method: "POST", body: formData });
      const data = (await response.json()) as { success: boolean; error?: string; message?: string };
      if (!response.ok || !data.success) {
        toast.error(data.error ?? "No se pudo registrar prestamo");
        return;
      }

      toast.success(data.message ?? "Prestamo registrado");
      resetForm();
      await onRegistered();
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Asignar prestamo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div ref={socioSearchRef} className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={socioQuery}
            onFocus={() => setShowSocioResults(true)}
            onChange={(e) => {
              setSocioQuery(e.target.value);
              setShowSocioResults(true);
              setSelectedSocio(null);
            }}
            placeholder="Buscar socio o adherente"
            className="h-11 w-full rounded-2xl border border-border bg-input py-2 pl-11 pr-4 text-sm text-foreground outline-none transition-shadow focus:ring-2 focus:ring-primary/20"
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
                    className="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      setSelectedSocio(row);
                      setSocioQuery(`${row.COD_SOC} - ${row.ADHERENTE_NOMBRE || row.APELLIDOS} (${row.VINCULO || "-"})`);
                      setShowSocioResults(false);
                    }}
                  >
                    <div className="font-medium text-foreground">{row.ADHERENTE_NOMBRE || row.APELLIDOS}</div>
                    <div className="text-xs text-slate-500">
                      Socio {row.COD_SOC} · DNI {row.DNI_ADHERENTE || "-"} · {row.DES_CAT || "Sin categoria"}
                    </div>
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
            <span className="field-label">Observaciones del prestamo</span>
            <input
              value={prestamoObs}
              onChange={(e) => setPrestamoObs(e.target.value)}
              placeholder="Opcional"
              className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Persona que realiza el tramite</h3>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={tramiteEsTitular}
              onChange={(e) => {
                setTramiteEsTitular(e.target.checked);
                if (!e.target.checked) {
                  setTramiteNombre("");
                  setTramiteDni("");
                  setTramiteTelefono("");
                  setTramiteVinculo("");
                }
              }}
              disabled={registrando}
            />
            El tramite lo realiza el titular
          </label>

          {tramiteEsTitular ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="field-help">Nombre</p>
                <p className="field-label">{tramiteNombre || "Selecciona un socio"}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="field-help">DNI</p>
                <p className="field-label">{tramiteDni || "-"}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="field-help">Telefono</p>
                <p className="field-label">{tramiteTelefono || "No registrado"}</p>
              </div>
            </div>
          ) : (
            <div className="field-grid field-grid-2">
              <label className="grid gap-2">
                <span className="field-label">Nombre completo *</span>
                <input
                  value={tramiteNombre}
                  onChange={(e) => setTramiteNombre(e.target.value)}
                  className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                  disabled={registrando}
                />
              </label>
              <label className="grid gap-2">
                <span className="field-label">DNI *</span>
                <input
                  value={tramiteDni}
                  onChange={(e) => setTramiteDni(e.target.value)}
                  className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                  disabled={registrando}
                />
              </label>
              <label className="grid gap-2">
                <span className="field-label">Telefono</span>
                <input
                  value={tramiteTelefono}
                  onChange={(e) => setTramiteTelefono(e.target.value)}
                  className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                  disabled={registrando}
                />
              </label>
              <label className="grid gap-2">
                <span className="field-label">Vinculo</span>
                <input
                  value={tramiteVinculo}
                  onChange={(e) => setTramiteVinculo(e.target.value)}
                  placeholder="Ej: Esposa, Hijo, Apoderado"
                  className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground outline-none"
                  disabled={registrando}
                />
              </label>
            </div>
          )}

          <label className="grid gap-2">
            <span className="field-label">Subir certificado medico</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="file"
                accept={CERTIFICADO_ACCEPT}
                onChange={(e) => setCertificadoFile(e.target.files?.[0] ?? null)}
                className="h-11 flex-1 rounded-2xl border border-border bg-input px-4 text-sm text-foreground"
                disabled={registrando}
              />
              {certificadoFile ? (
                <span className="text-xs text-slate-500">{certificadoFile.name}</span>
              ) : (
                <span className="text-xs text-slate-500">PDF, PNG, JPG · max 10 MB</span>
              )}
            </div>
          </label>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleRegistrarPrestamo} disabled={registrando}>
            {registrando ? "Registrando..." : "Registrar prestamo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

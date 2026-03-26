"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { House, Mail, Phone, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PfcSociosApiResponse, SocioPFC } from "@/types/pfc-socios";

function valueOrFallback(value: string) {
  return value?.trim().length > 0 ? value : "No registrado";
}

function getCategoriaBadgeClass(categoria: string) {
  const normalized = categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (normalized.includes("PLUS")) {
    return "bg-purple-600 text-white";
  }
  if (normalized.includes("BASICA")) {
    return "bg-coopBlue text-white";
  }
  return "bg-slate-500 text-white";
}

export default function SocioDetallePage() {
  const params = useParams<{ id: string }>();
  const socioId = useMemo(() => Number(params?.id), [params?.id]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [socio, setSocio] = useState<SocioPFC | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSocio() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetch("/api/test-table", {
          method: "GET",
          signal: abortController.signal,
          cache: "no-store",
        });
        const data = (await response.json()) as PfcSociosApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.error ?? "Error consultando socio");
        }

        const currentSocio =
          data.rows.find((item) => item.codSoc === socioId) ??
          data.rows.find((item) => String(item.codSoc) === String(params?.id)) ??
          null;

        setSocio(currentSocio);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setLoadError("No se pudieron cargar los socios del sistema Procoop");
      } finally {
        setIsLoading(false);
      }
    }

    loadSocio();

    return () => {
      abortController.abort();
    };
  }, [params?.id, socioId]);

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Detalle de Socio</CardTitle>
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

  if (!socio) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Socio no encontrado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No existe un socio para el codigo solicitado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Detalle de Socio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-semibold">Socio:</span> {socio.codSoc}
          </p>
          <p>
            <span className="font-semibold">Cuenta:</span>{" "}
            {socio.numeroCuenta ? String(socio.numeroCuenta) : "No registrado"}
          </p>
          <p>
            <span className="font-semibold">Titular:</span> {valueOrFallback(socio.titular)}
          </p>
          <p>
            <span className="font-semibold">DNI:</span> {valueOrFallback(socio.dni)}
          </p>
          <p className="flex items-center gap-2">
            <span className="font-semibold">Categoria PFC:</span>
            {socio.desCat ? (
              <Badge className={getCategoriaBadgeClass(socio.desCat)}>{socio.desCat}</Badge>
            ) : (
              "No registrado"
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Contacto y Domicilio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="flex items-start gap-2">
            <House className="mt-0.5 h-4 w-4 text-coopGreen" />
            <div>
              <p className="font-semibold">Domicilio</p>
              <p>{valueOrFallback(socio.direccion)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 text-coopGreen" />
            <div>
              <p className="font-semibold">Movil</p>
              <p>{valueOrFallback(socio.movil)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 text-coopOrange" />
            <div>
              <p className="font-semibold">Correo</p>
              <p>{valueOrFallback(socio.email)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-coopBlue" />
            Adherentes del Socio
          </CardTitle>
          <p className="text-sm text-slate-600">Listado de adherentes vinculados al titular</p>
        </CardHeader>
        <CardContent>
          {socio.adherentes.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-600">
              Este socio aun no posee adherentes registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Vinculo</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {socio.adherentes.map((adherente, index) => (
                  <TableRow key={`${adherente.codigo}-${index}`}>
                    <TableCell>{valueOrFallback(adherente.nombre)}</TableCell>
                    <TableCell>{valueOrFallback(adherente.dni)}</TableCell>
                    <TableCell>{valueOrFallback(adherente.vinculo)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/socios/${encodeURIComponent(String(socio.codSoc))}/${encodeURIComponent(
                          String(adherente.codigo)
                        )}/historial`}
                      >
                        <Button size="sm" variant="outline">
                          Ver historial
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

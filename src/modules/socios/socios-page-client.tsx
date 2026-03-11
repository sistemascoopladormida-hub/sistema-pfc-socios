"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessModule, useUser } from "@/lib/user-context";
import type { PfcSociosApiResponse, SocioPFC } from "@/types/pfc-socios";

export function SociosPageClient() {
  const { role } = useUser();
  const [query, setQuery] = useState("");
  const [socios, setSocios] = useState<SocioPFC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSocios() {
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
          throw new Error(data.error ?? "Error consultando socios");
        }

        setSocios(Array.isArray(data.rows) ? data.rows : []);
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
  }, []);

  const sociosFiltrados = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return socios;
    }

    return socios.filter((socio) => {
      return (
        String(socio.codSoc).includes(normalizedQuery) ||
        socio.titular.toLowerCase().includes(normalizedQuery) ||
        String(socio.numeroCuenta).includes(normalizedQuery) ||
        socio.dni.toLowerCase().includes(normalizedQuery) ||
        socio.movil.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, socios]);

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
    <Card className="bg-white">
      <CardHeader className="space-y-4">
        <CardTitle>Gestion de Socios PFC</CardTitle>
        <Input
          placeholder="Buscar por socio, titular, cuenta, DNI o movil..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-md"
        />
      </CardHeader>
      <CardContent>
        {sociosFiltrados.length === 0 ? (
          <EmptyState message="No hay datos disponibles" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Movil</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sociosFiltrados.map((socio) => (
                <TableRow key={`${socio.codSoc}-${socio.numeroCuenta}`}>
                  <TableCell>{socio.numeroCuenta || "No registrado"}</TableCell>
                  <TableCell>{socio.codSoc || "No registrado"}</TableCell>
                  <TableCell>{socio.titular}</TableCell>
                  <TableCell>{socio.dni || "No registrado"}</TableCell>
                  <TableCell>{socio.movil || "No registrado"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/socios/${encodeURIComponent(String(socio.codSoc))}`}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Ver Detalle
                        </Button>
                      </Link>
                      <Link href={`/turnos?socio=${encodeURIComponent(socio.titular)}`}>
                        <Button size="sm" className="bg-coopBlue text-white hover:bg-coopSecondary">
                          Crear turno
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
  );
}

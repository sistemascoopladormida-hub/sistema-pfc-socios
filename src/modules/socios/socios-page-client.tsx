"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import type { SocioPFC } from "@/lib/readSociosExcel";

type SociosPageClientProps = {
  socios: SocioPFC[];
  loadError?: string;
};

export function SociosPageClient({ socios, loadError }: SociosPageClientProps) {
  const { role } = useUser();
  const [query, setQuery] = useState("");

  const sociosFiltrados = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return socios;
    }

    return socios.filter((socio) => {
      return (
        socio.numero_socio.toLowerCase().includes(normalizedQuery) ||
        socio.titular.toLowerCase().includes(normalizedQuery) ||
        socio.cuenta.includes(normalizedQuery) ||
        socio.dni.includes(normalizedQuery)
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
          placeholder="Buscar por nombre, cuenta o DNI..."
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
                <TableHead>Telefono</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sociosFiltrados.map((socio) => (
                <TableRow key={`${socio.cuenta}-${socio.numero_socio}`}>
                  <TableCell>{socio.cuenta}</TableCell>
                  <TableCell>{socio.numero_socio || "No registrado"}</TableCell>
                  <TableCell>{socio.titular}</TableCell>
                  <TableCell>{socio.dni || "No registrado"}</TableCell>
                  <TableCell>{socio.movil_particular || socio.movil_cuenta || "No registrado"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/socios/${encodeURIComponent(socio.cuenta)}`}>
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

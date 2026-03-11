import "server-only";

import { access, readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

export type SocioPFC = {
  cuenta: string;
  numero_socio: string;
  titular: string;
  dni: string;
  domicilio: string;
  movil_particular: string;
  movil_cuenta: string;
  correo: string;
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  return raw.endsWith(".0") ? raw.slice(0, -2) : raw;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const normalized = rows[i].map((cell) => normalizeHeader(toText(cell)));
    const hasCuenta = normalized.some((cell) => cell.includes("cuenta"));
    const hasTitular = normalized.some((cell) => cell.includes("titular"));
    if (hasCuenta && hasTitular) {
      return i;
    }
  }
  return -1;
}

function splitTitular(rawTitular: string) {
  const withDash = rawTitular.match(/^(\d+)\s*-\s*(.+)$/);
  if (withDash) {
    return {
      numero_socio: withDash[1].trim(),
      titular: withDash[2].trim(),
    };
  }

  const withSpace = rawTitular.match(/^(\d+)\s+(.+)$/);
  if (withSpace) {
    return {
      numero_socio: withSpace[1].trim(),
      titular: withSpace[2].trim(),
    };
  }

  return {
    numero_socio: "",
    titular: rawTitular.trim(),
  };
}

export async function getSociosPFC(): Promise<SocioPFC[]> {
  const candidatePaths = [
    path.join(process.cwd(), "data", "socios_pfc.xlsx"),
    path.join(process.cwd(), "socios_pfc.xlsx"),
  ];

  let excelPath: string | null = null;
  for (const candidate of candidatePaths) {
    try {
      await access(candidate);
      excelPath = candidate;
      break;
    } catch {
      // Keep checking next location.
    }
  }

  if (!excelPath) {
    throw new Error("Excel file not found");
  }

  const fileBuffer = await readFile(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const headerRowIndex = findHeaderRowIndex(matrix);
  if (headerRowIndex === -1) {
    return [];
  }

  const header = matrix[headerRowIndex].map((cell) => normalizeHeader(toText(cell)));

  const getColumnIndex = (matcher: (headerValue: string) => boolean) =>
    header.findIndex(matcher);

  const cuentaCol = getColumnIndex((value) => value === "cuenta");
  const titularCol = getColumnIndex((value) => value === "titular");
  const dniCol = getColumnIndex((value) => value === "dni");
  const domicilioCol = getColumnIndex(
    (value) => value.includes("domicilio") && value.includes("postal")
  );
  const movilParticularCol = getColumnIndex(
    (value) => value.includes("movil") && value.includes("particular")
  );
  const movilCuentaCol = getColumnIndex(
    (value) => value.includes("movil") && value.includes("cuenta")
  );
  const correoCol = getColumnIndex((value) => value.includes("correo") && value.includes("cuenta"));

  const dataRows = matrix.slice(headerRowIndex + 1);

  return dataRows
    .map((row) => {
      const cuenta = cuentaCol >= 0 ? toText(row[cuentaCol]) : "";
      const titularRaw = titularCol >= 0 ? toText(row[titularCol]) : "";
      const dni = dniCol >= 0 ? toText(row[dniCol]) : "";
      const domicilio = domicilioCol >= 0 ? toText(row[domicilioCol]) : "";
      const movil_particular = movilParticularCol >= 0 ? toText(row[movilParticularCol]) : "";
      const movil_cuenta = movilCuentaCol >= 0 ? toText(row[movilCuentaCol]) : "";
      const correo = correoCol >= 0 ? toText(row[correoCol]) : "";
      const { numero_socio, titular } = splitTitular(titularRaw);

      return {
        cuenta,
        numero_socio,
        titular,
        dni,
        domicilio,
        movil_particular,
        movil_cuenta,
        correo,
      } satisfies SocioPFC;
    })
    .filter((row) => row.cuenta.length > 0 && row.titular.length > 0);
}

import sql from "mssql";
import { NextResponse } from "next/server";

import {
  enrichPrestamosRows,
  PRESTAMOS_SELECT_SQL,
  refreshPrestamosVencidos,
  type PrestamoDbRow,
} from "@/lib/ortopedia-prestamos";
import { getSqlConnectionPfc } from "@/lib/sqlserver";

type ElementoRow = {
  id: number;
  nombre: string;
  descripcion: string | null;
  stock_total: number | string;
  stock_disponible: number | string;
  activo: boolean | number;
};

type CrearElementoBody = {
  nombre?: string;
  descripcion?: string;
  stock_total?: number;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    await refreshPrestamosVencidos(pool);

    const [elementosResult, prestamosResult] = await Promise.all([
      pool.request().query(`
        SELECT
          id,
          nombre,
          descripcion,
          stock_total,
          stock_disponible,
          activo
        FROM ortopedia_elementos
        ORDER BY nombre
      `),
      pool.request().query(`
        ${PRESTAMOS_SELECT_SQL}
        ORDER BY
          CASE WHEN p.estado IN ('ACTIVO', 'VENCIDO') THEN 0 ELSE 1 END,
          p.fecha_vencimiento ASC,
          p.creado_en DESC
      `),
    ]);

    const elementos = (elementosResult.recordset as ElementoRow[]).map((row) => ({
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion ?? "",
      stock_total: toNumber(row.stock_total),
      stock_disponible: toNumber(row.stock_disponible),
      activo: Boolean(row.activo),
    }));

    const prestamos = await enrichPrestamosRows(prestamosResult.recordset as PrestamoDbRow[]);

    return NextResponse.json({
      success: true,
      data: { elementos, prestamos },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CrearElementoBody;
    const nombre = normalizeText(body.nombre);
    const descripcion = normalizeText(body.descripcion);
    const stockTotal = toNumber(body.stock_total);

    if (!nombre) {
      return NextResponse.json({ success: false, error: "Nombre es obligatorio" });
    }
    if (!Number.isInteger(stockTotal) || stockTotal < 0) {
      return NextResponse.json({ success: false, error: "Stock total inválido" });
    }

    const pool = await getSqlConnectionPfc();
    await pool
      .request()
      .input("nombre", sql.VarChar(120), nombre)
      .input("descripcion", sql.VarChar(500), descripcion)
      .input("stock_total", sql.Int, stockTotal)
      .query(`
        IF EXISTS (
          SELECT 1
          FROM ortopedia_elementos
          WHERE UPPER(LTRIM(RTRIM(nombre))) = UPPER(LTRIM(RTRIM(@nombre)))
        )
        BEGIN
          RAISERROR('Ya existe un elemento con ese nombre', 16, 1);
          RETURN;
        END

        INSERT INTO ortopedia_elementos
        (
          nombre,
          descripcion,
          stock_total,
          stock_disponible,
          activo,
          creado_en,
          actualizado_en
        )
        VALUES
        (
          @nombre,
          NULLIF(@descripcion, ''),
          @stock_total,
          @stock_total,
          1,
          GETDATE(),
          GETDATE()
        )
      `);

    return NextResponse.json({ success: true, message: "Elemento ortopédico creado" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}


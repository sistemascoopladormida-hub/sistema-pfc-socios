import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type ElementoRow = {
  id: number;
  nombre: string;
  descripcion: string | null;
  stock_total: number | string;
  stock_disponible: number | string;
  activo: boolean | number;
};

type PrestamoRow = {
  id: number;
  elemento_id: number;
  elemento_nombre: string;
  cod_soc: number;
  adherente_codigo: number;
  paciente_nombre: string;
  fecha_prestamo: string | Date;
  fecha_vencimiento: string | Date;
  fecha_devolucion: string | Date | null;
  estado: string;
  observaciones: string | null;
  certificado_presentado: boolean | number;
  renovaciones: number | string;
  certificado_ruta: string | null;
  certificado_nombre: string | null;
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

async function refreshPrestamosVencidos(pool: sql.ConnectionPool) {
  await pool.request().query(`
    UPDATE ortopedia_prestamos
    SET estado = 'VENCIDO',
        actualizado_en = GETDATE()
    WHERE estado = 'ACTIVO'
      AND fecha_devolucion IS NULL
      AND fecha_vencimiento < CAST(GETDATE() AS DATE)
  `);
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
        SELECT
          p.id,
          p.elemento_id,
          e.nombre AS elemento_nombre,
          p.cod_soc,
          p.adherente_codigo,
          p.paciente_nombre,
          p.fecha_prestamo,
          p.fecha_vencimiento,
          p.fecha_devolucion,
          p.estado,
          p.observaciones,
          p.certificado_presentado,
          p.renovaciones,
          c.archivo_ruta AS certificado_ruta,
          c.nombre_original AS certificado_nombre
        FROM ortopedia_prestamos p
        JOIN ortopedia_elementos e ON e.id = p.elemento_id
        OUTER APPLY (
          SELECT TOP 1
            oc.archivo_ruta,
            oc.nombre_original
          FROM ortopedia_certificados oc
          WHERE oc.prestamo_id = p.id
          ORDER BY oc.creado_en DESC, oc.id DESC
        ) c
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

    const prestamos = (prestamosResult.recordset as PrestamoRow[]).map((row) => ({
      id: row.id,
      elemento_id: row.elemento_id,
      elemento_nombre: row.elemento_nombre,
      cod_soc: row.cod_soc,
      adherente_codigo: row.adherente_codigo,
      paciente_nombre: row.paciente_nombre,
      fecha_prestamo: row.fecha_prestamo,
      fecha_vencimiento: row.fecha_vencimiento,
      fecha_devolucion: row.fecha_devolucion,
      estado: row.estado,
      observaciones: row.observaciones ?? "",
      certificado_presentado: Boolean(row.certificado_presentado),
      renovaciones: toNumber(row.renovaciones),
      certificado_ruta: row.certificado_ruta,
      certificado_nombre: row.certificado_nombre,
    }));

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


import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type CrearPrestamoBody = {
  elemento_id?: number;
  cod_soc?: number;
  adherente_codigo?: number;
  paciente_nombre?: string;
  observaciones?: string;
};

function toInt(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  const pool = await getSqlConnectionPfc();
  const tx = new sql.Transaction(pool);
  let started = false;

  try {
    const body = (await request.json()) as CrearPrestamoBody;
    const elementoId = toInt(body.elemento_id);
    const codSoc = toInt(body.cod_soc);
    const adherenteCodigo = toInt(body.adherente_codigo);
    const pacienteNombre = normalizeText(body.paciente_nombre);
    const observaciones = normalizeText(body.observaciones);

    if (!Number.isInteger(elementoId) || elementoId <= 0) {
      return NextResponse.json({ success: false, error: "Elemento inválido" });
    }
    if (!Number.isInteger(codSoc) || codSoc <= 0) {
      return NextResponse.json({ success: false, error: "Socio inválido" });
    }
    if (!Number.isInteger(adherenteCodigo) || adherenteCodigo < 0) {
      return NextResponse.json({ success: false, error: "Adherente inválido" });
    }
    if (!pacienteNombre) {
      return NextResponse.json({ success: false, error: "Nombre de paciente es obligatorio" });
    }

    await tx.begin();
    started = true;

    const stockResult = await new sql.Request(tx).input("id", sql.Int, elementoId).query(`
      SELECT TOP 1 id, nombre, stock_disponible, activo
      FROM ortopedia_elementos
      WHERE id = @id
    `);

    const elemento = stockResult.recordset[0] as
      | { id: number; nombre: string; stock_disponible: number | string; activo: boolean | number }
      | undefined;

    if (!elemento || !Boolean(elemento.activo)) {
      return NextResponse.json({ success: false, error: "Elemento no encontrado o inactivo" });
    }

    const stockDisponible = Number(elemento.stock_disponible ?? 0);
    if (!Number.isInteger(stockDisponible) || stockDisponible <= 0) {
      return NextResponse.json({ success: false, error: "Sin stock disponible para este elemento" });
    }

    await new sql.Request(tx).input("id", sql.Int, elementoId).query(`
      UPDATE ortopedia_elementos
      SET stock_disponible = stock_disponible - 1,
          actualizado_en = GETDATE()
      WHERE id = @id
    `);

    await new sql.Request(tx)
      .input("elemento_id", sql.Int, elementoId)
      .input("cod_soc", sql.Int, codSoc)
      .input("adherente_codigo", sql.Int, adherenteCodigo)
      .input("paciente_nombre", sql.VarChar(200), pacienteNombre)
      .input("observaciones", sql.VarChar(500), observaciones)
      .query(`
        INSERT INTO ortopedia_prestamos
        (
          elemento_id,
          cod_soc,
          adherente_codigo,
          paciente_nombre,
          fecha_prestamo,
          fecha_vencimiento,
          fecha_devolucion,
          estado,
          observaciones,
          certificado_presentado,
          renovaciones,
          creado_en,
          actualizado_en
        )
        VALUES
        (
          @elemento_id,
          @cod_soc,
          @adherente_codigo,
          @paciente_nombre,
          CAST(GETDATE() AS DATE),
          DATEADD(DAY, 60, CAST(GETDATE() AS DATE)),
          NULL,
          'ACTIVO',
          NULLIF(@observaciones, ''),
          0,
          0,
          GETDATE(),
          GETDATE()
        )
      `);

    await tx.commit();
    started = false;

    return NextResponse.json({ success: true, message: "Préstamo registrado (60 días)" });
  } catch (error) {
    if (started) {
      try {
        await tx.rollback();
      } catch {
        // no-op
      }
    }
    return NextResponse.json({ success: false, error: String(error) });
  }
}


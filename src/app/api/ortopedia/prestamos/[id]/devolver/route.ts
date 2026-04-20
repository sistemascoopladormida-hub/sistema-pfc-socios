import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

function parseId(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(_: Request, { params }: Params) {
  const prestamoId = parseId(params.id);
  if (!prestamoId) {
    return NextResponse.json({ success: false, error: "ID de préstamo inválido" });
  }

  const pool = await getSqlConnectionPfc();
  const tx = new sql.Transaction(pool);
  let started = false;

  try {
    await tx.begin();
    started = true;

    const prestamoResult = await new sql.Request(tx).input("id", sql.Int, prestamoId).query(`
      SELECT TOP 1 id, elemento_id, estado, fecha_devolucion
      FROM ortopedia_prestamos
      WHERE id = @id
    `);
    const prestamo = prestamoResult.recordset[0] as
      | { id: number; elemento_id: number; estado: string; fecha_devolucion: string | Date | null }
      | undefined;

    if (!prestamo || prestamo.fecha_devolucion) {
      return NextResponse.json({ success: false, error: "Préstamo no encontrado o ya devuelto" });
    }

    await new sql.Request(tx).input("id", sql.Int, prestamoId).query(`
      UPDATE ortopedia_prestamos
      SET
        fecha_devolucion = CAST(GETDATE() AS DATE),
        estado = 'DEVUELTO',
        actualizado_en = GETDATE()
      WHERE id = @id
    `);

    await new sql.Request(tx).input("elemento_id", sql.Int, prestamo.elemento_id).query(`
      UPDATE ortopedia_elementos
      SET stock_disponible = stock_disponible + 1,
          actualizado_en = GETDATE()
      WHERE id = @elemento_id
    `);

    await tx.commit();
    started = false;

    return NextResponse.json({ success: true, message: "Elemento devuelto y stock actualizado" });
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


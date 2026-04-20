import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

type UpdateElementoBody = {
  nombre?: string;
  descripcion?: string;
  stock_total?: number;
  activo?: boolean;
};

function parseId(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function toInt(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

export async function GET(_: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT TOP 1
        id,
        nombre,
        descripcion,
        stock_total,
        stock_disponible,
        activo
      FROM ortopedia_elementos
      WHERE id = @id
    `);

    const row = result.recordset[0] as
      | {
          id: number;
          nombre: string;
          descripcion: string | null;
          stock_total: number | string;
          stock_disponible: number | string;
          activo: boolean | number;
        }
      | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: "Elemento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion ?? "",
        stock_total: Number(row.stock_total ?? 0),
        stock_disponible: Number(row.stock_disponible ?? 0),
        activo: Boolean(row.activo),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateElementoBody;
    const nombre = normalizeText(body.nombre);
    const descripcion = normalizeText(body.descripcion);
    const stockTotal = toInt(body.stock_total);
    const activo = Boolean(body.activo);

    if (!nombre) {
      return NextResponse.json({ success: false, error: "Nombre obligatorio" }, { status: 400 });
    }
    if (!Number.isInteger(stockTotal) || stockTotal < 0) {
      return NextResponse.json({ success: false, error: "Stock total inválido" }, { status: 400 });
    }

    const pool = await getSqlConnectionPfc();
    const tx = new sql.Transaction(pool);
    let started = false;

    try {
      await tx.begin();
      started = true;

      const currentResult = await new sql.Request(tx).input("id", sql.Int, id).query(`
        SELECT TOP 1 id, stock_total, stock_disponible
        FROM ortopedia_elementos
        WHERE id = @id
      `);
      const current = currentResult.recordset[0] as
        | { id: number; stock_total: number | string; stock_disponible: number | string }
        | undefined;
      if (!current) {
        return NextResponse.json({ success: false, error: "Elemento no encontrado" }, { status: 404 });
      }

      const currentTotal = Number(current.stock_total ?? 0);
      const currentDisponible = Number(current.stock_disponible ?? 0);
      const prestados = Math.max(currentTotal - currentDisponible, 0);
      if (stockTotal < prestados) {
        return NextResponse.json(
          {
            success: false,
            error: `No puedes bajar el stock total por debajo de ${prestados} (actualmente prestados)`,
          },
          { status: 400 }
        );
      }

      const nuevoDisponible = Math.max(stockTotal - prestados, 0);

      await new sql.Request(tx)
        .input("id", sql.Int, id)
        .input("nombre", sql.VarChar(120), nombre)
        .input("descripcion", sql.VarChar(500), descripcion)
        .input("stock_total", sql.Int, stockTotal)
        .input("stock_disponible", sql.Int, nuevoDisponible)
        .input("activo", sql.Bit, activo)
        .query(`
          IF EXISTS (
            SELECT 1 FROM ortopedia_elementos
            WHERE id <> @id
              AND UPPER(LTRIM(RTRIM(nombre))) = UPPER(LTRIM(RTRIM(@nombre)))
          )
          BEGIN
            RAISERROR('Ya existe otro elemento con ese nombre', 16, 1);
            RETURN;
          END

          UPDATE ortopedia_elementos
          SET
            nombre = @nombre,
            descripcion = NULLIF(@descripcion, ''),
            stock_total = @stock_total,
            stock_disponible = @stock_disponible,
            activo = @activo,
            actualizado_en = GETDATE()
          WHERE id = @id
        `);

      await tx.commit();
      started = false;

      return NextResponse.json({ success: true, message: "Elemento actualizado" });
    } catch (error) {
      if (started) {
        try {
          await tx.rollback();
        } catch {
          // no-op
        }
      }
      return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
  }

  try {
    const pool = await getSqlConnectionPfc();
    const activeResult = await pool.request().input("id", sql.Int, id).query(`
      SELECT COUNT(*) AS total
      FROM ortopedia_prestamos
      WHERE elemento_id = @id
        AND estado IN ('ACTIVO', 'VENCIDO')
        AND fecha_devolucion IS NULL
    `);
    const activos = Number(activeResult.recordset[0]?.total ?? 0);
    if (activos > 0) {
      return NextResponse.json(
        { success: false, error: "No se puede eliminar: hay préstamos activos o vencidos para este elemento" },
        { status: 400 }
      );
    }

    await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM ortopedia_elementos
      WHERE id = @id
    `);

    return NextResponse.json({ success: true, message: "Elemento eliminado" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}


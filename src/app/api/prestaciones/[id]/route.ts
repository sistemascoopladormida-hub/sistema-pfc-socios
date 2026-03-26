import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

type UpdatePrestacionBody = {
  nombre?: string;
  especialidad_id?: number;
};

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID invalido",
      });
    }

    const body = (await request.json()) as UpdatePrestacionBody;
    const nombre = String(body.nombre ?? "").trim();
    const especialidadId = Number(body.especialidad_id);

    if (!nombre || !Number.isInteger(especialidadId) || especialidadId <= 0) {
      return NextResponse.json({
        success: false,
        error: "Datos invalidos. Envia nombre y especialidad_id",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("nombre", sql.VarChar(255), nombre)
      .input("especialidad_id", sql.Int, especialidadId)
      .query(`
        UPDATE prestaciones
        SET
          nombre = @nombre,
          especialidad_id = @especialidad_id
        WHERE id = @id
      `);

    return NextResponse.json({
      success: true,
      message: "Prestacion actualizada",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const id = parseId(params.id);
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "ID invalido",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM prestaciones
      WHERE id = @id
    `);

    return NextResponse.json({
      success: true,
      message: "Prestacion eliminada",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

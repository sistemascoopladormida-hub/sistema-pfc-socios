import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Params = {
  params: {
    id: string;
  };
};

type UpdateEspecialidadBody = {
  nombre?: string;
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

    const body = (await request.json()) as UpdateEspecialidadBody;
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) {
      return NextResponse.json({
        success: false,
        error: "El nombre es obligatorio",
      });
    }

    const pool = await getSqlConnectionPfc();
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("nombre", sql.VarChar(255), nombre)
      .query(`
        UPDATE especialidades
        SET nombre = @nombre
        WHERE id = @id
      `);

    return NextResponse.json({
      success: true,
      message: "Especialidad actualizada",
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
      DELETE FROM especialidades
      WHERE id = @id
    `);

    return NextResponse.json({
      success: true,
      message: "Especialidad eliminada",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

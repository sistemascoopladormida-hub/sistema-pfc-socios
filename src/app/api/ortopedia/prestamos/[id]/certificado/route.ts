import sql from "mssql";
import { readFile } from "fs/promises";
import path from "path";
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

export async function GET(_: Request, { params }: Params) {
  const prestamoId = parseId(params.id);
  if (!prestamoId) {
    return NextResponse.json({ success: false, error: "ID de préstamo inválido" }, { status: 400 });
  }

  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().input("prestamo_id", sql.Int, prestamoId).query(`
      SELECT TOP 1
        archivo_ruta,
        nombre_original,
        mime_type
      FROM ortopedia_certificados
      WHERE prestamo_id = @prestamo_id
      ORDER BY creado_en DESC, id DESC
    `);

    const certificado = result.recordset[0] as
      | { archivo_ruta: string; nombre_original: string; mime_type: string | null }
      | undefined;
    if (!certificado?.archivo_ruta) {
      return NextResponse.json({ success: false, error: "No hay certificado cargado para este préstamo" }, { status: 404 });
    }

    const uploadsBase = path.resolve(process.cwd(), "uploads");
    const absFile = path.resolve(process.cwd(), certificado.archivo_ruta);

    if (!absFile.startsWith(uploadsBase)) {
      return NextResponse.json({ success: false, error: "Ruta de certificado inválida" }, { status: 400 });
    }

    const fileBuffer = await readFile(absFile);
    const mime = certificado.mime_type || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${certificado.nombre_original || "certificado"}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}


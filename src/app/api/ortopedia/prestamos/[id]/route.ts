import sql from "mssql";
import { NextResponse } from "next/server";

import {
  enrichPrestamosRows,
  mapPrestamoRow,
  PRESTAMOS_SELECT_SQL,
  type PrestamoDbRow,
} from "@/lib/ortopedia-prestamos";
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

async function fetchPrestamoRow(pool: sql.ConnectionPool, id: number) {
  const result = await pool.request().input("id", sql.Int, id).query(`
    ${PRESTAMOS_SELECT_SQL}
    WHERE p.id = @id
  `);
  return result.recordset[0] as PrestamoDbRow | undefined;
}

export async function GET(_: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ success: false, error: "ID invalido" }, { status: 400 });
  }

  try {
    const pool = await getSqlConnectionPfc();
    const row = await fetchPrestamoRow(pool, id);
    if (!row) {
      return NextResponse.json({ success: false, error: "Prestamo no encontrado" }, { status: 404 });
    }

    const [enriched] = await enrichPrestamosRows([row]);
    return NextResponse.json({ success: true, data: enriched ?? mapPrestamoRow(row) });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ success: false, error: "ID invalido" }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const tramiteNombre = String(form.get("tramite_nombre") ?? "").trim();
    const tramiteDni = String(form.get("tramite_dni") ?? "").trim();
    const tramiteTelefono = String(form.get("tramite_telefono") ?? "").trim();
    const tramiteVinculo = String(form.get("tramite_vinculo") ?? "").trim();
    const tramiteEsTitular = String(form.get("tramite_es_titular") ?? "false") === "true";
    const observaciones = String(form.get("observaciones") ?? "").trim();
    const certificado = form.get("certificado");

    if (!tramiteEsTitular) {
      if (!tramiteNombre) {
        return NextResponse.json({ success: false, error: "Nombre del tramite es obligatorio" }, { status: 400 });
      }
      if (!tramiteDni) {
        return NextResponse.json({ success: false, error: "DNI del tramite es obligatorio" }, { status: 400 });
      }
    }

    const pool = await getSqlConnectionPfc();
    const current = await fetchPrestamoRow(pool, id);
    if (!current) {
      return NextResponse.json({ success: false, error: "Prestamo no encontrado" }, { status: 404 });
    }

    let certificadoUrl = current.certificado_url;
    let fechaCertificado = current.fecha_certificado;
    let certificadoPresentado = Boolean(current.certificado_presentado);

    if (certificado instanceof File && certificado.size > 0) {
      const { saveOrtopediaCertificado } = await import("@/lib/ortopedia-certificado");
      const saved = await saveOrtopediaCertificado(id, certificado);
      certificadoUrl = saved.publicUrl;
      fechaCertificado = new Date();
      certificadoPresentado = true;
    }

    const vinculoFinal = tramiteEsTitular ? "Titular" : tramiteVinculo || null;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("tramite_nombre", sql.VarChar(150), tramiteNombre || null)
      .input("tramite_dni", sql.VarChar(20), tramiteDni || null)
      .input("tramite_telefono", sql.VarChar(50), tramiteTelefono || null)
      .input("tramite_vinculo", sql.VarChar(100), vinculoFinal)
      .input("observaciones", sql.VarChar(sql.MAX), observaciones || null)
      .input("certificado_url", sql.VarChar(500), certificadoUrl)
      .input("fecha_certificado", sql.DateTime, fechaCertificado ? new Date(fechaCertificado) : null)
      .input("certificado_presentado", sql.Bit, certificadoPresentado)
      .query(`
        UPDATE ortopedia_prestamos
        SET
          tramite_nombre = @tramite_nombre,
          tramite_dni = @tramite_dni,
          tramite_telefono = @tramite_telefono,
          tramite_vinculo = @tramite_vinculo,
          observaciones = NULLIF(@observaciones, ''),
          certificado_url = @certificado_url,
          fecha_certificado = @fecha_certificado,
          certificado_presentado = @certificado_presentado,
          actualizado_en = GETDATE()
        WHERE id = @id
      `);

    const updated = await fetchPrestamoRow(pool, id);
    const [enriched] = updated ? await enrichPrestamosRows([updated]) : [];

    return NextResponse.json({
      success: true,
      message: "Expediente de prestamo actualizado",
      data: enriched,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

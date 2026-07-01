import sql from "mssql";
import { NextResponse } from "next/server";

import { normalizeText, saveOrtopediaCertificado } from "@/lib/ortopedia-certificado";
import { getSqlConnectionPfc } from "@/lib/sqlserver";

type CrearPrestamoBody = {
  elemento_id?: number;
  cod_soc?: number;
  adherente_codigo?: number;
  paciente_nombre?: string;
  observaciones?: string;
  tramite_es_titular?: boolean;
  tramite_nombre?: string;
  tramite_dni?: string;
  tramite_telefono?: string;
  tramite_vinculo?: string;
};

function toInt(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function parseBool(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true" || text === "1") return true;
  if (text === "false" || text === "0") return false;
  return fallback;
}

async function parsePrestamoPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      body: {
        elemento_id: toInt(form.get("elemento_id")),
        cod_soc: toInt(form.get("cod_soc")),
        adherente_codigo: toInt(form.get("adherente_codigo")),
        paciente_nombre: normalizeText(form.get("paciente_nombre")),
        observaciones: normalizeText(form.get("observaciones")),
        tramite_es_titular: parseBool(form.get("tramite_es_titular"), true),
        tramite_nombre: normalizeText(form.get("tramite_nombre")),
        tramite_dni: normalizeText(form.get("tramite_dni")),
        tramite_telefono: normalizeText(form.get("tramite_telefono")),
        tramite_vinculo: normalizeText(form.get("tramite_vinculo")),
      } satisfies CrearPrestamoBody,
      certificado: form.get("certificado"),
    };
  }

  const body = (await request.json()) as CrearPrestamoBody;
  return {
    body: {
      ...body,
      tramite_es_titular: parseBool(body.tramite_es_titular, true),
    },
    certificado: null,
  };
}

export async function POST(request: Request) {
  const pool = await getSqlConnectionPfc();
  const tx = new sql.Transaction(pool);
  let started = false;

  try {
    const { body, certificado } = await parsePrestamoPayload(request);
    const elementoId = toInt(body.elemento_id);
    const codSoc = toInt(body.cod_soc);
    const adherenteCodigo = toInt(body.adherente_codigo);
    const pacienteNombre = normalizeText(body.paciente_nombre);
    const observaciones = normalizeText(body.observaciones);
    const tramiteEsTitular = parseBool(body.tramite_es_titular, true);
    const tramiteNombre = normalizeText(body.tramite_nombre);
    const tramiteDni = normalizeText(body.tramite_dni);
    const tramiteTelefono = normalizeText(body.tramite_telefono);
    const tramiteVinculo = normalizeText(body.tramite_vinculo);

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

    if (!tramiteEsTitular) {
      if (!tramiteNombre) {
        return NextResponse.json({ success: false, error: "Nombre del tramite es obligatorio" });
      }
      if (!tramiteDni) {
        return NextResponse.json({ success: false, error: "DNI del tramite es obligatorio" });
      }
    }

    if (certificado instanceof File && certificado.size > 0) {
      try {
        const { isAllowedCertificadoFile, ORTOPEDIA_MAX_CERT_BYTES } = await import("@/lib/ortopedia-certificado");
        if (!isAllowedCertificadoFile(certificado)) {
          return NextResponse.json({ success: false, error: "Formato no permitido. Solo PDF, PNG, JPG o JPEG" });
        }
        if (certificado.size > ORTOPEDIA_MAX_CERT_BYTES) {
          return NextResponse.json({ success: false, error: "El archivo supera el maximo permitido (10 MB)" });
        }
      } catch (error) {
        return NextResponse.json({ success: false, error: String(error) });
      }
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

    const vinculoFinal = tramiteEsTitular ? "Titular" : tramiteVinculo || null;

    const insertResult = await new sql.Request(tx)
      .input("elemento_id", sql.Int, elementoId)
      .input("cod_soc", sql.Int, codSoc)
      .input("adherente_codigo", sql.Int, adherenteCodigo)
      .input("paciente_nombre", sql.VarChar(200), pacienteNombre)
      .input("observaciones", sql.VarChar(sql.MAX), observaciones)
      .input("tramite_nombre", sql.VarChar(150), tramiteNombre || null)
      .input("tramite_dni", sql.VarChar(20), tramiteDni || null)
      .input("tramite_telefono", sql.VarChar(50), tramiteTelefono || null)
      .input("tramite_vinculo", sql.VarChar(100), vinculoFinal)
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
          tramite_nombre,
          tramite_dni,
          tramite_telefono,
          tramite_vinculo,
          certificado_url,
          fecha_certificado,
          creado_en,
          actualizado_en
        )
        OUTPUT INSERTED.id
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
          @tramite_nombre,
          @tramite_dni,
          @tramite_telefono,
          @tramite_vinculo,
          NULL,
          NULL,
          GETDATE(),
          GETDATE()
        )
      `);

    const prestamoId = Number(insertResult.recordset[0]?.id ?? 0);
    if (!prestamoId) {
      throw new Error("No se pudo obtener el ID del prestamo creado");
    }

    if (certificado instanceof File && certificado.size > 0) {
      const saved = await saveOrtopediaCertificado(prestamoId, certificado);
      await new sql.Request(tx)
        .input("id", sql.Int, prestamoId)
        .input("certificado_url", sql.VarChar(500), saved.publicUrl)
        .query(`
          UPDATE ortopedia_prestamos
          SET
            certificado_url = @certificado_url,
            fecha_certificado = GETDATE(),
            certificado_presentado = 1,
            actualizado_en = GETDATE()
          WHERE id = @id
        `);
    }

    await tx.commit();
    started = false;

    return NextResponse.json({
      success: true,
      message: "Préstamo registrado (60 días)",
      data: { id: prestamoId },
    });
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

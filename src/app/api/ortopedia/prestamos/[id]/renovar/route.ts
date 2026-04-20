import sql from "mssql";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

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

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function PUT(request: Request, { params }: Params) {
  const prestamoId = parseId(params.id);
  if (!prestamoId) {
    return NextResponse.json({ success: false, error: "ID de préstamo inválido" });
  }

  try {
    const form = await request.formData();
    const obs = normalizeText(form.get("observaciones"));
    const certificado = form.get("certificado");
    if (!(certificado instanceof File)) {
      return NextResponse.json({ success: false, error: "Debes adjuntar una imagen del certificado médico" });
    }
    if (!String(certificado.type || "").startsWith("image/")) {
      return NextResponse.json({ success: false, error: "El certificado debe ser una imagen (JPG, PNG, WEBP, etc.)" });
    }
    const maxBytes = 8 * 1024 * 1024; // 8MB
    if (certificado.size > maxBytes) {
      return NextResponse.json({ success: false, error: "La imagen supera el máximo permitido (8MB)" });
    }

    const ext = (path.extname(certificado.name || "").replace(".", "").toLowerCase() || "bin").replace(/[^a-z0-9]/g, "");
    const safeExt = ext || "bin";
    const folder = path.join(process.cwd(), "uploads", "ortopedia-certificados");
    await mkdir(folder, { recursive: true });
    const fileName = `prestamo_${prestamoId}_${Date.now()}_${randomUUID().slice(0, 8)}.${safeExt}`;
    const absolutePath = path.join(folder, fileName);
    const buffer = Buffer.from(await certificado.arrayBuffer());
    await writeFile(absolutePath, buffer);

    const rutaLocal = path.join("uploads", "ortopedia-certificados", fileName).replace(/\\/g, "/");
    const pool = await getSqlConnectionPfc();

    await pool.request().query(`
      IF OBJECT_ID('dbo.ortopedia_certificados', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.ortopedia_certificados (
          id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          prestamo_id INT NOT NULL,
          archivo_ruta VARCHAR(500) NOT NULL,
          nombre_original VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NULL,
          tamano_bytes INT NOT NULL,
          creado_en DATETIME NOT NULL DEFAULT (GETDATE()),
          CONSTRAINT FK_ortopedia_certificados_prestamo
            FOREIGN KEY (prestamo_id) REFERENCES dbo.ortopedia_prestamos(id)
        );
      END
    `);

    const result = await pool
      .request()
      .input("id", sql.Int, prestamoId)
      .input("observaciones", sql.VarChar(500), obs)
      .query(`
        UPDATE ortopedia_prestamos
        SET
          fecha_vencimiento = DATEADD(DAY, 60, CAST(GETDATE() AS DATE)),
          estado = 'ACTIVO',
          certificado_presentado = 1,
          renovaciones = ISNULL(renovaciones, 0) + 1,
          observaciones = CASE
            WHEN NULLIF(@observaciones, '') IS NULL THEN observaciones
            ELSE @observaciones
          END,
          actualizado_en = GETDATE()
        WHERE id = @id
          AND fecha_devolucion IS NULL
          AND estado IN ('ACTIVO', 'VENCIDO')
      `);

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return NextResponse.json({
        success: false,
        error: "No se pudo renovar (préstamo inexistente, devuelto o no renovable)",
      });
    }

    await pool
      .request()
      .input("prestamo_id", sql.Int, prestamoId)
      .input("archivo_ruta", sql.VarChar(500), rutaLocal)
      .input("nombre_original", sql.VarChar(255), String(certificado.name || "certificado"))
      .input("mime_type", sql.VarChar(100), String(certificado.type || "application/octet-stream"))
      .input("tamano_bytes", sql.Int, Number(certificado.size))
      .query(`
        INSERT INTO ortopedia_certificados
        (
          prestamo_id,
          archivo_ruta,
          nombre_original,
          mime_type,
          tamano_bytes,
          creado_en
        )
        VALUES
        (
          @prestamo_id,
          @archivo_ruta,
          @nombre_original,
          @mime_type,
          @tamano_bytes,
          GETDATE()
        )
      `);

    return NextResponse.json({
      success: true,
      message: "Préstamo renovado por 60 días y certificado guardado localmente",
      data: { ruta: rutaLocal },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}


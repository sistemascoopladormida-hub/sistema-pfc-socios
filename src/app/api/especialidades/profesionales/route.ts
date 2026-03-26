import { NextResponse } from "next/server";

import { getSqlConnectionPfc } from "@/lib/sqlserver";

type Row = {
  id: number;
  nombre: string;
  profesional_id: number | null;
  profesional: string | null;
};

export async function GET() {
  try {
    const pool = await getSqlConnectionPfc();
    const result = await pool.request().query(`
      SELECT
        e.id,
        e.nombre,
        p.id as profesional_id,
        p.nombre as profesional
      FROM especialidades e
      LEFT JOIN profesionales p
        ON p.especialidad_id = e.id
      ORDER BY e.nombre, p.nombre
    `);

    const rows = result.recordset as Row[];
    const grouped = rows.reduce<
      Array<{
        id: number;
        nombre: string;
        profesionales: Array<{ id: number; nombre: string }>;
      }>
    >((acc, row) => {
      let group = acc.find((item) => item.id === row.id);
      if (!group) {
        group = {
          id: row.id,
          nombre: row.nombre,
          profesionales: [],
        };
        acc.push(group);
      }

      if (row.profesional_id && row.profesional) {
        group.profesionales.push({
          id: row.profesional_id,
          nombre: row.profesional,
        });
      }

      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

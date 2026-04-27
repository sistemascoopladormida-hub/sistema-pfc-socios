import sql from "mssql";
import { NextResponse } from "next/server";

import { getSqlConnection, getSqlConnectionPfc } from "@/lib/sqlserver";

type RouteContext = {
  params: {
    id: string;
  };
};

type TurnoMesRaw = {
  id: number;
  fecha: string | Date;
  hora: string | Date;
  estado: string;
  cod_soc: number;
  adherente_codigo: number;
  prestacion: string;
};

type SocioLookupRow = {
  COD_SOC: number;
  ADHERENTE_CODIGO: number;
  ADHERENTE_NOMBRE: string;
  APELLIDOS: string;
};

async function resolveColumnByAliases(
  pool: sql.ConnectionPool,
  tableName: string,
  aliases: string[]
): Promise<string | null> {
  const result = await pool.request().input("table_name", sql.VarChar(128), tableName).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @table_name
  `);
  const rows = result.recordset as Array<{ COLUMN_NAME: string }>;
  const normalizedMap = new Map<string, string>();
  for (const row of rows) {
    normalizedMap.set(row.COLUMN_NAME.toLowerCase(), row.COLUMN_NAME);
  }
  for (const alias of aliases) {
    const found = normalizedMap.get(alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

function normalizeHora(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  const [hh = "00", mm = "00"] = String(value).split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const profesionalId = Number(params.id);
    if (!Number.isInteger(profesionalId) || profesionalId <= 0) {
      return NextResponse.json({
        success: false,
        error: "ID de profesional invalido",
      });
    }

    const { searchParams } = new URL(request.url);
    const mes = Number(searchParams.get("mes") ?? 0);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return NextResponse.json({
        success: false,
        error: "El mes debe estar entre 1 y 12",
      });
    }

    const pool = await getSqlConnectionPfc();
    const sociosPool = await getSqlConnection();
    const turnosPrestacionColumn = await resolveColumnByAliases(pool, "turnos", [
      "prestacion_id",
      "id_prestacion",
      "cod_prestacion",
      "prestacion",
      "idprestacion",
    ]);
    if (!turnosPrestacionColumn) {
      return NextResponse.json({
        success: false,
        error: "No se pudo resolver la columna de prestacion en turnos",
      });
    }

    const turnosResult = await pool
      .request()
      .input("profesional_id", sql.Int, profesionalId)
      .input("mes", sql.Int, mes)
      .query(`
        SELECT
          t.id,
          t.fecha,
          t.hora,
          t.estado,
          t.cod_soc,
          t.adherente_codigo,
          p.nombre as prestacion
        FROM turnos t
        JOIN prestaciones p ON p.id = t.${turnosPrestacionColumn}
        WHERE t.profesional_id = @profesional_id
          AND MONTH(t.fecha) = @mes
          AND YEAR(t.fecha) = YEAR(GETDATE())
          AND t.estado IN ('RESERVADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO')
        ORDER BY t.fecha DESC, t.hora DESC
      `);

    const turnos = turnosResult.recordset as TurnoMesRaw[];
    const codSocList = [...new Set(turnos.map((item) => Number(item.cod_soc)).filter(Number.isFinite))];
    const sociosMap = new Map<string, string>();

    if (codSocList.length > 0) {
      const sociosResult = await sociosPool.request().query(`
        SELECT
          COD_SOC,
          ADHERENTE_CODIGO,
          ADHERENTE_NOMBRE,
          APELLIDOS
        FROM PR_DORM.dbo.vw_socios_adherentes
        WHERE COD_SOC IN (${codSocList.join(",")})
      `);

      for (const row of sociosResult.recordset as SocioLookupRow[]) {
        const key = `${Number(row.COD_SOC)}-${Number(row.ADHERENTE_CODIGO)}`;
        const nombre = String(row.ADHERENTE_NOMBRE || row.APELLIDOS || "").trim();
        if (nombre) sociosMap.set(key, nombre);
      }
    }

    return NextResponse.json({
      success: true,
      data: turnos.map((item) => ({
        ...item,
        hora: normalizeHora(item.hora),
        paciente:
          sociosMap.get(`${Number(item.cod_soc)}-${Number(item.adherente_codigo)}`) ??
          `Socio ${Number(item.cod_soc)}`,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

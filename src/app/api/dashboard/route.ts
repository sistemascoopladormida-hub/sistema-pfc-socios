import { NextResponse } from "next/server";

import { calcularEdad, esVinculoHijo } from "@/lib/adherentes-beneficios";
import { getSqlConnection, getSqlConnectionPfc } from "@/lib/sqlserver";

type TotalRow = {
  total: number | string | null;
};

type SocioClasificacionRow = {
  VINCULO: string | null;
  FECHA_NACIMIENTO: string | Date | null;
};

type PrestacionTopRow = {
  nombre: string;
  total: number | string;
};

type TurnoRecienteRow = {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  cod_soc: number | string;
  prestacion: string;
  profesional: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    const billingPool = await getSqlConnection();
    const pfcPool = await getSqlConnectionPfc();

    const [
      clasificacionSociosResult,
    ] = await Promise.all([
      billingPool.request().query(`
        SELECT
          VINCULO,
          FECHA_NACIMIENTO
        FROM PR_DORM.dbo.vw_socios_adherentes
      `),
    ]);

    const [
      turnosHoyResult,
      profesionalesActivosResult,
      prestacionesMesResult,
      prestacionesTopResult,
      turnosRecientesResult,
    ] = await Promise.all([
      pfcPool.request().query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE fecha = CAST(GETDATE() AS DATE)
          AND estado = 'RESERVADO'
      `),
      pfcPool.request().query(`
        SELECT COUNT(DISTINCT profesional_id) as total
        FROM agenda_profesional
      `),
      pfcPool.request().query(`
        SELECT COUNT(*) as total
        FROM turnos
        WHERE estado = 'ATENDIDO'
          AND MONTH(fecha) = MONTH(GETDATE())
          AND YEAR(fecha) = YEAR(GETDATE())
      `),
      pfcPool.request().query(`
        SELECT TOP 5
          p.nombre,
          COUNT(*) as total
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        WHERE t.estado = 'ATENDIDO'
          AND MONTH(t.fecha) = MONTH(GETDATE())
          AND YEAR(t.fecha) = YEAR(GETDATE())
        GROUP BY p.nombre
        ORDER BY total DESC
      `),
      pfcPool.request().query(`
        SELECT TOP 5
          t.id,
          t.fecha,
          t.hora,
          t.estado,
          t.cod_soc,
          p.nombre as prestacion,
          pr.nombre as profesional
        FROM turnos t
        JOIN prestaciones p ON p.id = t.prestacion_id
        JOIN profesionales pr ON pr.id = t.profesional_id
        ORDER BY t.creado_en DESC
      `),
    ]);

    const sociosRows = clasificacionSociosResult.recordset as SocioClasificacionRow[];
    const resumenSocios = sociosRows.reduce(
      (acc, row) => {
        const vinculoNormalizado = String(row.VINCULO ?? "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const esTitular = vinculoNormalizado === "TITULAR";
        const esConyuge = vinculoNormalizado === "CONYUGE";
        const esOtros = vinculoNormalizado === "OTROS" || vinculoNormalizado === "OTRO";
        const esHijo = esVinculoHijo(row.VINCULO);
        const edad = calcularEdad(row.FECHA_NACIMIENTO);
        const esHijoMayor18 = esHijo && edad !== null && edad >= 18;
        const esHijoMenor18 = esHijo && !esHijoMayor18;

        acc.personasCubiertas += 1;
        if (esTitular) {
          acc.sociosTitulares += 1;
        } else {
          acc.sociosAdherentes += 1;
        }
        if (esHijoMayor18) {
          acc.hijosMayores18 += 1;
        }
        if (esHijoMenor18) {
          acc.hijosMenores18 += 1;
        }
        if (esConyuge || esOtros || esHijoMenor18) {
          acc.adherentesBeneficioTitular += 1;
        }
        return acc;
      },
      {
        personasCubiertas: 0,
        sociosTitulares: 0,
        sociosAdherentes: 0,
        hijosMayores18: 0,
        hijosMenores18: 0,
        adherentesBeneficioTitular: 0,
      }
    );

    const personasCubiertas = resumenSocios.personasCubiertas;
    const sociosTitulares = resumenSocios.sociosTitulares;
    const sociosAdherentes = resumenSocios.sociosAdherentes;
    const hijosMayores18 = resumenSocios.hijosMayores18;
    const hijosMenores18 = resumenSocios.hijosMenores18;
    const adherentesBeneficioTitular = resumenSocios.adherentesBeneficioTitular;
    const turnosHoy = toNumber((turnosHoyResult.recordset[0] as TotalRow | undefined)?.total);
    const profesionalesActivos = toNumber(
      (profesionalesActivosResult.recordset[0] as TotalRow | undefined)?.total
    );
    const prestacionesMes = toNumber((prestacionesMesResult.recordset[0] as TotalRow | undefined)?.total);

    const prestacionesTop = (prestacionesTopResult.recordset as PrestacionTopRow[]).map((row) => ({
      nombre: row.nombre,
      total: toNumber(row.total),
    }));

    const turnosRecientes = (turnosRecientesResult.recordset as TurnoRecienteRow[]).map((row) => ({
      id: row.id,
      // Convertimos a Date antes de llamar al método
      fecha: new Date(row.fecha).toISOString().split('T')[0], 
      hora: new Date(row.hora).toISOString().split('T')[1].slice(0, 5),
      estado: row.estado,
      socio: String(row.cod_soc),
      cod_soc: row.cod_soc,
      prestacion: row.prestacion,
      profesional: row.profesional,
    }));

    return NextResponse.json({
      success: true,
      data: {
        personas_cubiertas: personasCubiertas,
        socios_titulares: sociosTitulares,
        socios_adherentes: sociosAdherentes,
        hijos_mayores_18: hijosMayores18,
        hijos_menores_18: hijosMenores18,
        adherentes_beneficio_titular: adherentesBeneficioTitular,
        turnos_hoy: turnosHoy,
        profesionales_activos: profesionalesActivos,
        prestaciones_mes: prestacionesMes,
        prestaciones_top: prestacionesTop,
        turnos_recientes: turnosRecientes,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}

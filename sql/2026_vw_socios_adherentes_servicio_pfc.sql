-- Actualiza la vista oficial de socios PFC con vigencia del servicio (SERSOC).
-- Ejecutar en la base ERP / facturación (PR_DORM). Solo lectura desde el sistema PFC.

CREATE OR ALTER VIEW dbo.vw_socios_adherentes
AS
SELECT
    p.APELLIDOS,
    p.TELEFONO,
    p.FAX AS MOVIL,

    so.COD_SOC,
    ss.COD_SUM AS NUMERO_CUENTA,

    p.NUM_DNI,
    p.CDI,
    p.OBS_POSTAL,
    p.EMAIL,

    pa.FEC_NAC AS FECHA_NACIMIENTO,

    ad.COD_PER AS ADHERENTE_CODIGO,
    pa.APELLIDOS AS ADHERENTE_NOMBRE,

    V.DES_VIN AS VINCULO,

    pa.NUM_DNI AS DNI_ADHERENTE,

    cs.DES_CAT,

    ss.FEC_ALTA AS FECHA_ALTA,
    ss.FEC_BAJA AS FECHA_BAJA,

    CASE
        WHEN ss.FEC_ALTA = '1901-01-01'
            THEN CAST(1 AS BIT)
        ELSE CAST(0 AS BIT)
    END AS ES_MIGRADO,

    CASE
        WHEN ss.FEC_ALTA IS NULL THEN 'REVISAR'

        WHEN ss.FEC_ALTA > CAST(GETDATE() AS DATE)
            THEN 'PENDIENTE'

        WHEN ss.FEC_BAJA IS NOT NULL
             AND ss.FEC_BAJA < CAST(GETDATE() AS DATE)
            THEN 'BAJA'

        ELSE 'ACTIVO'
    END AS ESTADO_SERVICIO,

    CASE
        WHEN ss.FEC_ALTA IS NOT NULL
             AND ss.FEC_ALTA <= CAST(GETDATE() AS DATE)
             AND (
                    ss.FEC_BAJA IS NULL
                    OR ss.FEC_BAJA >= CAST(GETDATE() AS DATE)
                 )
            THEN CAST(1 AS BIT)
        ELSE CAST(0 AS BIT)
    END AS SERVICIO_ACTIVO

FROM dbo.SERSOC AS ss

INNER JOIN dbo.SERVICIO AS s
    ON ss.COD_SER = s.COD_SER

INNER JOIN dbo.SOCIOS AS so
    ON ss.COD_SOC = so.COD_SOC

INNER JOIN dbo.PERSONAS AS p
    ON so.COD_PER = p.COD_PER

INNER JOIN dbo.ADHSOC AS ad
    ON ad.COD_SOC = ss.COD_SOC

INNER JOIN dbo.PERSONAS AS pa
    ON ad.COD_PER = pa.COD_PER

INNER JOIN dbo.VINCULOS AS V
    ON ad.COD_VIN = V.COD_VIN

INNER JOIN dbo.CATE_SER AS cs
    ON cs.COD_CAT = ss.COD_CAT

WHERE
    ss.COD_SER = 4
    AND cs.DES_CAT IN ('CAT BÁSICA', 'CAT PLUS');
GO

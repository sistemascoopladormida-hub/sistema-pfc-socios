SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID('dbo.ortopedia_prestamos', 'U') IS NULL
  BEGIN
    RAISERROR('La tabla ortopedia_prestamos no existe. Ejecute primero 2026_ortopedia_modulo.sql', 16, 1);
    RETURN;
  END

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'tramite_nombre') IS NULL
    ALTER TABLE dbo.ortopedia_prestamos ADD tramite_nombre VARCHAR(150) NULL;

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'tramite_dni') IS NULL
    ALTER TABLE dbo.ortopedia_prestamos ADD tramite_dni VARCHAR(20) NULL;

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'tramite_telefono') IS NULL
    ALTER TABLE dbo.ortopedia_prestamos ADD tramite_telefono VARCHAR(50) NULL;

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'tramite_vinculo') IS NULL
    ALTER TABLE dbo.ortopedia_prestamos ADD tramite_vinculo VARCHAR(100) NULL;

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'certificado_url') IS NULL
    ALTER TABLE dbo.ortopedia_prestamos ADD certificado_url VARCHAR(500) NULL;

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'fecha_certificado') IS NULL
    ALTER TABLE dbo.ortopedia_prestamos ADD fecha_certificado DATETIME NULL;

  IF COL_LENGTH('dbo.ortopedia_prestamos', 'observaciones') IS NOT NULL
  BEGIN
    DECLARE @obsMaxLen INT;
    SELECT @obsMaxLen = max_length
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.ortopedia_prestamos')
      AND name = 'observaciones';

    IF @obsMaxLen > 0 AND @obsMaxLen <> -1
      ALTER TABLE dbo.ortopedia_prestamos ALTER COLUMN observaciones VARCHAR(MAX) NULL;
  END

  COMMIT TRAN;

  SELECT 'OK' AS estado, 'Columnas de expediente de prestamos agregadas correctamente' AS mensaje;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRAN;

  DECLARE @err NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(@err, 16, 1);
END CATCH;

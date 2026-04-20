SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRAN;

  DECLARE @especialidad_id INT;

  /* Asegurar especialidad de Traslados */
  SELECT TOP 1 @especialidad_id = id
  FROM especialidades
  WHERE UPPER(LTRIM(RTRIM(nombre))) = 'TRASLADOS';

  IF @especialidad_id IS NULL
  BEGIN
    INSERT INTO especialidades (nombre)
    VALUES ('Traslados');
    SET @especialidad_id = SCOPE_IDENTITY();
  END

  /*
    Detectamos columna de cupo según la base.
    Si existe, se cargan 999 para no bloquear turnos de traslado.
  */
  DECLARE @cupo_col SYSNAME = NULL;
  IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'cupo_mensual')
    SET @cupo_col = 'cupo_mensual';
  ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'pacientes_mensuales')
    SET @cupo_col = 'pacientes_mensuales';
  ELSE IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'paciente_mensuales')
    SET @cupo_col = 'paciente_mensuales';

  /* Diego Barrera */
  IF NOT EXISTS (
    SELECT 1 FROM profesionales WHERE UPPER(LTRIM(RTRIM(nombre))) = 'DIEGO BARRERA'
  )
  BEGIN
    DECLARE @sql_diego NVARCHAR(MAX) = N'
      INSERT INTO profesionales (nombre, especialidad_id, duracion_turno' +
      CASE WHEN @cupo_col IS NOT NULL THEN N', ' + QUOTENAME(@cupo_col) ELSE N'' END +
      N')
      VALUES (@nombre, @especialidad_id, @duracion_turno' +
      CASE WHEN @cupo_col IS NOT NULL THEN N', @cupo' ELSE N'' END +
      N');';

    EXEC sp_executesql
      @sql_diego,
      N'@nombre VARCHAR(150), @especialidad_id INT, @duracion_turno INT, @cupo INT',
      @nombre = 'Diego Barrera',
      @especialidad_id = @especialidad_id,
      @duracion_turno = 30,
      @cupo = 999;
  END

  /* Noe Zamora */
  IF NOT EXISTS (
    SELECT 1 FROM profesionales WHERE UPPER(LTRIM(RTRIM(nombre))) = 'NOE ZAMORA'
  )
  BEGIN
    DECLARE @sql_noe NVARCHAR(MAX) = N'
      INSERT INTO profesionales (nombre, especialidad_id, duracion_turno' +
      CASE WHEN @cupo_col IS NOT NULL THEN N', ' + QUOTENAME(@cupo_col) ELSE N'' END +
      N')
      VALUES (@nombre, @especialidad_id, @duracion_turno' +
      CASE WHEN @cupo_col IS NOT NULL THEN N', @cupo' ELSE N'' END +
      N');';

    EXEC sp_executesql
      @sql_noe,
      N'@nombre VARCHAR(150), @especialidad_id INT, @duracion_turno INT, @cupo INT',
      @nombre = 'Noe Zamora',
      @especialidad_id = @especialidad_id,
      @duracion_turno = 30,
      @cupo = 999;
  END

  COMMIT TRAN;

  SELECT 'OK' AS estado, 'Profesionales de traslados listos' AS mensaje, @especialidad_id AS especialidad_id;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  DECLARE @err NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(@err, 16, 1);
END CATCH;


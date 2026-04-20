SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRAN;

  DECLARE @especialidad_id INT;
  DECLARE @prestacion_id INT;

  /* 1) Especialidad de traslados */
  SELECT TOP 1 @especialidad_id = id
  FROM especialidades
  WHERE UPPER(LTRIM(RTRIM(nombre))) = 'TRASLADOS';

  IF @especialidad_id IS NULL
  BEGIN
    INSERT INTO especialidades (nombre)
    VALUES ('Traslados');

    SET @especialidad_id = SCOPE_IDENTITY();
  END

  /* 2) Prestacion de traslado medico */
  SELECT TOP 1 @prestacion_id = id
  FROM prestaciones
  WHERE UPPER(LTRIM(RTRIM(nombre))) IN (
    'TRASLADO MEDICO',
    'TRASLADO MEDICO (VEHICULO/AMBULANCIA)',
    'TRASLADOS'
  );

  IF @prestacion_id IS NULL
  BEGIN
    INSERT INTO prestaciones (nombre, especialidad_id)
    VALUES ('Traslado medico (vehiculo/ambulancia)', @especialidad_id);

    SET @prestacion_id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE prestaciones
    SET especialidad_id = @especialidad_id
    WHERE id = @prestacion_id
      AND ISNULL(especialidad_id, 0) <> @especialidad_id;
  END

  /*
    3) Detectar categorias existentes para BASICA / PLUS.
       Si no existen, se usan defaults.
  */
  IF OBJECT_ID('tempdb..#categorias') IS NOT NULL
    DROP TABLE #categorias;

  CREATE TABLE #categorias (
    categoria NVARCHAR(120) NOT NULL PRIMARY KEY,
    cantidad_anual INT NOT NULL
  );

  INSERT INTO #categorias (categoria, cantidad_anual)
  SELECT categoria, 1
  FROM (
    SELECT DISTINCT CAST(categoria AS NVARCHAR(120)) AS categoria
    FROM cobertura_anual
    UNION
    SELECT DISTINCT CAST(categoria AS NVARCHAR(120)) AS categoria
    FROM cobertura_total_anual
  ) c
  WHERE UPPER(c.categoria) COLLATE Latin1_General_CI_AI LIKE '%BASICA%';

  INSERT INTO #categorias (categoria, cantidad_anual)
  SELECT categoria, 3
  FROM (
    SELECT DISTINCT CAST(categoria AS NVARCHAR(120)) AS categoria
    FROM cobertura_anual
    UNION
    SELECT DISTINCT CAST(categoria AS NVARCHAR(120)) AS categoria
    FROM cobertura_total_anual
  ) c
  WHERE UPPER(c.categoria) COLLATE Latin1_General_CI_AI LIKE '%PLUS%'
    AND NOT EXISTS (SELECT 1 FROM #categorias x WHERE x.categoria = c.categoria);

  IF NOT EXISTS (SELECT 1 FROM #categorias)
  BEGIN
    INSERT INTO #categorias (categoria, cantidad_anual)
    VALUES
      ('PFC BASICA', 1),
      ('PFC PLUS', 3);
  END

  /* 4) Cobertura anual por prestacion (1 BASICA / 3 PLUS) */
  MERGE cobertura_anual AS target
  USING (
    SELECT
      categoria,
      @prestacion_id AS prestacion_id,
      cantidad_anual,
      CAST('INDIVIDUAL' AS VARCHAR(50)) AS tipo
    FROM #categorias
  ) AS src
  ON target.categoria = src.categoria
     AND target.prestacion_id = src.prestacion_id
  WHEN MATCHED THEN
    UPDATE SET
      target.cantidad_anual = src.cantidad_anual,
      target.tipo = src.tipo
  WHEN NOT MATCHED THEN
    INSERT (categoria, prestacion_id, cantidad_anual, tipo)
    VALUES (src.categoria, src.prestacion_id, src.cantidad_anual, src.tipo);

  /* 5) Cobertura total anual por especialidad */
  MERGE cobertura_total_anual AS target
  USING (
    SELECT
      categoria,
      @especialidad_id AS especialidad_id,
      cantidad_anual AS total_anual
    FROM #categorias
  ) AS src
  ON target.categoria = src.categoria
     AND target.especialidad_id = src.especialidad_id
  WHEN MATCHED THEN
    UPDATE SET
      target.total_anual = src.total_anual
  WHEN NOT MATCHED THEN
    INSERT (categoria, especialidad_id, total_anual)
    VALUES (src.categoria, src.especialidad_id, src.total_anual);

  /* 6) Tabla de detalle de traslados por turno */
  IF OBJECT_ID('dbo.traslados_turno', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.traslados_turno (
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      turno_id INT NOT NULL UNIQUE,
      tipo_unidad VARCHAR(20) NOT NULL,
      origen VARCHAR(250) NOT NULL,
      destino VARCHAR(250) NOT NULL,
      motivo VARCHAR(500) NULL,
      creado_en DATETIME NOT NULL CONSTRAINT DF_traslados_turno_creado_en DEFAULT (GETDATE())
    );

    ALTER TABLE dbo.traslados_turno
      ADD CONSTRAINT FK_traslados_turno_turno
      FOREIGN KEY (turno_id) REFERENCES dbo.turnos(id);

    ALTER TABLE dbo.traslados_turno
      ADD CONSTRAINT CK_traslados_turno_tipo_unidad
      CHECK (UPPER(tipo_unidad) IN ('VEHICULO', 'AMBULANCIA'));
  END

  COMMIT TRAN;

  SELECT
    'OK' AS estado,
    @especialidad_id AS especialidad_id,
    @prestacion_id AS prestacion_id,
    'Cobertura de traslados aplicada (Basica=1, Plus=3) y tabla traslados_turno lista.' AS mensaje;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRAN;

  DECLARE @err NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(@err, 16, 1);
END CATCH;


SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID('dbo.ortopedia_elementos', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.ortopedia_elementos (
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      descripcion VARCHAR(500) NULL,
      stock_total INT NOT NULL CONSTRAINT DF_ortopedia_elementos_stock_total DEFAULT (0),
      stock_disponible INT NOT NULL CONSTRAINT DF_ortopedia_elementos_stock_disponible DEFAULT (0),
      activo BIT NOT NULL CONSTRAINT DF_ortopedia_elementos_activo DEFAULT (1),
      creado_en DATETIME NOT NULL CONSTRAINT DF_ortopedia_elementos_creado_en DEFAULT (GETDATE()),
      actualizado_en DATETIME NOT NULL CONSTRAINT DF_ortopedia_elementos_actualizado_en DEFAULT (GETDATE())
    );

    ALTER TABLE dbo.ortopedia_elementos
      ADD CONSTRAINT UQ_ortopedia_elementos_nombre UNIQUE (nombre);

    ALTER TABLE dbo.ortopedia_elementos
      ADD CONSTRAINT CK_ortopedia_elementos_stock_nonnegative
      CHECK (stock_total >= 0 AND stock_disponible >= 0 AND stock_disponible <= stock_total);
  END

  IF OBJECT_ID('dbo.ortopedia_prestamos', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.ortopedia_prestamos (
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      elemento_id INT NOT NULL,
      cod_soc INT NOT NULL,
      adherente_codigo INT NOT NULL,
      paciente_nombre VARCHAR(200) NOT NULL,
      fecha_prestamo DATE NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      fecha_devolucion DATE NULL,
      estado VARCHAR(20) NOT NULL,
      observaciones VARCHAR(500) NULL,
      certificado_presentado BIT NOT NULL CONSTRAINT DF_ortopedia_prestamos_certificado DEFAULT (0),
      renovaciones INT NOT NULL CONSTRAINT DF_ortopedia_prestamos_renovaciones DEFAULT (0),
      creado_en DATETIME NOT NULL CONSTRAINT DF_ortopedia_prestamos_creado_en DEFAULT (GETDATE()),
      actualizado_en DATETIME NOT NULL CONSTRAINT DF_ortopedia_prestamos_actualizado_en DEFAULT (GETDATE())
    );

    ALTER TABLE dbo.ortopedia_prestamos
      ADD CONSTRAINT FK_ortopedia_prestamos_elemento
      FOREIGN KEY (elemento_id) REFERENCES dbo.ortopedia_elementos(id);

    ALTER TABLE dbo.ortopedia_prestamos
      ADD CONSTRAINT CK_ortopedia_prestamos_estado
      CHECK (UPPER(estado) IN ('ACTIVO', 'VENCIDO', 'DEVUELTO'));
  END

  IF OBJECT_ID('dbo.ortopedia_certificados', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.ortopedia_certificados (
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      prestamo_id INT NOT NULL,
      archivo_ruta VARCHAR(500) NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NULL,
      tamano_bytes INT NOT NULL,
      creado_en DATETIME NOT NULL CONSTRAINT DF_ortopedia_certificados_creado_en DEFAULT (GETDATE())
    );

    ALTER TABLE dbo.ortopedia_certificados
      ADD CONSTRAINT FK_ortopedia_certificados_prestamo
      FOREIGN KEY (prestamo_id) REFERENCES dbo.ortopedia_prestamos(id);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.ortopedia_elementos)
  BEGIN
    INSERT INTO dbo.ortopedia_elementos
      (nombre, descripcion, stock_total, stock_disponible, activo)
    VALUES
      ('Muletas de aluminio adultos', 'Muletas de aluminio para adultos', 3, 3, 1),
      ('Muletas de aluminio niños', 'Muletas de aluminio para niños', 1, 1, 1),
      ('Caminador fijo', 'Caminador ortopédico fijo', 1, 1, 1),
      ('Soporte de suero', 'Soporte de suero con ruedas', 1, 1, 1),
      ('Tubo de oxigeno viejo', 'Tubo de oxigeno viejo ', 1, 1, 1),
  END

  COMMIT TRAN;

  SELECT 'OK' AS estado, 'Modulo ortopedia creado correctamente' AS mensaje;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRAN;

  DECLARE @err NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(@err, 16, 1);
END CATCH;


import sql from "mssql";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildConfig(params: {
  userEnv: string;
  passwordEnv: string;
  serverEnv: string;
  databaseEnv: string;
}): sql.config {
  return {
    user: requireEnv(params.userEnv),
    password: requireEnv(params.passwordEnv),
    server: requireEnv(params.serverEnv),
    database: requireEnv(params.databaseEnv),
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}

const readOnlyConfig = buildConfig({
  userEnv: "USER_DATABASE",
  passwordEnv: "PASSWORD_DATABASE",
  serverEnv: "SERVER_DATABASE",
  databaseEnv: "DATABASE_NAME",
});

const pfcConfig = buildConfig({
  userEnv: "USER_DATABASE_PFC",
  passwordEnv: "PASSWORD_DATABASE_PFC",
  serverEnv: "SERVER_DATABASE_PFC",
  databaseEnv: "DATABASE_NAME_PFC",
});

let readOnlyPoolPromise: Promise<sql.ConnectionPool> | null = null;
let pfcPoolPromise: Promise<sql.ConnectionPool> | null = null;
let migrationPromise: Promise<void> | null = null;
let migrationsCompleted = false;

async function createPool(config: sql.config) {
  const pool = new sql.ConnectionPool(config);
  return pool.connect();
}

export async function getSqlConnection() {
  try {
    if (!readOnlyPoolPromise) {
      readOnlyPoolPromise = createPool(readOnlyConfig);
    }
    return await readOnlyPoolPromise;
  } catch (error) {
    readOnlyPoolPromise = null;
    console.error("SQL Server read-only connection error:", error);
    throw error;
  }
}

export async function getSqlConnectionPfc() {
  try {
    if (!pfcPoolPromise) {
      pfcPoolPromise = createPool(pfcConfig);
    }
    return await pfcPoolPromise;
  } catch (error) {
    pfcPoolPromise = null;
    console.error("SQL Server PFC connection error:", error);
    throw error;
  }
}

export async function runMigrations() {
  if (migrationsCompleted) {
    return;
  }

  if (!migrationPromise) {
    migrationPromise = (async () => {
      const pool = await getSqlConnectionPfc();
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'turnos' AND COLUMN_NAME = 'es_carga_manual'
        )
        BEGIN
          ALTER TABLE turnos ADD es_carga_manual BIT NOT NULL DEFAULT 0
        END
      `);
      migrationsCompleted = true;
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  await migrationPromise;
}

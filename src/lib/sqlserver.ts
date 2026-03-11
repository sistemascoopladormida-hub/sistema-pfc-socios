import sql from "mssql";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const user = requireEnv("USER_DATABASE");
const password = requireEnv("PASSWORD_DATABASE");
const server = requireEnv("SERVER_DATABASE");
const database = requireEnv("DATABASE_NAME");

const config: sql.config = {
  user,
  password,
  server,
  database,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export async function getSqlConnection() {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (error) {
    console.error("SQL Server connection error:", error);
    throw error;
  }
}

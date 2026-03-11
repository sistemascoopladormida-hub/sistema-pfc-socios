import sql from "mssql";

const config: sql.config = {
  user: "pfc",
  password: "ServiciosSocialesCoop1967.",
  server: "192.168.1.141",
  database: "PR_DORM",
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

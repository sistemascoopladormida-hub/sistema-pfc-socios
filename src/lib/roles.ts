export const ROLES = {
  ADMIN: "admin",
  DIRECTIVO: "directivo",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PASSWORDS: Record<AppRole, string> = {
  [ROLES.ADMIN]: "adminPFC2026",
  [ROLES.DIRECTIVO]: "directivosPFC2026",
};

export const ROLE_USERS: Record<AppRole, string> = {
  [ROLES.ADMIN]: "Marianela Farias",
  [ROLES.DIRECTIVO]: "Directivos",
};

export const isAdmin = (rol: string | null | undefined) => rol === ROLES.ADMIN;
export const isDirectivo = (rol: string | null | undefined) => rol === ROLES.DIRECTIVO;

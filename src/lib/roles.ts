export const ROLES = {
  ADMIN: "admin",
  ADMIN_VANESA: "admin_vanesa",
  ORTOPEDIA_ADMIN: "ortopedia_admin",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PASSWORDS: Record<AppRole, string> = {
  [ROLES.ADMIN]: "adminPFC2026",
  [ROLES.ADMIN_VANESA]: "VanesaPFC2026",
  [ROLES.ORTOPEDIA_ADMIN]: "GuadalupePFC2026",
};

export const ROLE_USERS: Record<AppRole, string> = {
  [ROLES.ADMIN]: "Marianela Farias",
  [ROLES.ADMIN_VANESA]: "Vanesa Caminos",
  [ROLES.ORTOPEDIA_ADMIN]: "Guadalupe Saavedra",
};

export const isAdmin = (rol: string | null | undefined) => rol === ROLES.ADMIN;
export const isAdminVanesa = (rol: string | null | undefined) => rol === ROLES.ADMIN_VANESA;
export const isOrtopediaAdmin = (rol: string | null | undefined) => rol === ROLES.ORTOPEDIA_ADMIN;

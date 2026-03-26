export const designTokens = {
  colors: {
    primary: "#0D6E5A",
    surface: "#F7F8F6",
    card: "#FFFFFF",
    border: "#E8EBE9",
    textPrimary: "#0F1C18",
    textSecondary: "#4A5C55",
    textMuted: "#8FA89F",
    success: "#059669",
    warning: "#D97706",
    danger: "#DC2626",
    sidebar: "#0A1F1A",
    sidebarActive: "#1A3D32",
    sidebarHover: "#142D24",
  },
  shadow: {
    card: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    cardHover: "0 8px 24px rgba(0,0,0,0.08)",
  },
  layout: {
    sidebarWidth: 240,
    contentMaxWidth: 1280,
    contentPadding: 32,
    cardGap: 20,
    tableRowMinHeight: 56,
  },
} as const;

export type DesignTokens = typeof designTokens;

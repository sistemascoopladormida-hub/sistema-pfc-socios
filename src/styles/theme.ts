export const theme = {
  colors: {
    sidebar: "bg-coopGreen",
    sidebarText: "text-white",
    surface: "bg-white",
    page: "bg-coopGray",
    textPrimary: "text-slate-900",
    textSecondary: "text-slate-600",
    info: "text-coopBlue",
    warning: "text-coopWarning",
    danger: "text-coopError",
  },
  radius: {
    card: "rounded-2xl",
    control: "rounded-xl",
  },
  shadow: {
    soft: "shadow-md shadow-slate-900/5",
    hover: "hover:shadow-lg hover:shadow-slate-900/10",
  },
  spacing: {
    page: "p-6",
    block: "space-y-6",
  },
} as const;

export type AppTheme = typeof theme;

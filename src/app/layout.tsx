import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Serif_Display } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { AppLayout } from "@/components/layout/app-layout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ProfesionalesProvider } from "@/lib/profesionales-context";
import { runMigrations } from "@/lib/sqlserver";
import { UserProvider } from "@/lib/user-context";
import type { UserRole } from "@/types/roles";
import "./globals.css";

export const metadata: Metadata = {
  title: "PFC Gestion System",
  description: "Sistema de gestion del Plan de Financiamiento Colectivo",
};

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await runMigrations();
  } catch (error) {
    console.error("No se pudieron ejecutar migraciones PFC:", error);
  }

  const roleCookie = cookies().get("rol")?.value;
  const initialRole: UserRole | undefined =
    roleCookie === "admin" || roleCookie === "directivo" || roleCookie === "ortopedia_admin"
      ? roleCookie
      : undefined;

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${dmSerif.variable} ${GeistSans.className} antialiased`}>
        <ThemeProvider>
          <UserProvider initialRole={initialRole}>
            <ProfesionalesProvider>
              <AppLayout>{children}</AppLayout>
              <Toaster position="top-right" richColors />
            </ProfesionalesProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

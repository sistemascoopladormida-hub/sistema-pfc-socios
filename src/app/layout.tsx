import type { Metadata } from "next";
import { AppLayout } from "@/components/layout/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { ProfesionalesProvider } from "@/lib/profesionales-context";
import { UserProvider } from "@/lib/user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "PFC Gestion System",
  description: "Sistema de gestion del Plan de Financiamiento Colectivo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <UserProvider>
          <ProfesionalesProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster position="top-right" richColors />
          </ProfesionalesProvider>
        </UserProvider>
      </body>
    </html>
  );
}

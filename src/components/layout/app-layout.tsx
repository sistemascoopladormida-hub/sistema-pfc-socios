"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen bg-coopGray">
      <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header onMenuClick={() => setMobileSidebarOpen((prev) => !prev)} />
        <main key={pathname} className="animate-page-enter flex-1 p-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-600">
          Sistema de Gestion PFC - Cooperativa Electrica de San Jose de la Dormida ({currentYear})
        </footer>
      </div>
    </div>
  );
}

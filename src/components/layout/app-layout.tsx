"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/header";
import { PageTransition } from "@/components/layout/page-transition";
import { Sidebar } from "@/components/layout/sidebar";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const isAuthRoute = pathname.startsWith("/login");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-coopGray/60">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header onMenuClick={() => setMobileSidebarOpen((prev) => !prev)} />
        <main className="flex-1 p-6">
          <PageTransition transitionKey={pathname}>{children}</PageTransition>
        </main>
        <footer className="border-t border-slate-200/80 bg-white/90 px-6 py-3 text-xs text-slate-600">
          Sistema de Gestion PFC - Cooperativa Electrica de San Jose de la Dormida ({currentYear})
        </footer>
      </div>
    </div>
  );
}

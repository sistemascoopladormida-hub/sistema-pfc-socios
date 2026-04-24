"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CommandPalette } from "@/components/layout/command-palette";
import { Header } from "@/components/layout/header";
import { navigationItems } from "@/components/layout/navigation-config";
import { PageTransition } from "@/components/layout/page-transition";
import { Sidebar } from "@/components/layout/sidebar";
import { canAccessModule, useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const pathname = usePathname();
  const { role } = useUser();
  const currentYear = new Date().getFullYear();
  const isAuthRoute = pathname.startsWith("/login");

  const mobileItems = useMemo(
    () => navigationItems.filter((item) => canAccessModule(role, item.module)).slice(0, 4),
    [role]
  );

  useEffect(() => {
    const handler = () => setCommandPaletteOpen(true);
    window.addEventListener("pfc:open-command-palette", handler);
    return () => window.removeEventListener("pfc:open-command-palette", handler);
  }, []);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-screen bg-transparent">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <Header
            onMenuClick={() => setMobileSidebarOpen((prev) => !prev)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />

          <main className="flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-8">
            <div className="mx-auto max-w-[1680px]">
              <PageTransition transitionKey={pathname}>{children}</PageTransition>
            </div>
          </main>

          <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground md:px-6">
            <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2">
              <span>PFC Control Center · Cooperativa Electrica de San Jose de la Dormida</span>
              <span>{currentYear} · interfaz simple y clara para uso diario</span>
            </div>
          </footer>
        </div>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-30 md:hidden">
        <div className="glass-panel grid grid-cols-4 gap-2 rounded-[28px] p-2">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-medium transition-all duration-200",
                  isActive ? "pill-active text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  );
}

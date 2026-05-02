"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { platformModules } from "@/lib/modules";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";

export function PlatformNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [densityMode, setDensityMode] = useState<"comfortable" | "compact" | "boardroom">("comfortable");
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedDensity = window.localStorage.getItem("twinsmill_density_mode");
    const legacyBoardroom = window.localStorage.getItem("twinsmill_boardroom_mode");

    if (storedDensity === "comfortable" || storedDensity === "compact" || storedDensity === "boardroom") {
      setDensityMode(storedDensity);
      return;
    }

    if (legacyBoardroom === "1") {
      setDensityMode("boardroom");
    }
  }, []);

  const updateDensityMode = useCallback((next: "comfortable" | "compact" | "boardroom") => {
    setDensityMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("twinsmill_density_mode", next);
      window.localStorage.setItem("twinsmill_boardroom_mode", next === "boardroom" ? "1" : "0");
    }
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => !v);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  const handleNavigation = useCallback((href: string) => {
    if (pathname === href) return; // Ya estamos en esa página
    setNavigatingTo(href);
    startTransition(() => {
      router.push(href);
    });
  }, [router, pathname, startTransition]);

  useEffect(() => {
    if (!isPending && navigatingTo) {
      setNavigatingTo(null);
    }
  }, [isPending, navigatingTo]);

  const navigationItems = useMemo(() => {
    return platformModules.map((module) => ({
      ...module,
      active: pathname === module.href,
    }));
  }, [pathname]);

  const groupedNavigation = useMemo(() => {
    const operational = navigationItems
      .filter((module) => module.section === "operacion")
      .sort((a, b) => a.processOrder - b.processOrder);
    const control = navigationItems
      .filter((module) => module.section === "control")
      .sort((a, b) => a.processOrder - b.processOrder);
    const config = navigationItems
      .filter((module) => module.section === "configuracion")
      .sort((a, b) => a.processOrder - b.processOrder);

    return { operational, control, config };
  }, [navigationItems]);

  const activeOperationalIndex = useMemo(() => {
    return groupedNavigation.operational.findIndex((module) => module.href === pathname);
  }, [groupedNavigation.operational, pathname]);

  return (
    <div className={`app-shell density-${densityMode} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
          {/* ── Collapse toggle ── */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            className="sidebar-toggle-btn"
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <svg
              width="18" height="18" viewBox="0 0 18 18" fill="none"
              style={{ transition: "transform 0.3s ease", transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="sidebar-content">
            <div className="brand-on-dark">
              <BrandLogo compact variant="auth" />
            </div>
            <h1 className="mt-3 font-display text-[1.32rem] leading-[1.08] tracking-[-0.025em] text-white/90">
              Centro Ejecutivo
            </h1>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400/80">Control operativo · Calidad · Rentabilidad</p>

            <nav className="mt-5 space-y-5">
          <div className="nav-group">
            <p className="mb-1.5 px-0.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-slate-500">Flujo operativo</p>
            <div className="mb-2 flex items-center gap-2 px-0.5">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[0.62rem] text-slate-500/70">
                {activeOperationalIndex >= 0 ? `${activeOperationalIndex + 1} / ${groupedNavigation.operational.length}` : "—"}
              </span>
            </div>
            <div className="space-y-2">
              {groupedNavigation.operational.map((module) => {
                const isNavigating = navigatingTo === module.href;
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => handleNavigation(module.href)}
                    disabled={isNavigating}
                    className={`app-nav-link ${module.active ? "app-nav-link-active" : ""} ${isNavigating ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{module.label}</span>
                        <span className="block text-xs text-slate-300/80">{module.focus}</span>
                      </div>
                      {isNavigating ? <span className="text-[0.7rem] text-slate-300">...</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="nav-group">
            <p className="mb-1.5 px-0.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-slate-500">Control y analítica</p>
            <div className="space-y-2">
              {groupedNavigation.control.map((module) => {
                const isNavigating = navigatingTo === module.href;
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => handleNavigation(module.href)}
                    disabled={isNavigating}
                    className={`app-nav-link ${module.active ? "app-nav-link-active" : ""} ${isNavigating ? "opacity-70" : ""}`}
                  >
                    <div>
                      <span className="font-medium">{module.label}</span>
                      <span className="block text-xs text-slate-300/80">{module.focus}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="nav-group">
            <p className="mb-1.5 px-0.5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-slate-500">Configuración</p>
            <div className="space-y-2">
              {groupedNavigation.config.map((module) => {
                const isNavigating = navigatingTo === module.href;
                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => handleNavigation(module.href)}
                    disabled={isNavigating}
                    className={`app-nav-link ${module.active ? "app-nav-link-active" : ""} ${isNavigating ? "opacity-70" : ""}`}
                  >
                    <div>
                      <span className="font-medium">{module.label}</span>
                      <span className="block text-xs text-slate-300/80">{module.focus}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
          </div>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle in topbar for when sidebar is collapsed */}
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expandir menú"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Torre de Control</p>
            <h2 className="font-display text-[2.1rem] leading-tight tracking-[-0.03em] text-slate-800">Sala Ejecutiva de Operaciones</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="topbar-chip px-2 py-1">
              <label htmlFor="density-mode" className="mr-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Densidad
              </label>
              <select
                id="density-mode"
                value={densityMode}
                onChange={(event) => updateDensityMode(event.target.value as "comfortable" | "compact" | "boardroom")}
                className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1e3a8a]/50"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="boardroom">Boardroom</option>
              </select>
            </div>
            <div className="topbar-chip px-4 py-2 text-right">
              <p className="text-xs text-slate-500">{user?.company ?? "Sin empresa"}</p>
              <p className="text-sm font-semibold text-slate-900">{user?.fullName ?? "Invitado"}</p>
              <p className="text-[0.7rem] uppercase tracking-[0.12em] text-slate-500">{user?.role ?? "operator"}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md"
            >
              Cerrar sesion
            </button>
          </div>
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}

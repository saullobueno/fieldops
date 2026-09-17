"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BarChart3,
  Building2,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map,
  Moon,
  Sparkles,
  Sun,
  UserCog,
  Users,
  Waypoints
} from "lucide-react";

import { cn } from "../lib/cn";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "./sidebar";
import { useTheme } from "./theme";

export interface AppShellNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
}

export interface AppShellNavGroup {
  readonly label: string;
  readonly items: readonly AppShellNavItem[];
}

const iconProps = { "aria-hidden": true, size: 18 } as const;

export const appShellNavGroups: readonly AppShellNavGroup[] = [
  {
    items: [
      { href: "/", icon: <LayoutDashboard {...iconProps} />, label: "Início" },
      { href: "/despacho", icon: <Waypoints {...iconProps} />, label: "Despacho" },
      { href: "/ordens", icon: <ClipboardList {...iconProps} />, label: "Ordens" },
      // { href: "/calendario", icon: <CalendarDays {...iconProps} />, label: "Calendário" }, // TODO: página de calendário ainda não existe
      { href: "/mapa", icon: <Map {...iconProps} />, label: "Mapa" }
    ],
    label: "Operação"
  },
  {
    items: [
      { href: "/tecnicos", icon: <Users {...iconProps} />, label: "Técnicos" },
      { href: "/clientes", icon: <Building2 {...iconProps} />, label: "Clientes" }
    ],
    label: "Equipe"
  },
  {
    items: [
      { href: "/relatorios", icon: <BarChart3 {...iconProps} />, label: "Relatórios" },
      { href: "/checklists", icon: <ListChecks {...iconProps} />, label: "Checklists" },
      { href: "/copilot", icon: <Sparkles {...iconProps} />, label: "Copiloto" }
    ],
    label: "Análise"
  }
];

const systemNavGroup: AppShellNavGroup = {
  items: [{ href: "/usuarios", icon: <UserCog {...iconProps} />, label: "Usuários" }],
  label: "Sistema"
};

export const appShellNavItems: readonly AppShellNavItem[] = [...appShellNavGroups, systemNavGroup].flatMap(
  (group) => group.items
);

export interface AppShellProps {
  readonly activeHref: string;
  readonly children: ReactNode;
  readonly headerAction?: ReactNode;
  readonly headerEyebrow: string;
  readonly headerTitle: string;
  readonly userLabel?: string;
  readonly onLogout?: () => void;
}

export function AppShell({
  activeHref,
  children,
  headerAction,
  headerEyebrow,
  headerTitle,
  onLogout,
  userLabel
}: AppShellProps): ReactNode {
  return (
    <SidebarProvider>
      <main className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar>
          <SidebarHeader>
            <a className="flex items-center gap-2 overflow-hidden text-sm font-semibold tracking-wide" href="/">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                FO
              </span>
              <span className="truncate">FieldOps</span>
            </a>
            <SidebarTrigger />
          </SidebarHeader>
          <SidebarContent>
            {appShellNavGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        href={item.href}
                        icon={item.icon}
                        isActive={item.href === activeHref}
                        label={item.label}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <SidebarGroup className="mb-0">
              <SidebarGroupLabel>{systemNavGroup.label}</SidebarGroupLabel>
              <SidebarMenu>
                {systemNavGroup.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      href={item.href}
                      icon={item.icon}
                      isActive={item.href === activeHref}
                      label={item.label}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarFooter>
        </Sidebar>
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 max-sm:px-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{headerEyebrow}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{headerTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {headerAction}
              {userLabel ? (
                <div className="flex items-center gap-1 border-l border-border pl-3">
                  <a
                    aria-label="Notificações"
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      activeHref === "/notificacoes" && "bg-accent text-accent-foreground"
                    )}
                    href="/notificacoes"
                    title="Notificações"
                  >
                    <Bell aria-hidden size={18} />
                  </a>
                  <UserMenu onLogout={onLogout} userLabel={userLabel} />
                </div>
              ) : null}
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </section>
      </main>
    </SidebarProvider>
  );
}

function UserMenu({ onLogout, userLabel }: { onLogout?: () => void; userLabel: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
          {userLabel.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-40 truncate text-sm font-medium text-foreground max-sm:hidden">{userLabel}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-md border border-border bg-card py-1 shadow-md"
          role="menu"
        >
          <a
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
            href="/perfil"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <CircleUserRound aria-hidden size={16} />
            Perfil
          </a>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
            onClick={toggleTheme}
            role="menuitem"
            type="button"
          >
            {theme === "dark" ? <Sun aria-hidden size={16} /> : <Moon aria-hidden size={16} />}
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
          {onLogout ? (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              role="menuitem"
              type="button"
            >
              <LogOut aria-hidden size={16} />
              Sair
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

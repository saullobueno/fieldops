"use client";

import type { ReactNode } from "react";
import {
  Bell,
  BarChart3,
  Building2,
  CircleUserRound,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map,
  Sparkles,
  UserCog,
  Users,
  Waypoints
} from "lucide-react";

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
  },
  {
    items: [
      { href: "/notificacoes", icon: <Bell {...iconProps} />, label: "Notificações" },
      { href: "/usuarios", icon: <UserCog {...iconProps} />, label: "Usuários" },
      { href: "/perfil", icon: <CircleUserRound {...iconProps} />, label: "Perfil" }
    ],
    label: "Sistema"
  }
];

export const appShellNavItems: readonly AppShellNavItem[] = appShellNavGroups.flatMap((group) => group.items);

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
      <main className="flex min-h-screen bg-background text-foreground">
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
          {userLabel ? (
            <SidebarFooter>
              <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                  {userLabel.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground/80">{userLabel}</span>
                {onLogout ? (
                  <button
                    aria-label="Sair"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 outline-none transition-colors hover:bg-sidebar-accent hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={onLogout}
                    title="Sair"
                    type="button"
                  >
                    <LogOut aria-hidden size={16} />
                  </button>
                ) : null}
              </div>
            </SidebarFooter>
          ) : null}
        </Sidebar>
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 max-sm:px-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{headerEyebrow}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{headerTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {headerAction}
              {userLabel ? (
                <div className="flex items-center gap-2 border-l border-border pl-3 lg:hidden">
                  <span className="text-xs text-muted-foreground">{userLabel}</span>
                  {onLogout ? (
                    <button
                      className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={onLogout}
                      type="button"
                    >
                      Sair
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>
          {children}
        </section>
      </main>
    </SidebarProvider>
  );
}

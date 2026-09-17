"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { createContext, use, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "../lib/cn";

const STORAGE_KEY = "fieldops-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "fieldops-sidebar-change";

interface SidebarContextValue {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

function subscribeToCollapsedState(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, callback);
  };
}

function getCollapsedSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

export function SidebarProvider({ children }: { children: ReactNode }): ReactNode {
  const collapsed = useSyncExternalStore(subscribeToCollapsedState, getCollapsedSnapshot, getCollapsedServerSnapshot);

  function toggle(): void {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  }

  return <SidebarContext value={{ collapsed, toggle }}>{children}</SidebarContext>;
}

export function useSidebar(): SidebarContextValue {
  const context = use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar deve ser usado dentro de SidebarProvider.");
  }

  return context;
}

export function Sidebar({ children, className, ...props }: HTMLAttributes<HTMLElement>): ReactNode {
  const { collapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 max-lg:hidden",
        collapsed ? "w-[68px]" : "w-64",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div className={cn("flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarTrigger({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  const { collapsed, toggle } = useSidebar();

  return (
    <button
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      onClick={toggle}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
      type="button"
      {...props}
    >
      {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
    </button>
  );
}

export function SidebarContent({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div className={cn("flex-1 overflow-y-auto overflow-x-hidden px-2 py-3", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarFooter({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div className={cn("shrink-0 border-t border-sidebar-border p-2", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarGroup({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarGroupLabel({ children, className, ...props }: HTMLAttributes<HTMLDivElement>): ReactNode {
  const { collapsed } = useSidebar();

  if (collapsed) {
    return null;
  }

  return (
    <div className={cn("px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/50", className)} {...props}>
      {children}
    </div>
  );
}

export function SidebarMenu({ children, className, ...props }: HTMLAttributes<HTMLUListElement>): ReactNode {
  return (
    <ul className={cn("flex flex-col gap-1", className)} {...props}>
      {children}
    </ul>
  );
}

export function SidebarMenuItem({ children, className, ...props }: HTMLAttributes<HTMLLIElement>): ReactNode {
  return (
    <li className={cn(className)} {...props}>
      {children}
    </li>
  );
}

export interface SidebarMenuButtonProps extends HTMLAttributes<HTMLAnchorElement> {
  readonly href: string;
  readonly icon: ReactNode;
  readonly isActive?: boolean;
  readonly label: string;
}

export function SidebarMenuButton({ className, href, icon, isActive, label, ...props }: SidebarMenuButtonProps): ReactNode {
  const { collapsed } = useSidebar();

  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
        className
      )}
      href={href}
      title={collapsed ? label : undefined}
      {...props}
    >
      <span className="flex shrink-0 items-center justify-center [&_svg]:size-[18px]">{icon}</span>
      {collapsed ? null : <span className="truncate">{label}</span>}
    </a>
  );
}

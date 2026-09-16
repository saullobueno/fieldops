import type { ReactNode } from "react";

export interface AppShellNavItem {
  readonly href: string;
  readonly label: string;
}

export const appShellNavItems: readonly AppShellNavItem[] = [
  { href: "/", label: "Início" },
  { href: "/despacho", label: "Despacho" },
  { href: "/ordens", label: "Ordens" },
  { href: "#", label: "Calendário" },
  { href: "#", label: "Mapa" },
  { href: "#", label: "Técnicos" },
  { href: "/clientes", label: "Clientes" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/checklists", label: "Checklists" },
  { href: "/copilot", label: "Copiloto" },
  { href: "/notificacoes", label: "Notificações" },
  { href: "/usuarios", label: "Usuários" },
  { href: "/perfil", label: "Perfil" }
];

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
    <main className="min-h-screen bg-[#F4F6F5] text-[#151A18]">
      <div className="grid min-h-screen grid-cols-[236px_1fr] max-lg:grid-cols-1">
        <aside className="border-r border-[#D8DEDA] bg-[#FBFCFB] px-4 py-5 max-lg:hidden">
          <a className="text-sm font-semibold tracking-wide" href="/">FieldOps</a>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Principal">
            {appShellNavItems.map((item) => (
              <a
                className={
                  item.href === activeHref
                    ? "rounded-md bg-[#E9EEEB] px-3 py-2 text-sm font-medium text-[#151A18]"
                    : "rounded-md px-3 py-2 text-sm text-[#4F5A55] hover:bg-[#E9EEEB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E5F4B]"
                }
                href={item.href}
                key={item.label}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <section className="flex min-w-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-[#D8DEDA] bg-[#FBFCFB] px-6 max-sm:px-4">
            <div>
              <p className="text-xs font-medium uppercase text-[#66736D]">{headerEyebrow}</p>
              <h1 className="text-base font-semibold">{headerTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              {headerAction}
              {userLabel ? (
                <div className="flex items-center gap-2 border-l border-[#D8DEDA] pl-3">
                  <span className="text-xs text-[#4F5A55]">{userLabel}</span>
                  {onLogout ? (
                    <button
                      className="rounded-md px-2 py-1 text-xs font-medium text-[#4F5A55] hover:bg-[#E9EEEB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E5F4B]"
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
      </div>
    </main>
  );
}

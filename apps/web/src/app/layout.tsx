import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FieldOps",
  description: "Plataforma de operações de serviços em campo"
};

const THEME_INIT_SCRIPT = `(function () {
  try {
    var theme = localStorage.getItem("fieldops-theme") === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (error) {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html className="dark" lang="pt-BR" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

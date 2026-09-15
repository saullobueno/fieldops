import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FieldOps Técnico",
  description: "FieldOps mobile web para técnicos"
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

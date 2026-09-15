import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border-transparent bg-zinc-950 text-white hover:bg-zinc-800",
  secondary: "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50",
  ghost: "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100"
};

export function Button({
  children,
  className,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

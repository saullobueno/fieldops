import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    defaultVariants: {
      size: "default",
      variant: "secondary"
    },
    variants: {
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        icon: "size-9",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5"
      },
      variant: {
        default: "border border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
        ghost: "border border-transparent bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "border border-transparent text-primary underline-offset-4 hover:underline",
        outline: "border border-input bg-card shadow-xs hover:bg-accent hover:text-accent-foreground",
        primary: "border border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary: "border border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground"
      }
    }
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  children: ReactNode;
}

export function Button({ children, className, size, type = "button", variant, ...props }: ButtonProps): ReactNode {
  return (
    <button className={cn(buttonVariants({ size, variant }), className)} type={type} {...props}>
      {children}
    </button>
  );
}

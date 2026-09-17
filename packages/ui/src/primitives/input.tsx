import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "../lib/cn";

const fieldClassName =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>): ReactNode {
  return <input className={cn(fieldClassName, className)} type={type} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): ReactNode {
  return <select className={cn(fieldClassName, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactNode {
  return <textarea className={cn(fieldClassName, "h-auto min-h-16 py-2", className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>): ReactNode {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

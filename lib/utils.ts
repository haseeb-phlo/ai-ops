import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitle(s: string): string {
  if (!s) return s;
  return s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

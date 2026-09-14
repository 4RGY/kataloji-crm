"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Pembungkus next-themes.
 * Menaruh kelas `light` atau `dark` di elemen <html>, sehingga seluruh
 * variabel warna di globals.css ikut berganti.
 *
 * `attribute="class"` = pasangan dari `@custom-variant dark (&:is(.dark *))`
 * yang sudah ada di globals.css.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

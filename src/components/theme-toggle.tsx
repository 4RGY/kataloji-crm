"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPSI = [
  { nilai: "light", label: "Terang", Ikon: Sun },
  { nilai: "system", label: "Sistem", Ikon: Monitor },
  { nilai: "dark", label: "Gelap", Ikon: Moon },
] as const;

/**
 * Pemilih tema: Terang / Sistem / Gelap.
 *
 * Sengaja tiga pilihan, bukan satu tombol bolak-balik: kasir sering
 * bekerja di ruangan terang, sementara admin sering di ruangan gelap.
 * "Sistem" dipakai sebagai default supaya ikut pengaturan perangkat.
 *
 * Sebelum ter-mount, tema asli belum diketahui. Selama itu tombol
 * dirender tanpa penanda aktif supaya tidak ada ketidakcocokan
 * antara HTML server dan klien (hydration mismatch).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSiap(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Pilihan tema tampilan"
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-0.5",
        className,
      )}
    >
      {OPSI.map(({ nilai, label, Ikon }) => {
        const aktif = siap && theme === nilai;
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={aktif}
            aria-label={label}
            title={label}
            onClick={() => setTheme(nilai)}
            className={cn(
              // h-11 supaya pemilihan tema ikut ambang sentuh yang sama.
              // Sebelumnya h-7 (28px), tiga tombol berdempet di sidebar sempit.
              "flex h-11 flex-1 items-center justify-center rounded-md transition-colors",
              aktif
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Ikon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

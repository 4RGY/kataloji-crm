"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { normalisasiWhatsapp, formatWhatsapp } from "@/lib/pelanggan";

export interface PelangganSimple {
  id: string;
  nama: string;
  whatsapp: string;
  poin?: number;
}

function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).slice(0, 2);
  return kata.map((k) => k.charAt(0).toUpperCase()).join("") || "?";
}

function BarisPelanggan({
  pelanggan,
  onPilih,
}: {
  pelanggan: PelangganSimple;
  onPilih: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPilih}
      className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-bold text-secondary-foreground">
        {inisial(pelanggan.nama)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">
          {pelanggan.nama}
        </span>
        <span className="mt-0.5 block truncate text-[11px] tabular-nums text-muted-foreground">
          {formatWhatsapp(pelanggan.whatsapp)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13px] font-bold tabular-nums leading-tight">
          {pelanggan.poin ?? 0}
        </span>
        <span className="block text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          poin
        </span>
      </span>
    </button>
  );
}

export function KitaposPemilihPelanggan({
  daftar,
  terpilih,
  onPilih,
  onLepas,
  bolehLepas,
}: {
  daftar: PelangganSimple[];
  terpilih: PelangganSimple | null;
  onPilih: (p: PelangganSimple) => void;
  onLepas?: () => void;
  bolehLepas: boolean;
}) {
  const [cari, setCari] = useState("");

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const dasar = !q
      ? daftar
      : (() => {
          const qWa = normalisasiWhatsapp(q);
          return daftar.filter(
            (p) =>
              p.nama.toLowerCase().includes(q) ||
              (qWa && p.whatsapp.includes(qWa)) ||
              p.whatsapp.includes(q),
          );
        })();
    return dasar.slice(0, 6);
  }, [daftar, cari]);


  if (terpilih) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {inisial(terpilih.nama)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">{terpilih.nama}</p>
          <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
            {formatWhatsapp(terpilih.whatsapp)} · {terpilih.poin ?? 0} poin
          </p>
        </div>
        {bolehLepas && onLepas && (
          <button
            type="button"
            onClick={onLepas}
            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="mr-1 inline h-3 w-3" aria-hidden />
            Ganti
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="h-10 pl-9 pr-3 text-[13px]"
          placeholder="Cari nama atau nomor WhatsApp"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          aria-label="Cari pelanggan"
        />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
        {hasil.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
            Tidak ada pelanggan yang cocok.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {hasil.map((p) => (
              <BarisPelanggan key={p.id} pelanggan={p} onPilih={() => onPilih(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
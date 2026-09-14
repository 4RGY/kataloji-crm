"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Search } from "lucide-react";

const COLUMNS = [
  "Nama",
  "WhatsApp",
  "Tanggal lahir",
  "Poin",
  "Terakhir transaksi",
];

export default function PelangganPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto max-w-6xl px-6 pb-10 pt-4 lg:px-10">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Pelanggan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftar pelanggan Kataloji: nama, nomor WhatsApp, dan poin loyalitas
          mereka.
        </p>
      </header>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau nomor WhatsApp"
            aria-label="Cari pelanggan"
            className="h-10 bg-card pl-9"
          />
        </div>
        <Button className="h-10 gap-2 font-semibold">
          <UserPlus className="h-4 w-4" />
          Tambah pelanggan
        </Button>
      </div>

      {/* Tabel pelanggan */}
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Header tabel */}
        <div className="hidden grid-cols-[2fr_1.5fr_1fr_0.7fr_1fr] gap-4 border-b border-border bg-muted/40 px-6 py-3 sm:grid">
          {COLUMNS.map((c) => (
            <p
              key={c}
              className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
            >
              {c}
            </p>
          ))}
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center gap-2 bg-card px-6 py-20 text-center">
          <p className="text-sm font-semibold text-foreground">
            Belum ada pelanggan tercatat
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Pelanggan baru otomatis masuk daftar ini setelah transaksi pertama
            mereka dicatat, atau bisa ditambah manual lewat tombol di atas.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Total pelanggan: 0
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RangeKey = "today" | "3d" | "7d" | "30d" | "all" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "3d", label: "3 hari" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "all", label: "Semua" },
];

function periodLabel(range: RangeKey, from: string, to: string) {
  if (range === "custom") {
    if (from && to) return `${from} sampai ${to}`;
    if (from) return `mulai ${from}`;
    return "pilih tanggal";
  }
  if (range === "all") return "sepanjang waktu";
  if (range === "today") return "hari ini";
  const label = RANGES.find((r) => r.key === range)?.label ?? "";
  return label.toLowerCase();
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  }, []);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const period = periodLabel(range, from, to);

  return (
    <div className="max-w-6xl px-6 pb-10 pt-4 lg:px-8">
      {/* Header */}
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary">
          {greeting}, Wahyu
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm capitalize text-muted-foreground">{today}</p>
        </div>
      </header>

      {/* Filter rentang */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Rentang waktu"
          className="flex rounded-full border border-border bg-card p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                range === r.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
          <button
            role="tab"
            aria-selected={range === "custom"}
            onClick={() => setRange("custom")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              range === "custom"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Pertanggal
          </button>
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Tanggal mulai"
              className="h-9 w-40 bg-card"
            />
            <span className="text-xs text-muted-foreground">sampai</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Tanggal akhir"
              className="h-9 w-40 bg-card"
            />
          </div>
        )}
      </div>

      {/* Omzet: hero metric */}
      <section aria-label="Omzet" className="mb-8">
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-card p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Omzet · {period}
              </p>
              <p className="mt-3 text-5xl font-extrabold tracking-tight tabular-nums lg:text-6xl">
                <span className="text-muted-foreground/50">Rp</span>{" "}
                <span className="text-foreground/30">0</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-muted-foreground">
                Rata-rata harian
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-muted-foreground/50">
                Rp 0
              </p>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">
                Transaksi terbesar
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-muted-foreground/50">
                Rp 0
              </p>
            </div>
          </div>
          <p className="mt-6 border-t border-primary/15 pt-4 text-sm leading-relaxed text-muted-foreground">
            Belum ada omzet tercatat pada periode ini. Angka di sini terisi
            otomatis seiring transaksi masuk lewat halaman Transaksi.
          </p>
        </div>
      </section>

      {/* Stat pendukung */}
      <section aria-label="Statistik pendukung" className="mb-8">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Rincian · {period}
        </p>
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border/60 sm:grid-cols-3">
          <div className="bg-card p-6">
            <p className="text-xs font-semibold text-muted-foreground">
              Transaksi
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-muted-foreground/50">
              0
            </p>
          </div>
          <div className="bg-card p-6">
            <p className="text-xs font-semibold text-muted-foreground">
              Pelanggan baru
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-muted-foreground/50">
              0
            </p>
          </div>
          <div className="bg-card p-6">
            <p className="text-xs font-semibold text-muted-foreground">
              Poin diberikan
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-muted-foreground/50">
              0
            </p>
          </div>
        </div>
      </section>

      {/* Grafik omzet, empty state */}
      <section aria-label="Grafik omzet">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Grafik omzet harian · {period}
        </p>
        <div className="rounded-xl border border-border bg-card">
          <div className="relative h-48 border-b border-dashed border-border/80 p-6">
            {/* garis bantu horizontal tipis, tempat grafik bakal tinggal */}
            <div className="absolute inset-x-6 top-1/2 border-t border-dotted border-border/50" />
            <div className="absolute inset-x-6 top-1/4 border-t border-dotted border-border/40" />
            <div className="absolute inset-x-6 top-3/4 border-t border-dotted border-border/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-sm font-medium text-muted-foreground">
                Grafik terisi otomatis setelah transaksi tercatat
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Sumbu horizontal: tanggal, sumbu vertikal: omzet harian
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

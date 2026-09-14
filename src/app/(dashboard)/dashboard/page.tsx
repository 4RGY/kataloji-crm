"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RangeKey = "today" | "3d" | "7d" | "30d" | "all" | "custom";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "today", label: "Hari ini", days: 1 },
  { key: "3d", label: "3 hari", days: 3 },
  { key: "7d", label: "7 hari", days: 7 },
  { key: "30d", label: "30 hari", days: 30 },
  { key: "all", label: "Semua", days: null },
];

const STATS = [
  { label: "Omzet", value: "Rp 0" },
  { label: "Transaksi", value: "0" },
  { label: "Pelanggan baru", value: "0" },
  { label: "Poin diberikan", value: "0" },
];

function periodLabel(range: RangeKey, from: string, to: string) {
  if (range === "custom") {
    if (from && to) return `${from} sampai ${to}`;
    if (from) return `mulai ${from}`;
    return "pilih tanggal";
  }
  if (range === "all") return "sepanjang waktu";
  if (range === "today") return "hari ini";
  const days = RANGES.find((r) => r.key === range)?.days ?? 0;
  return `${days} hari terakhir`;
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

  const firstName = "Wahyu";

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

  return (
    <div className="mx-auto max-w-6xl px-6 pb-10 pt-4 lg:px-10">
      {/* Header */}
      <header className="mb-8">
        <p className="text-sm font-semibold text-primary">
          {greeting}, {firstName}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm capitalize text-muted-foreground">{today}</p>
        </div>
      </header>

      {/* Filter rentang */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
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
      </div>

      {/* Pertanggal: muncul cuma kalau dipilih */}
      {range === "custom" && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
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

      {/* Kartu statistik polos, dipisah hairline */}
      <section aria-label="Ringkasan statistik">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Ringkasan · {periodLabel(range, from, to)}
        </p>
        <div className="mt-2 grid grid-cols-1 gap-px border-y border-border bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-card px-6 py-6">
              <p className="text-xs font-semibold text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-muted-foreground/70">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Grafik omzet, empty state */}
      <section className="mt-10" aria-label="Grafik omzet">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Omzet harian · {periodLabel(range, from, to)}
        </p>
        <Card className="mt-2 border-border/60 shadow-none">
          <CardContent className="p-6">
            <div className="relative h-52 w-full">
              {/* garis dasar putus-putus, tempat grafik bakal muncul */}
              <div className="absolute inset-x-0 bottom-0 border-b border-dashed border-border" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pb-6">
                <p className="text-sm font-semibold text-foreground">
                  Grafik muncul setelah transaksi tercatat
                </p>
                <p className="text-xs text-muted-foreground">
                  Angka harian diambil otomatis dari transaksi pada rentang
                  waktu terpilih
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Catatan kosong */}
      <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
        Belum ada transaksi tercatat. Catat transaksi pertama dari halaman
        Transaksi, lalu ringkasan dan grafik di dashboard ini mulai terisi
        otomatis.
      </p>
    </div>
  );
}

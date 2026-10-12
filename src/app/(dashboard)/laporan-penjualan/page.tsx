"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  rentangPeriode,
  saringPeriode,
  type JenisPeriode,
  type Periode,
} from "@/lib/periode-laporan";
import { kunciHariLaporanAtauNull } from "@/lib/hari-laporan";
import { menuUntukPeran } from "@/lib/staf";

interface TransaksiRingkas {
  total: number;
  diskon: number | null;
  created_at: string;
  tanggal_majoo: string | null;
  source: string | null;
}

const PILIHAN: { jenis: JenisPeriode; label: string }[] = [
  { jenis: "hari_ini", label: "Hari ini" },
  { jenis: "kemarin", label: "Kemarin" },
  { jenis: "minggu_ini", label: "Minggu ini" },
  { jenis: "bulan_ini", label: "Bulan ini" },
  { jenis: "tanggal", label: "Pertanggal" },
];

const rupiah = (n: number) =>
  "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function HalamanLaporanPenjualan() {
  const supabase = useMemo(() => createClient(), []);
  const [peran, setPeran] = useState<string | null | undefined>(undefined);
  const [transaksi, setTransaksi] = useState<TransaksiRingkas[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode>({ jenis: "bulan_ini" });
  const [tanggal, setTanggal] = useState("");

  // Kasir tidak boleh melihat omzet, walau mengetik URL langsung. Peran
  // dicek dulu, dan data tidak dimuat kalau tidak punya hak.
  useEffect(() => {
    let aktif = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!aktif) return;
      if (!user) {
        setPeran(null);
        return;
      }
      const { data: profil } = await supabase
        .from("profile")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!aktif) return;
      setPeran(profil?.role ?? null);
    })();
    return () => {
      aktif = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!menuUntukPeran(peran).penjualan) return;
    let aktif = true;
    void (async () => {
      const { data, error } = await supabase
        .from("transaksi")
        .select("total, diskon, created_at, tanggal_majoo, source")
        .order("created_at", { ascending: false });
      if (!aktif) return;
      if (error) {
        setGalat("Data transaksi belum bisa dimuat. Coba muat ulang.");
      } else {
        setTransaksi((data ?? []) as TransaksiRingkas[]);
      }
    })();
    return () => {
      aktif = false;
    };
  }, [supabase, peran]);

  const rentang = useMemo(() => rentangPeriode(periode, new Date()), [periode]);

  const terpilih = useMemo(() => {
    if (!transaksi || !rentang) return [];
    return saringPeriode(transaksi, rentang);
  }, [transaksi, rentang]);

  const ringkas = useMemo(() => {
    const omzet = terpilih.reduce((a, t) => a + (t.total - (t.diskon ?? 0)), 0);
    const jumlah = terpilih.length;
    const rataRata = jumlah > 0 ? Math.round(omzet / jumlah) : 0;

    // Rincian per hari laporan (tanggal_majoo untuk impor, created_at untuk manual).
    const perHari = new Map<string, { jumlah: number; omzet: number }>();
    for (const t of terpilih) {
      const kunci = kunciHariLaporanAtauNull(t);
      if (!kunci) continue;
      const cur = perHari.get(kunci) ?? { jumlah: 0, omzet: 0 };
      cur.jumlah += 1;
      cur.omzet += t.total - (t.diskon ?? 0);
      perHari.set(kunci, cur);
    }
    const harian = [...perHari.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([tgl, v]) => ({ tgl, ...v }));

    return { omzet, jumlah, rataRata, harian };
  }, [terpilih]);

  // `sampai` eksklusif (awal hari berikutnya), jadi hari terakhir = sampai - 1.
  const hariTerakhir = rentang
    ? new Date(rentang.sampai.getFullYear(), rentang.sampai.getMonth(), rentang.sampai.getDate() - 1)
    : null;
  const fmt = (d: Date) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const judulPeriode =
    rentang && hariTerakhir
      ? hariTerakhir.getTime() > rentang.dari.getTime()
        ? `${fmt(rentang.dari)} s.d. ${fmt(hariTerakhir)}`
        : fmt(rentang.dari)
      : "Pilih tanggal";

  if (peran !== undefined && !menuUntukPeran(peran).penjualan) {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Laporan penjualan</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Halaman ini hanya untuk admin dan manajer.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Laporan penjualan</h1>
          <p className="mt-1 text-sm text-muted-foreground">{judulPeriode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PILIHAN.map((p) => (
            <button
              key={p.jenis}
              type="button"
              onClick={() => setPeriode({ jenis: p.jenis, tanggal: tanggal || undefined })}
              className={
                "h-8 rounded-md px-2.5 text-xs font-semibold transition-colors " +
                (periode.jenis === p.jenis
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {p.label}
            </button>
          ))}
          {periode.jenis === "tanggal" && (
            <input
              type="date"
              aria-label="Pilih tanggal"
              value={tanggal}
              onChange={(e) => {
                setTanggal(e.target.value);
                setPeriode({ jenis: "tanggal", tanggal: e.target.value });
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            />
          )}
        </div>
      </header>

      {galat && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {galat}
        </p>
      )}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Omzet bersih</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-right">{rupiah(ringkas.omzet)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Transaksi</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-right">{ringkas.jumlah}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Rata-rata</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-right">{rupiah(ringkas.rataRata)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Per hari
        </div>
        {transaksi === null && !galat ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Memuat…</p>
        ) : ringkas.harian.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada transaksi di periode ini.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Tanggal</th>
                <th className="px-4 py-2 text-right font-medium">Transaksi</th>
                <th className="px-4 py-2 text-right font-medium">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {ringkas.harian.map((h) => (
                <tr key={h.tgl} className="border-t border-border">
                  <td className="px-4 py-2">{h.tgl}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{h.jumlah}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(h.omzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

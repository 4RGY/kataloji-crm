"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import {
  periodeMasihBerjalan,
  rentangPeriode,
  saringPeriode,
  type JenisPeriode,
  type Periode,
} from "@/lib/periode-laporan";
import { menuUntukPeran } from "@/lib/staf";
import { NILAI_POIN } from "@/lib/poin";
import {
  bandingPenjualan,
  ringkasPenjualan,
  type TransaksiPenjualan,
} from "@/lib/laporan-penjualan";
import { Download, Loader2, Minus, RefreshCw, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";

const PILIHAN: { jenis: JenisPeriode; label: string }[] = [
  { jenis: "hari_ini", label: "Hari ini" },
  { jenis: "kemarin", label: "Kemarin" },
  { jenis: "minggu_ini", label: "Minggu ini" },
  { jenis: "bulan_ini", label: "Bulan ini" },
  { jenis: "tanggal", label: "Pertanggal" },
];

const rupiah = (n: number) =>
  "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

/** Selisih bisa negatif: tandanya di depan "Rp", bukan menempel angkanya. */
const rupiahSelisih = (n: number) =>
  n < 0
    ? "-Rp " + Math.abs(n).toLocaleString("id-ID", { maximumFractionDigits: 0 })
    : "+Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function HalamanLaporanPenjualan() {
  const supabase = useMemo(() => createClient(), []);
  const [peran, setPeran] = useState<string | null | undefined>(undefined);
  const [transaksi, setTransaksi] = useState<TransaksiPenjualan[] | null>(null);
  const [terpotong, setTerpotong] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode>({ jenis: "bulan_ini" });
  const [tanggal, setTanggal] = useState("");
  const [sedangUnduh, setSedangUnduh] = useState(false);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);

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

  // Memuat lewat ambilSemua supaya halaman ini juga aman saat transaksi sudah
  // lewat seribu baris, dan jujur kalau datanya terpotong.
  const muat = useMemo(
    () => async () => {
      const hasil = await ambilSemua<TransaksiPenjualan>((dari, sampai) =>
        supabase
          .from("transaksi")
          .select("total, diskon, poin_dipakai, created_at, tanggal_majoo, source")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      );
      return hasil;
    },
    [supabase],
  );

  useEffect(() => {
    if (!menuUntukPeran(peran).penjualan) return;
    let aktif = true;
    void (async () => {
      const hasil = await muat();
      if (!aktif) return;
      if (hasil.error) {
        setGalat(hasil.error);
        setTerpotong(false);
      } else {
        setTransaksi(hasil.data);
        setTerpotong(hasil.terpotong);
        setGalat(null);
      }
    })();
    return () => {
      aktif = false;
    };
  }, [muat, peran]);

  async function muatUlang() {
    const hasil = await muat();
    if (hasil.error) {
      setGalat(hasil.error);
    } else {
      setTransaksi(hasil.data);
      setTerpotong(hasil.terpotong);
      setGalat(null);
    }
  }

  const rentang = useMemo(() => rentangPeriode(periode, new Date()), [periode]);

  const terpilih = useMemo(() => {
    if (!transaksi || !rentang) return [];
    return saringPeriode(transaksi, rentang);
  }, [transaksi, rentang]);

  const ringkas = useMemo(
    () => ringkasPenjualan(terpilih, NILAI_POIN),
    [terpilih],
  );

  // Perbandingan dengan periode sebelumnya. Dihitung dari SELURUH transaksi
  // yang sudah dimuat, karena periode pembanding bisa jatuh di luar periode
  // yang sedang dilihat (mis. membandingkan "bulan ini" dengan "bulan lalu").
  const masihBerjalan = useMemo(() => periodeMasihBerjalan(periode, new Date()), [periode]);

  const banding = useMemo(() => {
    if (!transaksi) return null;
    return bandingPenjualan(
      transaksi,
      periode,
      new Date(),
      NILAI_POIN,
      ringkas,
      masihBerjalan,
    );
  }, [transaksi, periode, ringkas, masihBerjalan]);

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

  async function unduh() {
    if (terpilih.length === 0) {
      setGalatUnduh(`Belum ada transaksi di ${judulPeriode.toLowerCase()}.`);
      return;
    }
    setSedangUnduh(true);
    setGalatUnduh(null);
    try {
      const { buatPdfPenjualan } = await import("@/lib/laporan-penjualan-pdf");
      const blob = buatPdfPenjualan({
        periodeLabel: judulPeriode,
        dibuatPada: new Date().toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        ringkas,
        banding,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-penjualan-${rentang ? fmt(rentang.dari).replace(/\s/g, "-") : "periode"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setGalatUnduh("Gagal membuat PDF. Coba lagi.");
    } finally {
      setSedangUnduh(false);
    }
  }

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

  const maksHari = ringkas.harian.reduce((m, h) => Math.max(m, h.omzet), 0);

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
          <button
            type="button"
            onClick={muatUlang}
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Muat ulang
          </button>
          <button
            type="button"
            onClick={unduh}
            disabled={sedangUnduh}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {sedangUnduh ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            Unduh PDF
          </button>
        </div>
      </header>

      {galat && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {galat}
        </p>
      )}
      {galatUnduh && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {galatUnduh}
        </p>
      )}
      {/* Kalau penarikan kena batas, katakan apa adanya: laporan yang diam-diam
          kehilangan sebagian data lebih berbahaya daripada peringatan. */}
      {terpotong && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Datanya sangat banyak, jadi angka di halaman ini mungkin belum
          lengkap. Coba perkecil periode laporannya.
        </p>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Omzet kotor</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums">{rupiah(ringkas.bruto)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Diskon</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-muted-foreground">
            {ringkas.diskon > 0 ? "-" + rupiah(ringkas.diskon) : rupiah(0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Potongan poin</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-muted-foreground">
            {ringkas.potonganPoin > 0 ? "-" + rupiah(ringkas.potonganPoin) : rupiah(0)}
          </p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold text-primary">Omzet bersih</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-primary">
            {rupiah(ringkas.omzet)}
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Transaksi</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums">{ringkas.jumlah}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Rata-rata per transaksi</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums">{rupiah(ringkas.rataRata)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Rata-rata per hari jualan</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums">
            {rupiah(ringkas.rataPerHariJualan)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            dari {ringkas.hariJualan} hari yang ada transaksinya
          </p>
        </div>
      </div>

      {/* Perbandingan periode sebelumnya. Sengaja memakai kalimat ragu saat
          periode belum selesai: bulan yang baru jalan 12 hari selalu tampak
          turun dibanding bulan lalu yang penuh, dan itu bukan kemunduran usaha
          melainkan waktu yang belum habis. */}
      {banding && !banding.tanpaData && (
        <section
          className={
            "mb-5 rounded-xl border px-4 py-3 " +
            (banding.selisih !== null && banding.selisih < 0
              ? "border-destructive/30 bg-destructive/5"
              : "border-chart-2/40 bg-chart-2/5")
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Banding periode
            </p>
            {banding.persen !== null ? (
              <span
                className={
                  "inline-flex items-center gap-1 text-sm font-extrabold tabular-nums " +
                  (banding.selisih !== null && banding.selisih < 0
                    ? "text-destructive"
                    : "text-chart-2")
                }
              >
                {banding.selisih !== null && banding.selisih < 0 ? (
                  <TrendingDown className="h-4 w-4" aria-hidden />
                ) : banding.selisih === 0 ? (
                  <Minus className="h-4 w-4" aria-hidden />
                ) : (
                  <TrendingUp className="h-4 w-4" aria-hidden />
                )}
                {banding.persen > 0 ? "+" : ""}
                {banding.persen}%
              </span>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                persentase tidak dihitung
              </span>
            )}
            <span className="text-sm tabular-nums text-muted-foreground">
              {rupiahSelisih(banding.selisih ?? 0)} dibanding {banding.sebelumnya?.label}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-muted-foreground">
            Periode sebelumnya {rupiah(banding.sebelumnya?.omzet ?? 0)} dari{" "}
            {banding.sebelumnya?.jumlah ?? 0} transaksi.
            {banding.belumSelesai && (
              <span className="font-semibold text-foreground">
                {" "}
                Periode ini belum selesai, jadi angkanya belum bisa dibanding
                setara.
              </span>
            )}
            {banding.tidakSetara && (
              <span>
                {" "}
                Hari ini baru berjalan sampai sekarang, sedangkan kemarin sudah
                penuh sehari. Bandingkan setelah hari ini berakhir.
              </span>
            )}
          </p>
        </section>
      )}

      {banding?.tanpaData && (
        <p className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Belum ada data periode sebelumnya untuk dibandingkan, jadi halaman ini
          tidak menampilkan naik atau turun.
        </p>
      )}

      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Per hari
          </p>
          {ringkas.hariTerbaik && (
            <p className="text-xs text-muted-foreground">
              Terbaik {ringkas.hariTerbaik.tglLabel},{" "}
              <span className="font-semibold text-foreground">
                {rupiah(ringkas.hariTerbaik.omzet)}
              </span>{" "}
              ({ringkas.hariTerbaik.jumlah} transaksi)
            </p>
          )}
        </div>
        {transaksi === null && !galat ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Memuat…</p>
        ) : ringkas.harian.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Belum ada transaksi di periode ini.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Tanggal</th>
                <th className="px-4 py-2 text-right font-medium">Transaksi</th>
                <th className="px-4 py-2 text-right font-medium">Omzet</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Porsi</th>
              </tr>
            </thead>
            <tbody>
              {ringkas.harian.map((h) => (
                <tr key={h.tgl} className="border-t border-border">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      {h.tglLabel}
                      {h.terbaik && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                          terbaik
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{h.jumlah}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {rupiah(h.omzet)}
                  </td>
                  <td className="hidden px-4 py-2 sm:table-cell">
                    <span className="block h-1.5 w-full min-w-24 overflow-hidden rounded-full bg-muted">
                      <span
                        className={
                          "block h-full rounded-full " +
                          (h.terbaik ? "bg-primary" : "bg-primary/45")
                        }
                        style={{ width: `${maksHari > 0 ? (h.omzet / maksHari) * 100 : 0}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border text-xs font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">{ringkas.jumlah}</td>
                <td className="px-4 py-2 text-right tabular-nums">{rupiah(ringkas.omzet)}</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </div>
  );
}

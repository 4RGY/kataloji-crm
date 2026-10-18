"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { NILAI_POIN, POIN_PER_RUPIAH, MIN_REDEEM } from "@/lib/poin";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";
import { formatWhatsapp } from "@/lib/pelanggan";
import {
  daftarAkanHangus,
  kalimatLoyalitas,
  ringkasLoyalitas,
  riwayatLoyalitas,
  tautanPengingat,
  TENGGAT_HANGUS,
  type BarisLedgerLoyalitas,
  type PelangganRingkas,
} from "@/lib/loyalitas-tampilan";
import { Button } from "@/components/ui/button";
import {
  AlarmClock,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** "2026-09-15T11:02:00+07:00" -> "15 Sep 2026, 11.02" */
function waktuPanjang(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "2027-09-14" -> "14 Sep 2027" */
function tanggalSingkat(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Warna tenggat. Tujuh hari ke bawah dianggap mendesak karena pesan
 * pengingat butuh waktu dibaca dan pelanggan butuh waktu datang.
 */
function nadaTenggat(sisaHari: number): string {
  if (sisaHari <= 7) return "border-destructive/40 bg-destructive/10 text-destructive";
  if (sisaHari <= 30) return "border-primary/40 bg-primary/10 text-primary";
  return "border-border bg-muted text-muted-foreground";
}

export default function HalamanLoyalitas() {
  const supabase = useMemo(() => createClient(), []);

  const [ledger, setLedger] = useState<BarisLedgerLoyalitas[]>([]);
  const [pelanggan, setPelanggan] = useState<PelangganRingkas[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [tenggat, setTenggat] = useState<number>(30);
  const [batasRiwayat, setBatasRiwayat] = useState(15);

  const hariIni = useMemo(() => new Date(), []);

  const ambil = useCallback(async () => {
    // Buku besar diambil UTUH lewat ambilSemua, bukan .limit(), karena
    // PostgREST memotong respons di 1000 baris tanpa memberi tahu. Tanpa ini,
    // poin beredar akan terlihat lebih kecil daripada kenyataannya begitu
    // buku besar melewati seribu baris.
    const [hasilLedger, hasilPelanggan] = await Promise.all([
      ambilSemua<BarisLedgerLoyalitas>((dari, sampai) =>
        supabase
          .from("point_ledger")
          .select(
            "id, pelanggan_id, transaksi_id, tipe, poin_masuk, poin_keluar, sisa, kedaluwarsa_pada, keterangan, created_at",
          )
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<PelangganRingkas>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, nama, whatsapp")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
    ]);
    return { hasilLedger, hasilPelanggan };
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const { hasilLedger, hasilPelanggan } = await ambil();
      if (!aktif) return;

      if (hasilLedger.error) {
        catatGalat("muat buku besar poin", hasilLedger.error);
        setGalat(
          pesanGalat(hasilLedger.error, "Gagal memuat data poin. Coba muat ulang."),
        );
        setMemuat(false);
        return;
      }

      // Kegagalan membaca daftar pelanggan TIDAK menggagalkan halaman:
      // angka poin tetap benar, hanya namanya yang belum terbaca.
      if (hasilPelanggan.error) {
        catatGalat("muat nama pelanggan", hasilPelanggan.error);
      }

      setLedger(hasilLedger.data ?? []);
      setPelanggan(hasilPelanggan.data ?? []);
      setGalat(null);
      setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambil]);

  async function muatUlang() {
    setMemuat(true);
    const { hasilLedger, hasilPelanggan } = await ambil();
    if (hasilLedger.error) {
      catatGalat("muat ulang buku besar poin", hasilLedger.error);
      setGalat(pesanGalat(hasilLedger.error, "Gagal memuat data poin."));
    } else {
      setLedger(hasilLedger.data ?? []);
      setPelanggan(hasilPelanggan.data ?? []);
      setGalat(null);
    }
    setMemuat(false);
  }

  const ringkas = useMemo(
    () => ringkasLoyalitas(ledger, NILAI_POIN, hariIni),
    [ledger, hariIni],
  );

  const akanHangus = useMemo(
    () => daftarAkanHangus(ledger, pelanggan, tenggat, NILAI_POIN, hariIni),
    [ledger, pelanggan, tenggat, hariIni],
  );

  const riwayat = useMemo(
    () => riwayatLoyalitas(ledger, pelanggan),
    [ledger, pelanggan],
  );

  const kalimat = kalimatLoyalitas(ringkas, akanHangus.length, tenggat);
  const adaData = ringkas.poinDiterbitkan > 0;

  if (memuat) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Memuat data poin…
        </div>
      </div>
    );
  }

  if (galat) {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Loyalitas</h1>
        </header>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">{galat}</p>
          <Button variant="outline" className="h-11" onClick={muatUlang}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Loyalitas</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {kalimat}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 gap-2"
          onClick={muatUlang}
          disabled={memuat}
        >
          <RefreshCw className={memuat ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Muat ulang
        </Button>
      </header>

      {/* ====== Ringkasan pokok ====== */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section
          aria-label="Poin beredar"
          className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-7 lg:p-8"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Poin beredar · saat ini
          </p>
          <p className="mt-3 flex items-baseline gap-2 text-4xl font-extrabold tracking-tight tabular-nums lg:text-5xl">
            <Coins className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            {ringkas.poinBeredar.toLocaleString("id-ID")}
            <span className="text-lg font-bold text-muted-foreground">poin</span>
          </p>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Setara potongan tagihan {rupiah.format(ringkas.nilaiRupiah)}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-primary/15 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Dipegang
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {ringkas.pemilikPoin} pelanggan
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Aturan poin
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                1 : {rupiah.format(POIN_PER_RUPIAH)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Minimum tukar
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {MIN_REDEEM} poin
              </p>
            </div>
          </div>

          {!adaData && (
            <p className="mt-5 border-t border-primary/15 pt-4 text-sm leading-relaxed text-muted-foreground">
              Poin terbit otomatis begitu kasir mencatat transaksi yang
              tertaut ke seorang pelanggan.
            </p>
          )}
        </section>

        {/* Arus poin: terbit, ditukar, hangus */}
        <section aria-label="Arus poin" className="flex flex-col">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Arus poin · sepanjang waktu
          </p>
          <div className="flex flex-1 flex-col justify-center rounded-xl border border-border bg-card px-5 py-2">
            {[
              {
                label: "Diterbitkan",
                nilai: ringkas.poinDiterbitkan,
                warna: "text-foreground",
              },
              {
                label: "Ditukar pelanggan",
                nilai: ringkas.poinDitukar,
                warna: "text-primary",
              },
              {
                label: "Hangus tak terpakai",
                nilai: ringkas.poinHangus,
                warna:
                  ringkas.poinHangus > 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center justify-between gap-3 border-b border-dashed border-border py-3.5 last:border-b-0"
              >
                <p className="text-sm font-semibold text-muted-foreground">
                  {b.label}
                </p>
                <p className={`text-2xl font-extrabold tabular-nums ${b.warna}`}>
                  {b.nilai.toLocaleString("id-ID")}
                </p>
              </div>
            ))}
          </div>

          {/* Tingkat penukaran: seberapa banyak poin benar-benar dipakai.
              Angka rendah berarti program loyalitas belum terasa manfaatnya
              oleh pelanggan, bukan berarti kedai untung. */}
          <div className="mt-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Tingkat penukaran
              </p>
              <p className="text-2xl font-extrabold tabular-nums">
                {ringkas.tingkatPenukaran}%
              </p>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Tingkat penukaran ${ringkas.tingkatPenukaran} persen`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${ringkas.tingkatPenukaran}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Bagian poin terbit yang akhirnya ditukar pelanggan. Angka kecil
              berarti poinnya belum terasa berguna, bukan berarti kedai untung.
            </p>
          </div>

          {/* Catatan kejujuran angka.
              Kalau aritmetikanya tidak nyambung, itu DIKATAKAN, bukan
              disembunyikan. Penyebabnya tidak ditebak karena menebak di
              catatan audit lebih berbahaya daripada mengaku tidak tahu. */}
          {ringkas.selisihTakDikenal !== 0 && (
            <p
              role="status"
              className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
            >
              <span className="font-bold text-foreground">
                Ada {Math.abs(ringkas.selisihTakDikenal)} poin yang hilang dari
                catatan.
              </span>{" "}
              Sisa di buku besar {ringkas.poinBeredar} poin, padahal{" "}
              {ringkas.poinDiterbitkan} terbit dikurangi {ringkas.poinDitukar}{" "}
              ditukar mestinya{" "}
              {ringkas.poinDiterbitkan - ringkas.poinDitukar - ringkas.poinHangus}
              . Penyebabnya transaksi uji di awal proyek. Kasir tetap memakai{" "}
              {ringkas.poinBeredar}.
            </p>
          )}
        </section>
      </div>

      {/* ====== Poin akan hangus: daftar kerja ====== */}
      <section aria-label="Poin akan hangus" className="mt-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div className="flex items-center gap-2.5">
              <AlarmClock className="h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Poin akan hangus
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Paling mendesak berada di urutan atas
                </p>
              </div>
            </div>
            <div
              className="flex gap-1 rounded-lg bg-muted p-1"
              role="tablist"
              aria-label="Tenggat poin hangus"
            >
              {TENGGAT_HANGUS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tenggat === t}
                  onClick={() => setTenggat(t)}
                  className={
                    // min-h-11: tab ini diketuk untuk berpindah tenggat, jadi
                    // ikut ambang sentuh 44px. Dengan py-1.5 saja tingginya
                    // hanya 28px karena mengikuti ukuran huruf text-xs.
                    "flex min-h-11 items-center rounded-md px-4 text-xs font-bold transition-colors " +
                    (tenggat === t
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {t} hari
                </button>
              ))}
            </div>
          </div>

          {akanHangus.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold">
                Tidak ada poin yang hangus dalam {tenggat} hari ke depan
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                {adaData
                  ? "Tidak ada yang perlu dihubungi soal poin hari ini."
                  : "Daftar ini terisi sendiri begitu ada poin yang mendekati masa berlakunya."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {akanHangus.map((b) => {
                const wa = tautanPengingat(b);
                return (
                  <li
                    key={b.pelanggan_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{b.nama}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {b.whatsapp ? formatWhatsapp(b.whatsapp) : "Tanpa nomor WhatsApp"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-extrabold tabular-nums">
                          {b.poin} poin
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {rupiah.format(b.nilaiRupiah)}
                        </p>
                      </div>

                      <span
                        className={
                          "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums " +
                          nadaTenggat(b.sisaHari)
                        }
                      >
                        {b.sisaHari === 0
                          ? "hangus hari ini"
                          : b.sisaHari === 1
                            ? "besok"
                            : `${b.sisaHari} hari`}
                        {" · "}
                        {tanggalSingkat(b.tanggal)}
                      </span>

                      {/* Tautan hanya muncul kalau nomornya ada, supaya tidak
                          ada tombol yang diklik lalu tidak terjadi apa pun. */}
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold transition-colors hover:bg-muted"
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                          Ingatkan
                        </a>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          tidak bisa dihubungi
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ====== Riwayat pergerakan poin ====== */}
      <section aria-label="Riwayat poin" className="mt-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Riwayat pergerakan poin
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Catatan ini hanya bisa ditambah, tidak bisa diubah atau dihapus
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {riwayat.length.toLocaleString("id-ID")} catatan
            </span>
          </div>

          {riwayat.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-muted-foreground">
              Belum ada pergerakan poin.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {riwayat.slice(0, batasRiwayat).map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className={
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
                          (b.arah === "masuk"
                            ? "bg-primary/12 text-primary"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {b.arah === "masuk" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{b.nama}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.label}
                          {b.keterangan ? ` · ${b.keterangan}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={
                            "text-sm font-extrabold tabular-nums " +
                            (b.arah === "masuk" ? "text-primary" : "")
                          }
                        >
                          {b.arah === "masuk" ? "+" : "-"}
                          {b.poin}
                        </p>
                        {b.kedaluwarsa_pada && (
                          <p className="text-[11px] text-muted-foreground">
                            berlaku sampai {tanggalSingkat(b.kedaluwarsa_pada)}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {waktuPanjang(b.waktu)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {riwayat.length > batasRiwayat && (
                <div className="border-t border-border px-6 py-3.5 text-center">
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => setBatasRiwayat((n) => n + 25)}
                  >
                    Tampilkan {Math.min(25, riwayat.length - batasRiwayat)}{" "}
                    catatan lagi
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

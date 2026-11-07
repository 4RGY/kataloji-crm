"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { NILAI_POIN } from "@/lib/poin";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";
import {
  AMBANG_HARI,
  AMBANG_POLA,
  hariBeroperasi,
  labelJam,
  periksaKeyakinan,
  ringkasPelanggan,
  sebaranPoinPelanggan,
  sebaranHari,
  sebaranJam,
  tinggiBatang,
  ultahBulanIni,
  pelangganSetia,
  nilaiBersih,
  type PelangganAnalitik,
  type TransaksiAnalitik,
} from "@/lib/analitik";
import { Button } from "@/components/ui/button";
import { AksesDitolak } from "@/components/akses-ditolak";
import { bolehLihatPemasaran } from "@/lib/staf";
import { Cake, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { rentangPeriode, saringPeriode, type Periode } from "@/lib/periode-laporan";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const ringkas = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Panel yang isinya ditahan sampai datanya cukup.
 *
 * Sengaja ringkas (bukan kotak tinggi berisi satu kalimat): bagian yang
 * ditahan bisa beberapa sekaligus, dan kotak setinggi itu membuat halaman
 * penuh ruang kosong yang tidak memberi informasi apa pun.
 */
function Tertahan({ pesan, progres }: { pesan: string; progres?: number }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <ShieldAlert
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{pesan}</p>
      </div>
      {progres !== undefined && (
        <div
          className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${Math.round(progres)} persen menuju ambang`}
        >
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${Math.max(2, Math.min(100, progres))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function HalamanAnalitik() {
  const supabase = useMemo(() => createClient(), []);

  const [transaksi, setTransaksi] = useState<TransaksiAnalitik[]>([]);
  const [pelanggan, setPelanggan] = useState<PelangganAnalitik[]>([]);
  const [redeemLedger, setRedeemLedger] = useState<{ pelanggan_id: string; poin_keluar: number; created_at: string; transaksi_id: string | null }[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [periodeUnduh, setPeriodeUnduh] = useState<Periode>({ jenis: "bulan_ini" });
  const [tanggalUnduh, setTanggalUnduh] = useState("");
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);

  // Peran dan izin, dibaca dari database. Syaratnya sama dengan sidebar
  // supaya menu dan halaman tidak pernah berbeda pendapat.
  const [peran, setPeran] = useState<string | null>(null);
  const [bolehLihat, setBolehLihat] = useState<boolean | null>(null);

  const kini = useMemo(() => new Date(), []);

  const ambil = useCallback(async () => {
    // Peran diperiksa sebelum data diambil. Menolak setelah data terunduh
    // hanya menyembunyikan, bukan menjaga.
    const { data: sesi } = await supabase.auth.getUser();
    let role: string | null = null;
    if (sesi.user) {
      const { data: profil } = await supabase
        .from("profile")
        .select("role")
        .eq("id", sesi.user.id)
        .maybeSingle();
      role = profil?.role ?? null;
    }
    if (!bolehLihatPemasaran(role)) {
      return { ditolak: true as const, role, t: null, p: null };
    }

    const [t, p, r] = await Promise.all([
      ambilSemua<TransaksiAnalitik>((dari, sampai) =>
        supabase
          .from("transaksi")
          .select("id, total, diskon, poin_dipakai, poin_didapat, pelanggan_id, created_at, tanggal_majoo, items, source")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<PelangganAnalitik>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, nama, tgl_lahir, created_at, poin")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<{ pelanggan_id: string; poin_keluar: number; created_at: string; transaksi_id: string | null }>((dari, sampai) =>
        supabase
          .from("point_ledger")
          .select("pelanggan_id, poin_keluar, created_at, transaksi_id")
          .eq("tipe", "redeem")
          .gt("poin_keluar", 0)
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
    ]);
    return { ditolak: false as const, role, t, p, r };
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const hasil = await ambil();
      if (!aktif) return;
      setPeran(hasil.role);
      if (hasil.ditolak) {
        setBolehLihat(false);
        setMemuat(false);
        return;
      }
      setBolehLihat(true);
      const { t, p, r } = hasil;
      const errorMuat = t.error ?? p.error ?? r.error;
      if (errorMuat) {
        catatGalat("muat analitik", errorMuat);
        setGalat(pesanGalat(errorMuat, "Gagal memuat data. Coba muat ulang."));
      } else {
        setTransaksi(t.data ?? []);
        setPelanggan(p.data ?? []);
        setRedeemLedger(r.data ?? []);
        setGalat(null);
      }
      setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambil]);

  async function muatUlang() {
    setMemuat(true);
    const hasil = await ambil();
    if (hasil.ditolak) {
      setBolehLihat(false);
      setMemuat(false);
      return;
    }
    const { t, p, r } = hasil;
    const errorMuat = t.error ?? p.error ?? r.error;
    if (errorMuat) {
      catatGalat("muat ulang analitik", errorMuat);
      setGalat(pesanGalat(errorMuat, "Gagal memuat data."));
    } else {
      setTransaksi(t.data ?? []);
      setPelanggan(p.data ?? []);
      setRedeemLedger(r.data ?? []);
      setGalat(null);
    }
    setMemuat(false);
  }

  const rentangTerpilih = useMemo(() => {
    const periode: Periode = periodeUnduh.jenis === "tanggal"
      ? { jenis: "tanggal", tanggal: tanggalUnduh }
      : periodeUnduh;
    return rentangPeriode(periode, kini);
  }, [periodeUnduh, tanggalUnduh, kini]);
  const transaksiDitampilkan = useMemo(
    () => rentangTerpilih ? saringPeriode(transaksi, rentangTerpilih) : [],
    [transaksi, rentangTerpilih],
  );
  const hari = useMemo(() => sebaranHari(transaksiDitampilkan, NILAI_POIN), [transaksiDitampilkan]);
  const jamHasil = useMemo(() => sebaranJam(transaksiDitampilkan, NILAI_POIN), [transaksiDitampilkan]);
  const jam = jamHasil.baris;
  const pel = useMemo(() => ringkasPelanggan(transaksiDitampilkan, NILAI_POIN), [transaksiDitampilkan]);
  const ultah = useMemo(() => ultahBulanIni(pelanggan, kini), [pelanggan, kini]);
  const setia = useMemo(() => pelangganSetia(transaksiDitampilkan, NILAI_POIN, 5), [transaksiDitampilkan]);
  const namaPelanggan = useMemo(() => new Map(pelanggan.map((p) => [p.id, p.nama])), [pelanggan]);
  const yakinSetia = periksaKeyakinan(setia.length, 3, "pelanggan yang datang");
  const yakinPola = periksaKeyakinan(transaksiDitampilkan.length, AMBANG_POLA);
  const yakinHari = periksaKeyakinan(hariBeroperasi(transaksiDitampilkan), AMBANG_HARI, "hari jualan");
  const puncakOmzet = useMemo(() => {
    const terisi = jam.filter((b) => b.omzet > 0);
    if (terisi.length === 0) return null;
    const tertinggi = Math.max(...terisi.map((b) => b.omzet));
    const puncak = terisi.filter((b) => b.omzet === tertinggi);
    return puncak.length === 1 ? puncak[0] : null;
  }, [jam]);
  const omzetJamTertinggi = Math.max(...jam.map((j) => j.omzet), 0);
  const hariTertinggi = Math.max(...hari.map((h) => h.omzet), 0);

  async function unduhLaporan() {
    const kini = new Date();
    const periodePakai: Periode =
      periodeUnduh.jenis === "tanggal" ? { jenis: "tanggal", tanggal: tanggalUnduh } : periodeUnduh;
    const rentang = rentangPeriode(periodePakai, kini);
    if (!rentang) {
      setGalatUnduh("Pilih tanggal dulu, format tanggal belum benar.");
      return;
    }
    setGalatUnduh(null);

    const dipilih = saringPeriode(transaksi, rentang);
    const rentangAdaRedeem = redeemLedger.some((baris) => {
      const waktu = new Date(baris.created_at).getTime();
      return waktu >= rentang.dari.getTime() && waktu < rentang.sampai.getTime();
    });
    if (dipilih.length === 0 && !rentangAdaRedeem) {
      setGalatUnduh(`Belum ada transaksi di ${rentang.label.toLowerCase()}.`);
      return;
    }

    // Hitung ulang dari transaksi yang sudah disaring, supaya PDF hanya memuat periode itu.
    const hariP = sebaranHari(dipilih, NILAI_POIN);
    const setiaP = pelangganSetia(dipilih, NILAI_POIN, 5);
    const omzetP = dipilih.reduce((s, t) => s + nilaiBersih(t, NILAI_POIN), 0);
    const pelP = ringkasPelanggan(dipilih, NILAI_POIN);

    // Poin yang dilaporkan adalah saldo yang berlaku sekarang, bukan hasil
    // hitung ulang dari periode, karena angka itulah yang dipakai kasir saat
    // menukar poin.
    const poinBeredarP = pelanggan.reduce((s, p) => s + (p.poin ?? 0), 0);
    const sebaranPoinP = sebaranPoinPelanggan(pelanggan).map((k) => ({
      label: k.label,
      jumlah: k.jumlah,
    }));

    const awal = rentang.dari.getTime();
    const akhir = rentang.sampai.getTime();
    const petaRedeem = new Map<string, { kali: number; poin: number }>();
    const transaksiSudahDiLedger = new Set(
      redeemLedger.map((baris) => baris.transaksi_id).filter((id): id is string => Boolean(id)),
    );
    for (const baris of redeemLedger) {
      const waktu = new Date(baris.created_at).getTime();
      if (waktu < awal || waktu >= akhir) continue;
      const curr = petaRedeem.get(baris.pelanggan_id) ?? { kali: 0, poin: 0 };
      petaRedeem.set(baris.pelanggan_id, {
        kali: curr.kali + 1,
        poin: curr.poin + baris.poin_keluar,
      });
    }
    for (const t of dipilih) {
      if (!t.pelanggan_id || !t.poin_dipakai || t.poin_dipakai <= 0 || transaksiSudahDiLedger.has(t.id)) continue;
      const curr = petaRedeem.get(t.pelanggan_id) ?? { kali: 0, poin: 0 };
      petaRedeem.set(t.pelanggan_id, { kali: curr.kali + 1, poin: curr.poin + t.poin_dipakai });
    }

    const topRedeemP = [...petaRedeem.entries()]
      .map(([pelangganId, data]) => ({
        nama: namaPelanggan.get(pelangganId) ?? "Pelanggan",
        kaliTukar: data.kali,
        poinDipakai: data.poin,
        nilaiRupiah: data.poin * NILAI_POIN,
      }))
      .sort((a, b) => b.poinDipakai - a.poinDipakai)
      .slice(0, 5);

    const poinDidapatPeriode = dipilih.reduce((s, t) => s + (t.poin_didapat ?? 0), 0);
    const poinDipakaiPeriode = [...petaRedeem.values()].reduce((s, data) => s + data.poin, 0);

    const { buatPdfLaporan } = await import("@/lib/laporan-pdf");
    const blob = buatPdfLaporan({
      periodeLabel: rentang.label,
      dibuatPada: kini.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
      jumlahTransaksi: dipilih.length,
      omzet: omzetP,
      hari: hariP.map((h) => ({ nama: h.nama, omzet: h.omzet })),
      tertaut: pelP.berpelanggan,
      tanpaPelanggan: pelP.tanpaPelanggan,
      persenTertaut: Math.round(pelP.persenTertaut),
      jumlahPelangganAktif: new Set(
        dipilih.map((t) => t.pelanggan_id).filter((x): x is string => Boolean(x)),
      ).size,
      poinBeredar: poinBeredarP,
      nilaiPoinBeredar: poinBeredarP * NILAI_POIN,
      jumlahPelanggan: pelanggan.length,
      sebaranPoin: sebaranPoinP,
      setia: setiaP.map((s) => ({
        nama: namaPelanggan.get(s.pelangganId) ?? "Pelanggan",
        kunjungan: s.kunjungan,
        omzet: s.omzet,
      })),
      jumlahPelangganDatang: setiaP.length,
      topRedeem: topRedeemP,
      pergerakanPoin: {
        poinDidapat: poinDidapatPeriode,
        poinDipakai: poinDipakaiPeriode,
        nilaiPotonganDipakai: poinDipakaiPeriode * NILAI_POIN,
      },
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Tanggal lokal, bukan toISOString: di WIB, 1 Okt 00.00 jadi 30 Sep di UTC.
    const p = (n: number) => String(n).padStart(2, "0");
    const d = rentang.dari;
    a.download = `laporan-loyalitas-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }




  // Sebaran saldo poin pelanggan. Halaman ini mengukur kesehatan program
  // loyalitas, jadi yang ditampilkan adalah poin yang berlaku sekarang, bukan
  // besar belanja per struk.
  const sebaranPoin = useMemo(
    () => sebaranPoinPelanggan(pelanggan),
    [pelanggan],
  );
  const poinTersimpan = useMemo(
    () => pelanggan.reduce((s, p) => s + (p.poin ?? 0), 0),
    [pelanggan],
  );

  if (bolehLihat === false) {
    return (
      <AksesDitolak
        judul="Analitik"
        keterangan="Pola belanja pelanggan dan jam ramai kedai."
        peran={peran}
        alasan="Analitik dipakai untuk mengambil keputusan usaha, dan itu wewenang admin atau manajer. Untuk data pelanggan sehari-hari, gunakan halaman Pelanggan."
      />
    );
  }

  if (memuat) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Memuat analitik…
        </div>
      </div>
    );
  }

  if (galat) {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Analitik</h1>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
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
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Analitik</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {yakinPola.cukup
              ? `${transaksiDitampilkan.length} transaksi di ${rentangTerpilih?.label ?? "periode ini"}.`
              : `Baru ${transaksiDitampilkan.length} transaksi di periode ini. Sebagian pola masih ditahan sampai datanya cukup.`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Periode analitik dan laporan"
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              value={periodeUnduh.jenis}
              onChange={(e) => {
                setGalatUnduh(null);
                setPeriodeUnduh({ jenis: e.target.value as Periode["jenis"] });
              }}
            >
              <option value="hari_ini">Hari ini</option>
              <option value="kemarin">Kemarin</option>
              <option value="minggu_ini">Minggu ini</option>
              <option value="bulan_ini">Bulan ini</option>
              <option value="tanggal">Pertanggal</option>
            </select>
            {periodeUnduh.jenis === "tanggal" && (
              <input
                type="date"
                aria-label="Pilih tanggal laporan"
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                value={tanggalUnduh}
                onChange={(e) => setTanggalUnduh(e.target.value)}
              />
            )}
            <Button variant="outline" className="h-11 gap-2" onClick={() => void unduhLaporan()} disabled={transaksiDitampilkan.length === 0}>
              <Download className="h-4 w-4" />
              Unduh PDF
            </Button>
            <Button variant="outline" className="h-11 gap-2" onClick={muatUlang}>
              <RefreshCw className="h-4 w-4" />
              Muat ulang
            </Button>
          </div>
          {galatUnduh && (
            <p role="alert" className="text-sm text-muted-foreground">
              {galatUnduh}
            </p>
          )}
        </div>
      </header>

      {/* Baris atas dibuat timpang 2:1. Kiri memegang satu angka yang paling
          menentukan, kanan menampung dua angka pendukung. Tata letak simetris
          membuat ketiganya terasa sama penting, padahal tidak. */}
      <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
        <section
          aria-label="Transaksi tertaut pelanggan"
          className="rounded-xl border border-border bg-card p-6 lg:p-7"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Transaksi yang dikenali
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-5xl font-extrabold tracking-tight tabular-nums">
              {pel.persenTertaut}
              <span className="text-2xl">%</span>
            </p>
            <p className="pb-1.5 text-sm text-muted-foreground">
              {pel.berpelanggan} dari {pel.totalTransaksi} transaksi
            </p>
          </div>

          <div
            className="mt-5 flex h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${pel.persenTertaut} persen transaksi tertaut pelanggan`}
          >
            <div
              className="bg-primary transition-[width]"
              style={{ width: `${pel.persenTertaut}%` }}
            />
          </div>

          <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Omzet dari pelanggan terdaftar
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {rupiah.format(pel.omzetBerpelanggan)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Omzet tanpa identitas
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-muted-foreground">
                {rupiah.format(pel.omzetTanpaPelanggan)}
              </p>
            </div>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            {pel.tanpaPelanggan === 0
              ? "Semua transaksi tertaut ke pelanggan."
              : `${pel.tanpaPelanggan} transaksi tidak tertaut ke siapa pun. Poin tidak terbit, dan kedai tidak tahu siapa yang datang.`}
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <section
            aria-label="Sebaran poin pelanggan"
            className="flex-1 rounded-xl border border-border bg-card p-6"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Sebaran poin pelanggan
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {poinTersimpan > 0
                ? `${poinTersimpan.toLocaleString("id-ID")} poin tersimpan di ${pelanggan.length} pelanggan`
                : "Belum ada poin yang tersimpan"}
            </p>
            {poinTersimpan === 0 ? (
              <div className="mt-4">
                <Tertahan pesan="Belum ada poin yang dikumpulkan pelanggan." />
              </div>
            ) : (
              <>
                {/* Satu batang bertumpuk: kelompok pemilik poin langsung terbaca
                    proporsinya tanpa harus membaca angkanya satu per satu. */}
                <div
                  className="mt-4 flex h-6 overflow-hidden rounded-md"
                  role="img"
                  aria-label={sebaranPoin
                    .map((k) => `${k.label} ${k.jumlah} pelanggan`)
                    .join(", ")}
                >
                  {sebaranPoin.map((k, i) => (
                    <div
                      key={k.label}
                      className={
                        "h-full " +
                        [
                          "bg-primary",
                          "bg-primary/65",
                          "bg-primary/40",
                          "bg-primary/22",
                          "bg-foreground/18",
                        ][i % 5]
                      }
                      style={{
                        width: `${(k.jumlah / Math.max(1, pelanggan.length)) * 100}%`,
                      }}
                      title={`${k.label}: ${k.jumlah} pelanggan`}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {sebaranPoin.map((k, i) => (
                    <li key={k.label} className="flex items-center gap-2 text-xs">
                      <span
                        aria-hidden
                        className={
                          "h-2 w-2 shrink-0 rounded-sm " +
                          [
                            "bg-primary",
                            "bg-primary/65",
                            "bg-primary/40",
                            "bg-primary/22",
                            "bg-foreground/18",
                          ][i % 5]
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {k.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {Math.round((k.jumlah / Math.max(1, pelanggan.length)) * 100)}%
                      </span>
                      <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
                        {k.jumlah}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  Pelanggan berpoin besar adalah yang paling dekat ke hadiah,
                  sekaligus yang paling dirugikan kalau poinnya hangus.
                </p>
              </>
            )}
          </section>

          <section
            aria-label="Ulang tahun bulan ini"
            className="flex-1 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-2">
              <Cake className="h-3.5 w-3.5 text-primary" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Ultah bulan ini
              </p>
            </div>
            {ultah.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Tidak ada yang berulang tahun bulan ini.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {ultah.slice(0, 4).map((u) => (
                  <li
                    key={u.nama}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="truncate font-semibold">{u.nama}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      tgl {u.tanggal}
                    </span>
                  </li>
                ))}
                {ultah.length > 4 && (
                  <li className="pt-1 text-xs text-muted-foreground">
                    dan {ultah.length - 4} lagi
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Pelanggan paling sering datang */}
      <div className="mt-4">
        <section
          aria-label="Pelanggan paling sering datang"
          className="rounded-xl border border-border bg-card p-6 lg:p-7"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Pelanggan paling sering datang
            </p>
            <p className="text-xs text-muted-foreground">
              Dihitung per hari kunjungan unik, sejalan dengan frekuensi retensi pelanggan.
            </p>
          </div>

          {!yakinSetia.cukup ? (
            <div className="mt-4">
              <Tertahan
                pesan={yakinSetia.pesan}
                progres={(yakinSetia.jumlah / yakinSetia.ambang) * 100}
              />
            </div>
          ) : (
            <div className="mt-5 divide-y divide-border/60">
              {setia.map((s, i) => {
                const rataRata = s.kunjungan > 0 ? Math.round(s.omzet / s.kunjungan) : 0;
                return (
                  <div
                    key={s.pelangganId}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-foreground">
                        {namaPelanggan.get(s.pelangganId) ?? "Pelanggan"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground sm:justify-end">
                      <span>
                        <strong className="font-medium text-foreground">{s.kunjungan}</strong> kunjungan
                      </span>
                      <span aria-hidden className="text-border">|</span>
                      <span>
                        Total <strong className="font-medium text-foreground">{rupiah.format(s.omzet)}</strong>
                      </span>
                      <span aria-hidden className="text-border">|</span>
                      <span>
                        Rata-rata <strong className="font-medium text-foreground">{rupiah.format(rataRata)}</strong> / kunjungan
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section
        aria-label="Omzet per jam"
        className="mt-4 rounded-xl border border-border bg-card p-6 lg:p-7"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Omzet per jam</p>
          <p className="text-xs text-muted-foreground">
            {puncakOmzet
              ? `Puncak jam ${labelJam(puncakOmzet.jam)}, ${rupiah.format(puncakOmzet.omzet)}`
              : "Belum ada jam yang menonjol"}
          </p>
        </div>
        {jamHasil.dilewati > 0 && (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {jamHasil.dihitung === 0
              ? `Belum ada transaksi dengan jam kedatangan tercatat. ${jamHasil.dilewati} transaksi impor hanya mencatat tanggal.`
              : `${jamHasil.dilewati} transaksi impor hanya mencatat tanggal, jadi tidak masuk grafik jam.`}
          </p>
        )}
        {omzetJamTertinggi === 0 ? (
          <div className="mt-4"><Tertahan pesan="Belum ada omzet dengan jam kedatangan tercatat pada periode ini." /></div>
        ) : (
          <div className="mt-6 flex items-end gap-1.5">
            {jam.map((j) => {
              const tinggi = tinggiBatang(j.omzet, omzetJamTertinggi);
              const puncakIni = puncakOmzet?.jam === j.jam;
              return (
                <div key={j.jam} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full items-end">
                    <div
                      className={`w-full rounded-t ${j.omzet === 0 ? "h-px bg-border" : puncakIni ? "bg-primary" : "bg-primary/30"}`}
                      style={j.omzet > 0 ? { height: `${Math.max(8, tinggi)}%` } : undefined}
                      title={`${labelJam(j.jam)}: ${rupiah.format(j.omzet)} (${j.jumlah} transaksi)`}
                    />
                  </div>
                  <span className={`text-[11px] tabular-nums ${puncakIni ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                    {j.jam}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-4">
        <section
          aria-label="Sebaran hari"
          className="rounded-xl border border-border bg-card p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Omzet per hari
            </p>
            <p className="text-xs text-muted-foreground">
              {hariBeroperasi(transaksiDitampilkan)} hari jualan
            </p>
          </div>

          {/* Perbandingan antar hari butuh minimal seminggu penuh. Dengan dua
              hari data, "Senin paling ramai" hanya berarti Senin kebetulan
              yang tercatat. */}
          {!yakinHari.cukup ? (
            <div className="mt-4">
              <Tertahan
                pesan={yakinHari.pesan}
                progres={(yakinHari.jumlah / yakinHari.ambang) * 100}
              />
            </div>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {hari.map((h) => (
                <li key={h.hari} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
                    {h.nama.slice(0, 3)}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary/70"
                      style={{ width: `${tinggiBatang(h.omzet, hariTertinggi)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {h.omzet > 0 ? ringkas.format(h.omzet) : "0"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Omzet di halaman ini dihitung setelah diskon promo dan potongan poin,
        jadi angkanya sama dengan yang masuk laci.
      </p>
    </div>
  );
}

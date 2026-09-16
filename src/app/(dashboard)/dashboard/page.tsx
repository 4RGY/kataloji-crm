"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { NILAI_POIN } from "@/lib/poin";
import { namaPanggilan } from "@/lib/staf";
import { catatGalat } from "@/lib/pesan-galat";
import {
  hitungPapanLoyalitas,
  hitungPoinDiberikan,
  rataPerStruk,
  ringkasJamTeramai,
  sebaranJam,
  type BarisLedger,
} from "@/lib/dashboard-tampilan";
import { Loader2, RefreshCw, ShieldAlert, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type RangeKey = "today" | "3d" | "7d" | "30d" | "all" | "custom";

const RANGES: { key: RangeKey; label: string; hari: number | null }[] = [
  { key: "today", label: "Hari ini", hari: 1 },
  { key: "3d", label: "3 hari", hari: 3 },
  { key: "7d", label: "7 hari", hari: 7 },
  { key: "30d", label: "30 hari", hari: 30 },
  { key: "all", label: "Semua", hari: null },
];

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const rupiahRingkas = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** kunci tanggal lokal YYYY-MM-DD (bukan UTC, supaya batas hari ikut WIB) */
function kunciHari(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function awalHari(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

interface Transaksi {
  id: string;
  total: number;
  diskon: number;
  poin_dipakai: number;
  poin_didapat: number;
  created_at: string;
  pelanggan_id: string | null;
}

interface PelangganRingkas {
  id: string;
  created_at: string;
}

export default function DashboardPage() {
  const supabase = createClient();

  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [pelanggan, setPelanggan] = useState<PelangganRingkas[]>([]);
  // Buku besar poin dipakai papan loyalitas. Diambil terpisah dari transaksi
  // karena jumlah barisnya tidak sebanding: satu transaksi bisa menghasilkan
  // satu baris poin, dan riwayat penukaran menambah baris lagi.
  const [ledger, setLedger] = useState<BarisLedger[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  // Nama untuk sapaan, diambil dari sesi yang sedang login. Sebelumnya
  // ditulis tetap "Wahyu" sehingga staf lain disapa dengan nama orang lain.
  const [namaStaf, setNamaStaf] = useState<string | null>(null);
  // Peran dibaca sekaligus di sini. Selain untuk sapaan, nilainya dipakai
  // membedakan "akun belum punya data staf" dari "data masih kosong".
  // Tanpa pembedaan itu, akun tanpa baris profile hanya melihat dashboard
  // kosong tanpa penjelasan dan tampak seperti data hilang.
  const [peranStaf, setPeranStaf] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let aktif = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!aktif || !user) return;

      const { data } = await supabase
        .from("profile")
        .select("nama, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!aktif) return;
      setNamaStaf(namaPanggilan(data?.nama ?? null, user.email ?? null));
      setPeranStaf((data?.role as string | null) ?? null);
    })();
    return () => {
      aktif = false;
    };
  }, [supabase]);

  // Ambil semua transaksi + tanggal daftar pelanggan. SetState hanya
  // terjadi setelah await, jadi aman terhadap aturan set-state-in-effect.
  const ambilData = useCallback(async () => {
    // Wajib berhalaman. `.limit(2000)` TIDAK menembus batas 1000 milik
    // PostgREST: server tetap hanya mengirim 1000 baris pertama tanpa
    // error. Akibatnya omzet pada rentang "Semua" terhitung kurang dari
    // yang sebenarnya. ambilSemua() memecahnya jadi beberapa permintaan.
    const [t, p, l] = await Promise.all([
      ambilSemua<Transaksi>((dari, sampai) =>
        supabase
          .from("transaksi")
          .select("id, total, diskon, poin_dipakai, poin_didapat, created_at, pelanggan_id")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<PelangganRingkas>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<BarisLedger>((dari, sampai) =>
        supabase
          .from("point_ledger")
          .select("pelanggan_id, tipe, poin_masuk, poin_keluar, sisa, kedaluwarsa_pada")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
    ]);
    return { t, p, l };
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const { t, p, l } = await ambilData();
      if (!aktif) return;
      if (t.error || p.error) {
        setGalat("Gagal memuat data dashboard.");
        setTransaksi([]);
        setPelanggan([]);
        setLedger([]);
      } else {
        setGalat(null);
        setTransaksi(t.data);
        setPelanggan(p.data);
        // Kegagalan membaca buku besar poin sengaja TIDAK menggagalkan
        // seluruh dashboard. Omzet dan grafik tetap tampil, hanya papan
        // loyalitas yang kosong. Kalau digabung, satu tabel bermasalah
        // membuat pemilik kehilangan seluruh laporan hariannya.
        setLedger(l.error ? [] : l.data);
        if (l.error) catatGalat("baca ledger poin dashboard", l.error);
      }
      setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambilData]);

  async function muatUlang() {
    setMemuat(true);
    const { t, p, l } = await ambilData();
    if (t.error || p.error) {
      setGalat("Gagal memuat data dashboard.");
    } else {
      setGalat(null);
      setTransaksi(t.data);
      setPelanggan(p.data);
      setLedger(l.error ? [] : l.data);
      if (l.error) catatGalat("baca ledger poin dashboard", l.error);
    }
    setMemuat(false);
  }

  // ---- batas periode ----
  const batas = useMemo(() => {
    const hariIni = awalHari(new Date());
    if (range === "custom") {
      const mulai = from ? awalHari(new Date(from + "T00:00:00")) : null;
      const selesai = to ? new Date(to + "T23:59:59.999") : null;
      return { mulai, selesai };
    }
    const cfg = RANGES.find((r) => r.key === range);
    if (!cfg || cfg.hari === null) return { mulai: null, selesai: null };
    const mulai = new Date(hariIni);
    mulai.setDate(mulai.getDate() - (cfg.hari - 1));
    return { mulai, selesai: null };
  }, [range, from, to]);

  const tersaring = useMemo(() => {
    return transaksi.filter((t) => {
      const d = new Date(t.created_at);
      if (batas.mulai && d < batas.mulai) return false;
      if (batas.selesai && d > batas.selesai) return false;
      return true;
    });
  }, [transaksi, batas]);

  // ---- metrik ----
  const metrik = useMemo(() => {
    // Omzet = uang yang benar-benar masuk: total dikurangi diskon promo
    // dan potongan poin. Potongan poin bukan uang tunai.
    const omzet = tersaring.reduce(
      (s, t) =>
        s +
        Math.max(
          0,
          t.total - (t.diskon ?? 0) - (t.poin_dipakai ?? 0) * NILAI_POIN,
        ),
      0,
    );
    // Poin diberikan dihitung lewat fungsi, bukan dengan menjumlahkan
    // poin_didapat mentah. Transaksi tanpa pelanggan tetap menyimpan angka di
    // kolom itu padahal tidak pernah masuk buku besar, sehingga penjumlahan
    // mentah menampilkan angka lebih besar daripada poin yang benar-benar
    // diberikan. Data pemilik sempat menunjukkan 9 padahal buku besarnya 8.
    const poinDiberikan = hitungPoinDiberikan(tersaring);
    const poinDitukar = tersaring.reduce((s, t) => s + (t.poin_dipakai ?? 0), 0);

    const hariUnik = new Set(tersaring.map((t) => kunciHari(new Date(t.created_at))));
    const rataHarian = hariUnik.size > 0 ? Math.round(omzet / hariUnik.size) : 0;
    const terbesar = tersaring.reduce((m, t) => Math.max(m, t.total), 0);

    const pelangganBaru = pelanggan.filter((p) => {
      const d = new Date(p.created_at);
      if (batas.mulai && d < batas.mulai) return false;
      if (batas.selesai && d > batas.selesai) return false;
      return true;
    }).length;

    const jumlahPelangganUnik = new Set(
      tersaring.filter((t) => t.pelanggan_id).map((t) => t.pelanggan_id),
    ).size;

    return {
      omzet,
      rataHarian,
      rataPerStruk: rataPerStruk(omzet, tersaring.length),
      terbesar,
      jumlah: tersaring.length,
      pelangganBaru,
      poinDiberikan,
      poinDitukar,
      pelangganUnik: jumlahPelangganUnik,
    };
  }, [tersaring, pelanggan, batas]);

  // ---- seri grafik: omzet per hari ----
  const seri = useMemo(() => {
    if (tersaring.length === 0) return [];
    const peta = new Map<string, number>();
    for (const t of tersaring) {
      const k = kunciHari(new Date(t.created_at));
      const netto = Math.max(
        0,
        t.total - (t.diskon ?? 0) - (t.poin_dipakai ?? 0) * NILAI_POIN,
      );
      peta.set(k, (peta.get(k) ?? 0) + netto);
    }
    const hari = [...peta.keys()].sort();
    // batasi 30 batang terakhir supaya tetap terbaca
    return hari.slice(-30).map((k) => ({
      hari: k,
      nilai: peta.get(k) ?? 0,
    }));
  }, [tersaring]);

  const maksSeri = useMemo(
    () => seri.reduce((m, s) => Math.max(m, s.nilai), 0),
    [seri],
  );

  // Sebaran transaksi per jam pada periode terpilih. Dihitung dari data yang
  // sudah diambil untuk grafik omzet, jadi tidak ada permintaan tambahan.
  const batangJam = useMemo(() => sebaranJam(tersaring), [tersaring]);

  const ringkasJam = useMemo(() => ringkasJamTeramai(batangJam), [batangJam]);

  // Papan loyalitas sengaja memakai SELURUH buku besar, bukan yang tersaring
  // periode. Poin beredar adalah saldo yang berlaku hari ini; kalau dibatasi
  // ke periode terpilih, angkanya berubah saat pemilik berpindah rentang dan
  // itu menyesatkan.
  const papan = useMemo(
    () =>
      hitungPapanLoyalitas(
        ledger,
        transaksi,
        pelanggan.length,
        NILAI_POIN,
        new Date(),
      ),
    [ledger, transaksi, pelanggan],
  );

  const period = useMemo(() => {
    if (range === "custom") {
      if (from && to) return `${from} sampai ${to}`;
      if (from) return `mulai ${from}`;
      return "pilih tanggal";
    }
    if (range === "all") return "sepanjang waktu";
    if (range === "today") return "hari ini";
    return RANGES.find((r) => r.key === range)?.label.toLowerCase() ?? "";
  }, [range, from, to]);

  const sapaan = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  }, []);

  const tanggalHariIni = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const adaData = tersaring.length > 0;

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {sapaan}
            {namaStaf ? `, ${namaStaf}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">
            {tanggalHariIni}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={muatUlang}
          disabled={memuat}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", memuat && "animate-spin")} />
          Muat ulang
        </Button>
      </header>

      {/* Filter rentang */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Rentang waktu"
          className="flex flex-wrap rounded-full border border-border bg-card p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                // min-h-11 dan bukan py- saja: padding vertikal kecil membuat
                // tinggi ikut ukuran huruf, dan pada text-xs hasilnya 28px.
                // Tombol rentang ini diketuk pemilik untuk berpindah periode
                // dan harus ikut ambang sentuh 44px seperti tombol lain.
                "flex min-h-11 items-center rounded-full px-4 text-xs font-semibold transition-colors",
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
              "flex min-h-11 items-center rounded-full px-4 text-xs font-semibold transition-colors",
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
              className="h-11 w-40 bg-card"
            />
            <span className="text-xs text-muted-foreground">sampai</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Tanggal akhir"
              className="h-11 w-40 bg-card"
            />
          </div>
        )}
      </div>

      {memuat ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-24">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Memuat data…</p>
        </div>
      ) : galat ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-24 text-center">
          <p className="text-sm font-semibold">{galat}</p>
          <Button variant="outline" size="sm" onClick={muatUlang}>
            Coba lagi
          </Button>
        </div>
      ) : peranStaf === null ? (
        /* Akun berhasil masuk tetapi tidak punya baris di tabel profile.
           Akibatnya staff_role() bernilai kosong dan SEMUA policy RLS
           menolak, sehingga tiap halaman tampak kosong tanpa pesan error.
           Keadaan ini dijelaskan di sini supaya tidak terbaca sebagai
           "data hilang", karena datanya ada dan lengkap. */
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">
            Akun Anda belum terdaftar sebagai staf
          </p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Login berhasil, tetapi peran Anda belum dikenali sehingga seluruh
            data sengaja dikunci. Data di sistem tidak hilang. Minta admin
            menambahkan akun ini lewat menu Staf, atau menjalankan berkas
            backfill-profile.sql di Supabase untuk akun lama.
          </p>
        </div>
      ) : (
        <>
          {/* Baris atas: hero omzet + rincian */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* Hero omzet */}
            <section
              aria-label="Omzet"
              className="texture-grain relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-7 lg:p-8"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Omzet · {period}
              </p>

              <p className="mt-3 text-4xl font-extrabold tracking-tight tabular-nums lg:text-5xl">
                <span className="text-muted-foreground/50">Rp</span>{" "}
                {metrik.omzet.toLocaleString("id-ID")}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-primary/15 pt-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Rata-rata harian
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {rupiah.format(metrik.rataHarian)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Transaksi terbesar
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {rupiah.format(metrik.terbesar)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Rata-rata per struk
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {rupiah.format(metrik.rataPerStruk)}
                  </p>
                </div>
              </div>

              {!adaData && (
                <p className="mt-5 border-t border-primary/15 pt-4 text-sm leading-relaxed text-muted-foreground">
                  Belum ada omzet pada periode ini. Angka terisi otomatis begitu
                  transaksi dicatat lewat halaman Transaksi.
                </p>
              )}
            </section>

            {/* Rincian */}
            <section aria-label="Rincian" className="flex flex-col">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Rincian · {period}
              </p>
              {/* Dibariskan, bukan ditumpuk sebagai tiga kartu.
                  Versi sebelumnya membuat tiap kartu ditarik tinggi agar
                  sejajar dengan kartu omzet, sehingga isi yang hanya sekitar
                  48px duduk di dalam kotak 205px. Sebagai baris, tinggi
                  kartu mengikuti isinya dan angkanya terbaca berurutan. */}
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-border bg-card px-5 py-2">
                {[
                  { label: "Transaksi", nilai: metrik.jumlah.toLocaleString("id-ID"), tanda: null },
                  { label: "Pelanggan baru", nilai: metrik.pelangganBaru.toLocaleString("id-ID"), tanda: null },
                  {
                    label: "Poin diberikan",
                    nilai: metrik.poinDiberikan.toLocaleString("id-ID"),
                    tanda: metrik.poinDiberikan > 0 ? "tercatat di buku poin" : null,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between gap-3 border-b border-dashed border-border py-3.5 last:border-b-0"
                  >
                    <p className="text-sm font-semibold text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="flex items-center gap-2 text-2xl font-extrabold tabular-nums">
                      {s.nilai}
                      {s.tanda && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                          {s.tanda}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Grafik omzet harian */}
          <section aria-label="Grafik omzet" className="mt-5">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Grafik omzet harian
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {period}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                    Omzet harian
                  </span>
                  {maksSeri > 0 && (
                    <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      puncak {rupiah.format(maksSeri)}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6">
                {seri.length === 0 ? (
                  <div className="flex h-52 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border">
                    <p className="text-sm font-medium text-muted-foreground">
                      Grafik terisi otomatis setelah transaksi tercatat
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sumbu horizontal tanggal, sumbu vertikal omzet harian
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Batang dibatasi lebarnya, bukan flex-1 murni.
                        Dengan flex-1 saja, satu hari data membuat batangnya
                        melebar mengikuti kartu (terukur 892px) sehingga tidak
                        lagi terbaca sebagai batang, melainkan sebagai blok
                        warna yang tampak seperti kegagalan memuat grafik.
                        basis-11 + max-w-[72px] menjaga bentuk batang tetap
                        batang, berapa pun jumlah harinya. */}
                    <div className="flex h-52 items-end gap-1.5">
                      {seri.map((s) => {
                        const tinggi = maksSeri > 0 ? (s.nilai / maksSeri) * 100 : 0;
                        const d = new Date(s.hari + "T00:00:00");
                        const label = new Intl.DateTimeFormat("id-ID", {
                          day: "numeric",
                          month: "short",
                        }).format(d);
                        return (
                          <div
                            key={s.hari}
                            className="group relative flex h-full min-w-0 flex-1 basis-11 flex-col items-center justify-end sm:max-w-[72px]"
                          >
                            {/* tooltip sederhana saat disorot */}
                            <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-semibold tabular-nums text-popover-foreground shadow-md group-hover:block">
                              {label} · {rupiah.format(s.nilai)}
                            </span>
                            <div
                              className="w-full rounded-t-sm bg-primary/85 transition-colors group-hover:bg-primary"
                              style={{ height: `${Math.max(tinggi, 1.5)}%` }}
                            />
                            <span className="mt-2 max-w-full truncate text-[10px] text-muted-foreground">
                              {label}
                            </span>
                          </div>
                        );
                      })}
                      {/* Sisa ruang diisi penanda bergaris yang menyatakan
                          dirinya belum berisi, bukan dibiarkan kosong atau
                          diisi batang melar yang membohongi pembaca. */}
                      {seri.length < 7 && (
                        <div
                          aria-hidden
                          className="flex h-full flex-[2] items-center justify-center rounded-lg border border-dashed border-border/70"
                        >
                          <p className="px-3 text-center text-[11px] leading-snug text-muted-foreground/70">
                            Hari berikutnya akan terisi di sini
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      Menampilkan {seri.length} hari terakhir yang ada transaksi.
                      Omzet dihitung setelah diskon promo dan potongan poin.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Jam ramai + papan loyalitas. Ditaruh di bawah grafik omzet
              supaya bagian bawah halaman terisi dan pemilik langsung dapat
              dua hal yang bisa ditindak: kapan orang datang, dan berapa poin
              yang masih beredar. */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            {/* Jam ramai */}
            <section aria-label="Jam ramai">
              <div className="h-full rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Jam ramai
                  </p>
                  <p className="text-xs text-muted-foreground">{ringkasJam}</p>
                </div>

                <div className="p-6">
                  <div className="flex h-32 items-end gap-[3px]">
                    {batangJam.map((b) => (
                      <div
                        key={b.jam}
                        className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                        title={`${b.label}.00 · ${b.jumlah} transaksi`}
                      >
                        {/* tooltip sederhana saat disorot */}
                        <span className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-semibold tabular-nums text-popover-foreground shadow-md group-hover:block">
                          {b.label}.00 · {b.jumlah} transaksi
                        </span>
                        {/* Jam kosong tetap digambar setipis mungkin supaya
                            sumbu waktunya utuh dan tidak ada jam yang
                            tampak hilang. */}
                        <div
                          className={
                            "w-full rounded-t-sm transition-colors " +
                            (b.puncak
                              ? "bg-primary"
                              : b.jumlah > 0
                                ? "bg-primary/45 group-hover:bg-primary/70"
                                : "bg-foreground/10")
                          }
                          style={{ height: `${b.jumlah > 0 ? Math.max(b.porsi * 100, 4) : 2}px` }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Sumbu jam. Sengaja ditulis langsung, bukan mengambil
                      dari data, supaya label tetap rata walau layar sempit
                      dan tidak ada label yang saling menumpuk. */}
                  <div className="mt-2 flex gap-[3px]">
                    {batangJam.map((b) => (
                      <p
                        key={b.jam}
                        className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-muted-foreground"
                      >
                        {b.jam}
                      </p>
                    ))}
                  </div>

                  <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                    Setiap batang satu jam pada rentang operasional. Dipakai
                    untuk menyusun jam staf dan memilih jam promo.
                  </p>
                </div>
              </div>
            </section>

            {/* Papan loyalitas */}
            <section aria-label="Papan loyalitas">
              <div className="h-full rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    <Star className="h-3 w-3" aria-hidden />
                    Papan loyalitas
                  </p>
                  <p className="text-xs text-muted-foreground">Saat ini</p>
                </div>

                <div className="grid grid-cols-2 gap-px bg-border/60">
                  {[
                    {
                      label: "Poin beredar",
                      nilai: papan.poinBeredar.toLocaleString("id-ID"),
                      keterangan: `senilai ${rupiah.format(papan.nilaiPoinBeredar)}`,
                    },
                    {
                      label: "Pelanggan",
                      nilai: papan.pelangganTerdaftar.toLocaleString("id-ID"),
                      keterangan: "terdaftar",
                    },
                    {
                      label: "Pelanggan ulang",
                      nilai: papan.pelangganUlang.toLocaleString("id-ID"),
                      keterangan: "datang lebih dari sekali",
                    },
                    {
                      label: "Akan hangus",
                      nilai: papan.akanHangus.toLocaleString("id-ID"),
                      keterangan: `dalam 60 hari, senilai ${rupiah.format(papan.nilaiAkanHangus)}`,
                    },
                  ].map((s) => (
                    <div key={s.label} className="bg-card px-5 py-4">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                        {s.label}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums">
                        {s.nilai}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {s.keterangan}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="border-t border-border px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                  Poin beredar adalah potongan yang belum dipakai pelanggan,
                  jadi angkanya bisa dibaca sebagai kewajiban kedai.
                </p>
              </div>
            </section>
          </div>

          {/* Ringkas tambahan */}
          {adaData && (
            <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border/60 sm:grid-cols-2">
              <div className="bg-card px-6 py-5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Pelanggan bertransaksi
                </p>
                <p className="mt-1.5 text-xl font-bold tabular-nums">
                  {metrik.pelangganUnik.toLocaleString("id-ID")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dari {tersaring.length} transaksi pada periode ini
                </p>
              </div>
              <div className="bg-card px-6 py-5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Poin ditukar
                </p>
                <p className="mt-1.5 text-xl font-bold tabular-nums">
                  {metrik.poinDitukar.toLocaleString("id-ID")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Senilai {rupiahRingkas.format(metrik.poinDitukar * NILAI_POIN)} potongan
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

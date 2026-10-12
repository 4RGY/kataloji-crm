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
  jamTeramai,
  labelJam,
  periksaKeyakinan,
  ringkasPelanggan,
  sebaranBelanja,
  sebaranHari,
  sebaranJam,
  tinggiBatang,
  ultahBulanIni,
  menuTerlaris,
  pelangganSetia,
  nilaiBersih,
  AMBANG_MENU,
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

/** Panel yang isinya ditahan sampai datanya cukup. */
function Tertahan({ pesan }: { pesan: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-5 py-8">
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {pesan}
      </p>
    </div>
  );
}

export default function HalamanAnalitik() {
  const supabase = useMemo(() => createClient(), []);

  const [transaksi, setTransaksi] = useState<TransaksiAnalitik[]>([]);
  const [pelanggan, setPelanggan] = useState<PelangganAnalitik[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

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

    const [t, p] = await Promise.all([
      ambilSemua<TransaksiAnalitik>((dari, sampai) =>
        supabase
          .from("transaksi")
          .select("total, diskon, poin_dipakai, pelanggan_id, created_at, tanggal_majoo, items")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<PelangganAnalitik>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, nama, tgl_lahir, created_at")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
    ]);
    return { ditolak: false as const, role, t, p };
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
      const { t, p } = hasil;
      if (t.error) {
        catatGalat("muat analitik", t.error);
        setGalat(pesanGalat(t.error, "Gagal memuat data. Coba muat ulang."));
      } else {
        setTransaksi(t.data ?? []);
        setPelanggan(p.data ?? []);
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
    const { t, p } = hasil;
    if (t.error) {
      catatGalat("muat ulang analitik", t.error);
      setGalat(pesanGalat(t.error, "Gagal memuat data."));
    } else {
      setTransaksi(t.data ?? []);
      setPelanggan(p.data ?? []);
      setGalat(null);
    }
    setMemuat(false);
  }

  const jam = useMemo(() => sebaranJam(transaksi, NILAI_POIN), [transaksi]);
  const hari = useMemo(() => sebaranHari(transaksi, NILAI_POIN), [transaksi]);
  const belanja = useMemo(() => sebaranBelanja(transaksi, NILAI_POIN), [transaksi]);
  const pel = useMemo(() => ringkasPelanggan(transaksi, NILAI_POIN), [transaksi]);
  const ultah = useMemo(() => ultahBulanIni(pelanggan, kini), [pelanggan, kini]);
  const menu = useMemo(() => menuTerlaris(transaksi, 5), [transaksi]);
  const setia = useMemo(() => pelangganSetia(transaksi, NILAI_POIN, 5), [transaksi]);
  const namaPelanggan = useMemo(
    () => new Map(pelanggan.map((p) => [p.id, p.nama])),
    [pelanggan],
  );
  const yakinMenu = periksaKeyakinan(menu.reduce((s, m) => s + m.qty, 0), AMBANG_MENU, "item terjual");
  const yakinSetia = periksaKeyakinan(setia.length, 3, "pelanggan yang datang");

  const [periodeUnduh, setPeriodeUnduh] = useState<Periode>({ jenis: "bulan_ini" });
  const [tanggalUnduh, setTanggalUnduh] = useState("");
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);

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
    if (dipilih.length === 0) {
      setGalatUnduh(`Belum ada transaksi di ${rentang.label.toLowerCase()}.`);
      return;
    }

    // Hitung ulang dari transaksi yang sudah disaring, supaya PDF hanya memuat periode itu.
    const jamP = sebaranJam(dipilih, NILAI_POIN);
    const hariP = sebaranHari(dipilih, NILAI_POIN);
    const menuP = menuTerlaris(dipilih, 5);
    const setiaP = pelangganSetia(dipilih, NILAI_POIN, 5);
    const omzetP = dipilih.reduce((s, t) => s + nilaiBersih(t, NILAI_POIN), 0);

    const { buatPdfLaporan } = await import("@/lib/laporan-pdf");
    const blob = buatPdfLaporan({
      periodeLabel: rentang.label,
      dibuatPada: kini.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
      jumlahTransaksi: dipilih.length,
      omzet: omzetP,
      jam: jamP,
      hari: hariP.map((h) => ({ nama: h.nama, omzet: h.omzet })),
      menu: menuP.map((m) => ({ nama: m.nama, qty: m.qty, persen: m.persen })),
      totalItemTerjual: menuP.reduce((s, m) => s + m.qty, 0),
      setia: setiaP.map((s) => ({
        nama: namaPelanggan.get(s.pelangganId) ?? "Pelanggan",
        kunjungan: s.kunjungan,
        omzet: s.omzet,
      })),
      jumlahPelangganDatang: setiaP.length,
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Tanggal lokal, bukan toISOString: di WIB, 1 Okt 00.00 jadi 30 Sep di UTC.
    const p = (n: number) => String(n).padStart(2, "0");
    const d = rentang.dari;
    a.download = `laporan-analitik-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }


  const yakinPola = periksaKeyakinan(transaksi.length, AMBANG_POLA);
  const yakinHari = periksaKeyakinan(hariBeroperasi(transaksi), AMBANG_HARI, "hari jualan");
  const puncak = jamTeramai(jam);

  const jamTertinggi = Math.max(...jam.map((j) => j.jumlah), 0);
  const hariTertinggi = Math.max(...hari.map((h) => h.omzet), 0);
  const belanjaTertinggi = Math.max(...belanja.map((b) => b.jumlah), 0);

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
        <h1 className="text-2xl font-extrabold tracking-tight">Analitik</h1>
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
          <h1 className="text-2xl font-extrabold tracking-tight">Analitik</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {yakinPola.cukup
              ? `Pola dari ${transaksi.length} transaksi.`
              : `Baru ${transaksi.length} transaksi. Sebagian pola masih ditahan sampai datanya cukup.`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Periode laporan"
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
            <Button variant="outline" className="h-11 gap-2" onClick={() => void unduhLaporan()} disabled={transaksi.length === 0}>
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
            aria-label="Jam teramai"
            className="flex-1 rounded-xl border border-border bg-card p-6"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Jam teramai
            </p>
            {puncak ? (
              <>
                <p className="mt-3 text-3xl font-extrabold tabular-nums">
                  {labelJam(puncak.jam)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {puncak.jumlah} transaksi, {ringkas.format(puncak.omzet)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-3xl font-extrabold text-muted-foreground">
                  belum ada
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Belum ada satu jam yang menonjol dari yang lain.
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

      {/* Menu terlaris dan pelanggan paling sering datang. Keduanya ditahan
          sampai datanya cukup, sama seperti bagian lain halaman ini. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section
          aria-label="Menu terlaris"
          className="rounded-xl border border-border bg-card p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Menu terlaris
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {yakinMenu.cukup
              ? `Dari ${yakinMenu.jumlah} porsi terjual, diurutkan jumlah porsi`
              : yakinMenu.pesan}
          </p>
          {!yakinMenu.cukup || menu.length === 0 ? (
            <div className="mt-5">
              <Tertahan pesan="Ranking menu muncul setelah cukup item tercatat, supaya tidak menyimpulkan dari sedikit data." />
            </div>
          ) : (
            <ol className="mt-5 space-y-3">
              {menu.map((m, i) => (
                <li key={m.nama} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">
                      <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                      {m.nama}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {m.qty} porsi, {m.persen}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${tinggiBatang(m.qty, menu[0].qty)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-label="Pelanggan paling sering datang"
          className="rounded-xl border border-border bg-card p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Pelanggan paling sering datang
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dihitung per hari kunjungan, sejalan dengan aturan poin per kunjungan.
          </p>
          {!yakinSetia.cukup ? (
            <div className="mt-5">
              <Tertahan pesan={yakinSetia.pesan} />
            </div>
          ) : (
            <ol className="mt-5 space-y-3">
              {setia.map((s, i) => (
                <li
                  key={s.pelangganId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="truncate font-semibold">
                    <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                    {namaPelanggan.get(s.pelangganId) ?? "Pelanggan"}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {s.kunjungan} kunjungan, {rupiah.format(s.omzet)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Jam ramai memakai lebar penuh: sumbunya 16 kolom, dipadatkan ke
          setengah lebar membuat batangnya terlalu rapat untuk dibaca. */}
      <section
        aria-label="Sebaran jam"
        className="mt-4 rounded-xl border border-border bg-card p-6 lg:p-7"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Sebaran per jam
          </p>
          <p className="text-xs text-muted-foreground">
            {yakinPola.cukup
              ? "Dipakai menyusun jadwal staf dan memilih jam promo"
              : yakinPola.pesan}
          </p>
        </div>

        {jamTertinggi === 0 ? (
          <div className="mt-5">
            <Tertahan pesan="Belum ada transaksi yang tercatat pada jam buka." />
          </div>
        ) : (
          <div className="mt-6 flex items-end gap-1.5">
            {jam.map((j) => {
              const tinggi = tinggiBatang(j.jumlah, jamTertinggi);
              const puncakIni = puncak?.jam === j.jam;
              return (
                <div key={j.jam} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full items-end">
                    <div
                      className={
                        "w-full rounded-t transition-[height] " +
                        (j.jumlah === 0
                          ? "h-px bg-border"
                          : puncakIni
                            ? "bg-primary"
                            : "bg-primary/30")
                      }
                      style={j.jumlah > 0 ? { height: `${Math.max(8, tinggi)}%` } : undefined}
                      title={`${labelJam(j.jam)}: ${j.jumlah} transaksi`}
                    />
                  </div>
                  <span
                    className={
                      "text-[10px] tabular-nums " +
                      (puncakIni ? "font-bold text-foreground" : "text-muted-foreground")
                    }
                  >
                    {j.jam}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section
          aria-label="Sebaran hari"
          className="rounded-xl border border-border bg-card p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Omzet per hari
            </p>
            <p className="text-xs text-muted-foreground">
              {hariBeroperasi(transaksi)} hari jualan
            </p>
          </div>

          {/* Perbandingan antar hari butuh minimal seminggu penuh. Dengan dua
              hari data, "Senin paling ramai" hanya berarti Senin kebetulan
              yang tercatat. */}
          {!yakinHari.cukup ? (
            <div className="mt-5">
              <Tertahan pesan={yakinHari.pesan} />
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

        <section
          aria-label="Sebaran belanja"
          className="rounded-xl border border-border bg-card p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Besar belanja
            </p>
            <p className="text-xs text-muted-foreground">
              {transaksi.length} struk
            </p>
          </div>

          {belanjaTertinggi === 0 ? (
            <div className="mt-5">
              <Tertahan pesan="Belum ada transaksi untuk dikelompokkan." />
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {belanja.map((k) => (
                <li key={k.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{k.label}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {k.jumlah} struk
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${tinggiBatang(k.jumlah, belanjaTertinggi)}%` }}
                    />
                  </div>
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

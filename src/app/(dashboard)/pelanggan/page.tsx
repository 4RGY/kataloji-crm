"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import {
  cocokCari,
  formatWhatsapp,
  normalisasiWhatsapp,
  validasiPelanggan,
} from "@/lib/pelanggan";
import {
  hitungPerLencana,
  hitungRingkasan,
  inisialPelanggan,
  kelompokkanPerPelanggan,
  lencanaPelanggan,
  ringkasHalaman,
  rupiahPenuh,
  rupiahRingkas,
  saringLencana,
  SARINGAN_PELANGGAN,
  tanggalIndonesia,
  tanggalSingkat,
  tanggalUltah,
  terakhirDatang,
  terjemahLedger,
  hangusTerdekat,
  warnaAvatar,
  type BarisLedger,
  type BarisTransaksi,
  type DataLencana,
  type JenisLencana,
  type WarnaAvatar,
} from "@/lib/pelanggan-tampilan";
import {
  CalendarDays,
  Clock3,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Star,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";
import { labelPencatat } from "@/lib/jejak-pencatat";

interface Pelanggan {
  id: string;
  nama: string;
  whatsapp: string;
  tgl_lahir: string | null;
  poin: number;
  created_at: string;
}

/** Baris transaksi dari Supabase, dengan kolom yang dipakai halaman ini. */
interface TransaksiRingkas extends BarisTransaksi {
  pelanggan_id: string | null;
}

const KOSONG = { nama: "", whatsapp: "", tgl_lahir: "" };

/** Warna lencana per jenis. Dijaga di satu tempat supaya tidak berpencar. */
const GAYA_LENCANA: Record<JenisLencana, string> = {
  aktif: "bg-[oklch(0.655_0.078_127.8_/_0.15)] text-[oklch(0.45_0.07_127.8)]",
  baru: "bg-primary/12 text-primary",
  sepi: "bg-foreground/8 text-muted-foreground",
  ultah: "bg-[oklch(0.833_0.146_103.5_/_0.2)] text-[oklch(0.5_0.1_103.5)]",
  belum: "bg-foreground/8 text-muted-foreground",
};

/** Warna avatar per pilihan stabil. */
const GAYA_AVATAR: Record<WarnaAvatar, string> = {
  terra: "bg-primary/14 text-primary",
  sage: "bg-[oklch(0.655_0.078_127.8_/_0.16)] text-[oklch(0.45_0.07_127.8)]",
  mustard: "bg-[oklch(0.833_0.146_103.5_/_0.22)] text-[oklch(0.5_0.1_103.5)]",
  espresso: "bg-foreground/10 text-foreground/70",
};

/** Satu pelanggan + ringkasan transaksinya, siap ditampilkan. */
interface BarisPelanggan extends Pelanggan {
  kunjungan: number;
  totalBelanja: number;
  rataRata: number;
  terakhirIso: string | null;
  riwayat: BarisTransaksi[];
}

export default function PelangganPage() {
  const supabase = createClient();

  const [daftar, setDaftar] = useState<BarisPelanggan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [terpotong, setTerpotong] = useState(false);
  const [query, setQuery] = useState("");

  // Pelanggan yang sedang dibuka panelnya, beserta isi buku besar poinnya.
  const [pilihId, setPilihId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<BarisLedger[]>([]);
  const [memuatLedger, setMemuatLedger] = useState(false);

  // Form tambah pelanggan
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [form, setForm] = useState(KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);

  // Ambil pelanggan + transaksinya. setState-nya hanya terjadi setelah await,
  // bukan sinkron di body effect, jadi tidak melanggar set-state-in-effect.
  // Flag `aktif` mencegah setState setelah komponen dilepas.
  const ambilDaftar = useCallback(async () => {
    // Wajib berhalaman: PostgREST memotong respons di 1000 baris tanpa
    // memberi error, jadi tanpa ini daftar pelanggan akan tampak lengkap
    // padahal sebagian tidak terkirim.
    //
    // Angka kunjungan, total belanja, dan kunjungan terakhir SENGAJA dihitung
    // dari tabel transaksi, bukan disimpan sebagai kolom sendiri. Kalau
    // disimpan, nilainya bisa melenceng dari transaksinya dan tidak ada yang
    // tahu mana yang benar.
    const [hasilPelanggan, hasilTransaksi] = await Promise.all([
      ambilSemua<Pelanggan>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, nama, whatsapp, tgl_lahir, poin, created_at")
          .order("nama", { ascending: true })
          .range(dari, sampai),
      ),
      ambilSemua<TransaksiRingkas>((dari, sampai) =>
        supabase
          .from("transaksi")
          .select("id, total, created_at, pelanggan_id, dicatat_oleh_nama, external_ref")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
    ]);

    if (hasilPelanggan.error) {
      return { data: [], error: hasilPelanggan.error, terpotong: false };
    }

    const peta = kelompokkanPerPelanggan(hasilTransaksi.data);
    // Kegagalan membaca transaksi TIDAK membuat halaman gagal total. Daftar
    // pelanggan tetap tampil, hanya angka kunjungannya kosong. Kalau keduanya
    // digabung jadi satu kegagalan, kasir kehilangan akses ke data yang
    // sebenarnya masih bisa dibaca.
    if (hasilTransaksi.error) catatGalat("baca transaksi pelanggan", hasilTransaksi.error);

    const data: BarisPelanggan[] = hasilPelanggan.data.map((p) => {
      const ringkas = hitungRingkasan(peta.get(p.id) ?? []);
      return {
        ...p,
        kunjungan: ringkas.kunjungan,
        totalBelanja: ringkas.totalBelanja,
        rataRata: ringkas.rataRata,
        terakhirIso: ringkas.terakhirIso,
        riwayat: ringkas.riwayat,
      };
    });

    return {
      data,
      error: null,
      terpotong: hasilPelanggan.terpotong || hasilTransaksi.terpotong,
    };
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const { data, error, terpotong: tp } = await ambilDaftar();
      if (!aktif) return;
      if (error) {
        setGalat("Gagal memuat daftar pelanggan. Coba muat ulang.");
        setDaftar([]);
      } else {
        setGalat(null);
        setDaftar(data);
      }
      setTerpotong(tp);
      setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambilDaftar]);

  async function muatUlang() {
    setMemuat(true);
    const { data, error, terpotong: tp } = await ambilDaftar();
    if (error) {
      setGalat("Gagal memuat daftar pelanggan. Coba muat ulang.");
      setDaftar([]);
    } else {
      setGalat(null);
      setDaftar(data);
    }
    setTerpotong(tp);
    setMemuat(false);
  }

  // Buku besar poin hanya diambil saat panel dibuka, bukan untuk seluruh
  // daftar. Kalau diambil sekaligus, satu halaman akan menarik ribuan baris
  // ledger yang belum tentu dilihat.
  useEffect(() => {
    if (!pilihId) return;
    let aktif = true;
    (async () => {
      // setState di dalam async IIFE, bukan sinkron di body effect: React
      // menolak setState sinkron di sini karena memicu render berantai.
      setMemuatLedger(true);
      const { data, error } = await supabase
        .from("point_ledger")
        .select("id, tipe, poin_masuk, poin_keluar, sisa, kedaluwarsa_pada, keterangan, created_at")
        .eq("pelanggan_id", pilihId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!aktif) return;
      if (error) {
        catatGalat("baca riwayat poin", error);
        setLedger([]);
      } else {
        setLedger((data ?? []) as unknown as BarisLedger[]);
      }
      setMemuatLedger(false);
    })();
    return () => {
      aktif = false;
    };
  }, [pilihId, supabase]);

  const hariIni = useMemo(() => new Date(), []);

  // Penyaring lencana. null berarti semua pelanggan ditampilkan.
  const [saringan, setSaringan] = useState<JenisLencana | null>(null);

  const jumlahLencana = useMemo(
    () => hitungPerLencana(daftar as DataLencana[], hariIni),
    [daftar, hariIni],
  );

  const hasil = useMemo(
    () =>
      saringLencana(daftar, saringan, hariIni).filter((p) =>
        cocokCari(p, query),
      ),
    [daftar, query, saringan, hariIni],
  );

  /** Kembalikan daftar ke keadaan utuh: hapus kata kunci dan penyaring. */
  function bersihkanPencarian() {
    setQuery("");
    setSaringan(null);
  }

  const kepala = useMemo(() => ringkasHalaman(daftar, hariIni), [daftar, hariIni]);

  const terpilih = useMemo(
    () => daftar.find((p) => p.id === pilihId) ?? null,
    [daftar, pilihId],
  );

  async function simpan(e: React.FormEvent) {
    e.preventDefault();

    const pesan = validasiPelanggan(form);
    if (pesan.length > 0) {
      toast.error(pesan[0]);
      return;
    }

    const nomor = normalisasiWhatsapp(form.whatsapp);
    setMenyimpan(true);

    // Satu nomor WhatsApp = satu pelanggan (BR-CUS).
    const { data: kembar } = await supabase
      .from("pelanggan")
      .select("id, nama")
      .eq("whatsapp", nomor)
      .limit(1);

    if (kembar && kembar.length > 0) {
      toast.error("Nomor WhatsApp sudah terdaftar.", {
        description: `Sudah tercatat atas nama ${kembar[0].nama}.`,
      });
      setMenyimpan(false);
      return;
    }

    const { error } = await supabase.from("pelanggan").insert({
      nama: form.nama.trim(),
      whatsapp: nomor,
      tgl_lahir: form.tgl_lahir,
    });

    if (error) {
      catatGalat("simpan pelanggan", error);
      toast.error(pesanGalat(error, "Gagal menyimpan pelanggan. Coba lagi."));
      setMenyimpan(false);
      return;
    }

    toast.success(`${form.nama.trim()} ditambahkan.`);
    setForm(KOSONG);
    setFormTerbuka(false);
    setMenyimpan(false);
    muatUlang();
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Pelanggan</h1>
        <p className="mt-1 text-sm text-muted-foreground">{kepala.teks}</p>
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
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          onClick={muatUlang}
          disabled={memuat}
          aria-label="Muat ulang daftar"
        >
          <RefreshCw className={memuat ? "animate-spin" : undefined} />
        </Button>
        <Button
          className="h-10 gap-2 font-semibold"
          onClick={() => setFormTerbuka(true)}
        >
          <UserPlus className="h-4 w-4" />
          Tambah pelanggan
        </Button>
      </div>

      {/*
        Penyaring lencana. Sebelum ini lencana hanya keterangan, sehingga
        pertanyaan seperti "siapa yang perlu disapa" harus dijawab dengan
        membaca seluruh daftar satu per satu. Angka pada tombol mencegah
        pengguna menekan penyaring yang ternyata kosong.
      */}
      {daftar.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Button
            variant={saringan === null ? "default" : "outline"}
            className="h-9 px-3.5 text-xs font-bold"
            onClick={() => setSaringan(null)}
            aria-pressed={saringan === null}
          >
            Semua
            <span className="ml-1.5 tabular-nums opacity-70">
              {daftar.length}
            </span>
          </Button>
          {SARINGAN_PELANGGAN.filter((s) => jumlahLencana[s.jenis] > 0).map(
            (s) => (
              <Button
                key={s.jenis}
                variant={saringan === s.jenis ? "default" : "outline"}
                className="h-9 px-3.5 text-xs font-bold"
                onClick={() =>
                  setSaringan(saringan === s.jenis ? null : s.jenis)
                }
                aria-pressed={saringan === s.jenis}
              >
                {s.label}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {jumlahLencana[s.jenis]}
                </span>
              </Button>
            ),
          )}
        </div>
      )}

      {/* Daftar + panel detail berdampingan mulai 1024px. Sebelumnya `xl`
          (1280px) bikin panel turun ke bawah di laptop biasa. Tabelnya
          masih dapat 640px, cukup untuk 5 kolom. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {/* Tabel pelanggan */}
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Header tabel */}
            <div className="hidden grid-cols-[minmax(0,2fr)_1.3fr_0.7fr_0.6fr_1fr] gap-4 border-b border-border bg-muted/40 px-6 py-3 lg:grid">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Pelanggan
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                WhatsApp
              </p>
              <p className="text-right text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Kunjungan
              </p>
              <p className="text-right text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Poin
              </p>
              <p className="text-right text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Terakhir datang
              </p>
            </div>

            {/* Isi */}
            {memuat ? (
              <div className="flex items-center justify-center gap-2 bg-card px-6 py-20">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Memuat daftar pelanggan…
                </p>
              </div>
            ) : galat ? (
              <div className="flex flex-col items-center justify-center gap-3 bg-card px-6 py-20 text-center">
                <p className="text-sm font-semibold text-foreground">{galat}</p>
                <Button variant="outline" size="sm" onClick={muatUlang}>
                  Coba lagi
                </Button>
              </div>
            ) : daftar.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 bg-card px-6 py-20 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Belum ada pelanggan tercatat
                </p>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Pelanggan baru otomatis masuk daftar ini setelah transaksi
                  pertama mereka dicatat, atau bisa ditambah manual lewat tombol
                  di atas.
                </p>
              </div>
            ) : hasil.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Tidak ada yang cocok
                </p>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {query
                    ? `Tidak ada pelanggan dengan kata kunci "${query}".`
                    : "Tidak ada pelanggan pada penyaring ini."}{" "}
                  Coba nama lain, beberapa digit nomor WhatsApp, atau daftarkan
                  sebagai pelanggan baru.
                </p>
                {/* Keadaan buntu sebelumnya tidak menyediakan satu pun tombol,
                    sehingga kasir harus menghapus ketikan sendiri. Situasi
                    tersering saat nama tidak ketemu justru adalah orangnya
                    memang pelanggan baru, jadi jalan pintas itu disediakan. */}
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10"
                    onClick={bersihkanPencarian}
                  >
                    Tampilkan semua
                  </Button>
                  <Button
                    className="h-10 gap-2 font-semibold"
                    onClick={() => {
                      // Kata kunci yang diketik dipakai sebagai nama awal
                      // kalau bukan angka, supaya kasir tidak mengetik ulang.
                      const angkaSaja = /^[\d\s+()-]+$/.test(query.trim());
                      setForm({
                        nama: angkaSaja ? "" : query.trim(),
                        whatsapp: angkaSaja ? query.trim() : "",
                        tgl_lahir: "",
                      });
                      setFormTerbuka(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Tambah sebagai pelanggan baru
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border bg-card">
                {hasil.map((p) => {
                  const lencana = lencanaPelanggan(p as DataLencana, hariIni);
                  const dipilih = p.id === pilihId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPilihId(dipilih ? null : p.id)}
                        aria-expanded={dipilih}
                        className={
                          "grid w-full grid-cols-1 gap-2 px-6 py-3 text-left transition-colors lg:grid-cols-[minmax(0,2fr)_1.3fr_0.7fr_0.6fr_1fr] lg:items-center lg:gap-4 " +
                          (dipilih ? "bg-primary/8" : "hover:bg-muted/40")
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold " +
                              GAYA_AVATAR[warnaAvatar(p.nama)]
                            }
                          >
                            {inisialPelanggan(p.nama)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {p.nama}
                            </p>
                            <span
                              className={
                                "mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold " +
                                GAYA_LENCANA[lencana.jenis]
                              }
                            >
                              {lencana.teks}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {formatWhatsapp(p.whatsapp)}
                        </p>
                        <p className="text-sm tabular-nums text-muted-foreground lg:text-right">
                          <span className="font-bold text-foreground lg:hidden">
                            Kunjungan:{" "}
                          </span>
                          {p.kunjungan}
                        </p>
                        <p className="text-sm font-bold tabular-nums text-primary lg:text-right">
                          {p.poin}
                        </p>
                        <p className="text-xs text-muted-foreground lg:text-right">
                          {terakhirDatang(p.terakhirIso, hariIni)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Keterangan jumlah */}
          {!memuat && !galat && (
            <p className="mt-3 text-xs text-muted-foreground">
              {query.trim()
                ? `Menampilkan ${hasil.length} dari ${daftar.length} pelanggan.`
                : `Total pelanggan: ${daftar.length}`}
            </p>
          )}

          {/* Kalau data mentok batas aman, katakan terus terang. Lebih baik
              staf tahu angkanya belum lengkap daripada mengira sudah semua. */}
          {terpotong && (
            <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
              Data belum tampil seluruhnya. Hubungi admin untuk memuat data
              secara bertahap.
            </p>
          )}
        </div>

        {/* Panel detail */}
        {terpilih && (
          <PanelDetail
            pelanggan={terpilih}
            ledger={ledger}
            memuatLedger={memuatLedger}
            hariIni={hariIni}
            onTutup={() => setPilihId(null)}
          />
        )}
      </div>

      {/* Form tambah pelanggan */}
      <Sheet open={formTerbuka} onOpenChange={setFormTerbuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Tambah pelanggan</SheetTitle>
            <SheetDescription>
              Tiga data ini yang standarnya ditanyakan kasir ke pelanggan.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={simpan} className="flex flex-1 flex-col gap-5 px-4">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama pelanggan</Label>
              <Input
                id="nama"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama panggilan juga boleh"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Nomor WhatsApp</Label>
              <Input
                id="whatsapp"
                inputMode="tel"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="0812 3456 789"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Boleh diketik 08 atau 62, nanti dirapikan otomatis.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tgl_lahir">Tanggal lahir</Label>
              <Input
                id="tgl_lahir"
                type="date"
                value={form.tgl_lahir}
                onChange={(e) =>
                  setForm({ ...form, tgl_lahir: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Dipakai untuk ucapan ulang tahun dan pembagian segmen.
              </p>
            </div>

            <SheetFooter className="px-0">
              <Button
                type="submit"
                className="h-11 w-full font-semibold"
                disabled={menyimpan}
              >
                {menyimpan ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Menyimpan…
                  </>
                ) : (
                  "Simpan pelanggan"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Panel detail satu pelanggan: poin, ringkasan belanja, riwayat kunjungan,
 * dan riwayat poin.
 *
 * Sengaja dipisah jadi komponen sendiri supaya halaman utamanya tidak jadi
 * satu berkas raksasa, dan supaya isi panel bisa dibaca terpisah dari
 * pengambilan datanya.
 */
function PanelDetail({
  pelanggan,
  ledger,
  memuatLedger,
  hariIni,
  onTutup,
}: {
  pelanggan: BarisPelanggan;
  ledger: BarisLedger[];
  memuatLedger: boolean;
  hariIni: Date;
  onTutup: () => void;
}) {
  const hangus = hangusTerdekat(ledger, hariIni);
  const ultah = tanggalUltah(pelanggan.tgl_lahir, hariIni);

  // Nomor WhatsApp untuk dibuka di aplikasi chat. Format penyimpanan sudah
  // 62xxx tanpa tanda, jadi langsung bisa dipakai.
  const nomorWa = normalisasiWhatsapp(pelanggan.whatsapp);

  return (
    <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-4 lg:w-[360px]">
      {/* Kepala panel */}
      <div className="flex items-start gap-3.5 border-b border-border/60 px-5 py-5">
        <span
          aria-hidden
          className={
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
            GAYA_AVATAR[warnaAvatar(pelanggan.nama)]
          }
        >
          {inisialPelanggan(pelanggan.nama)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold tracking-tight">
            {pelanggan.nama}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" aria-hidden />
            {formatWhatsapp(pelanggan.whatsapp)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lahir {tanggalIndonesia(pelanggan.tgl_lahir)}
            {ultah !== null && (
              <span className="ml-1.5 font-semibold text-primary">
                (ultah tanggal {ultah})
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup panel"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {/* Kartu poin */}
        <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-primary">
            Poin aktif
          </p>
          <p className="mt-1 text-3xl font-extrabold leading-none tracking-tight">
            {pelanggan.poin}
            <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
              poin
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Setara potongan tagihan {rupiahPenuh(pelanggan.poin * 1000)}.
            {hangus
              ? ` Sebagian poin hangus ${tanggalSingkat(hangus + "T00:00:00")} kalau tidak dipakai.`
              : " Tidak ada poin yang mendekati hangus."}
          </p>
        </div>

        {/* Ringkasan belanja */}
        <div>
          <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Ringkasan
          </p>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border/60">
            <div className="bg-card px-2 py-3 text-center">
              <p className="text-base font-extrabold tracking-tight">
                {pelanggan.kunjungan}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                kunjungan
              </p>
            </div>
            <div className="bg-card px-2 py-3 text-center">
              <p className="text-base font-extrabold tracking-tight">
                {rupiahRingkas(pelanggan.totalBelanja)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                total belanja
              </p>
            </div>
            <div className="bg-card px-2 py-3 text-center">
              <p className="text-base font-extrabold tracking-tight">
                {rupiahRingkas(pelanggan.rataRata)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                rata-rata
              </p>
            </div>
          </div>
        </div>

        {/* Riwayat kunjungan */}
        <div>
          <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Riwayat kunjungan
          </p>
          {pelanggan.riwayat.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Belum ada transaksi yang tercatat atas nama pelanggan ini.
            </p>
          ) : (
            <ul className="flex flex-col">
              {pelanggan.riwayat.slice(0, 8).map((t, i, arr) => (
                <li key={t.id} className="flex gap-3 pb-3.5 last:pb-0">
                  <div className="relative flex flex-col items-center">
                    <span
                      aria-hidden
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                    />
                    {i < arr.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute bottom-0 top-4 w-px bg-border"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
                      <span className="tabular-nums">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }).format(t.total)}
                      </span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                      {tanggalSingkat(t.created_at)}
                    </p>
                    {/* Jejak pencatat: siapa yang menginput transaksi ini.
                        Dilewatkan labelPencatat supaya penanda database
                        seperti "Sebelum fitur jejak pencatat" tidak tampil
                        mentah jadi kalimat aneh. */}
                    <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground/80">
                      {labelPencatat(t.dicatat_oleh_nama)}
                      {t.external_ref ? ` \u00b7 ${t.external_ref}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pelanggan.riwayat.length > 8 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Menampilkan 8 dari {pelanggan.riwayat.length} kunjungan.
            </p>
          )}
        </div>

        {/* Riwayat poin */}
        <div>
          <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <Star className="h-3 w-3" aria-hidden />
            Riwayat poin
          </p>
          {memuatLedger ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Memuat riwayat poin…
            </p>
          ) : ledger.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Belum ada pergerakan poin untuk pelanggan ini.
            </p>
          ) : (
            <ul className="flex flex-col">
              {ledger.slice(0, 8).map((b, i, arr) => {
                const t = terjemahLedger(b);
                return (
                  <li key={b.id} className="flex gap-3 pb-3.5 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <span
                        aria-hidden
                        className={
                          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full " +
                          (t.masuk ? "bg-[oklch(0.655_0.078_127.8)]" : "bg-primary")
                        }
                      />
                      {i < arr.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute bottom-0 top-4 w-px bg-border"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
                        {t.judul}
                        <span className="tabular-nums">{t.jumlah}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t.keterangan}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                        <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                        {t.waktu}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Aksi */}
      <div className="mt-auto flex flex-col gap-2 border-t border-border/60 px-5 py-4">
        <Button asChild className="h-10 w-full gap-2 font-semibold">
          <a
            href={`https://wa.me/${nomorWa}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4" />
            Chat WhatsApp
          </a>
        </Button>
        <Button variant="outline" asChild className="h-10 w-full font-semibold">
          <a href={`/transaksi`}>Catat kunjungan baru</a>
        </Button>
      </div>
    </aside>
  );
}

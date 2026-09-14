"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import {
  hitungPoinTransaksi,
  maxPoinDipakai,
  MIN_REDEEM,
  POIN_PER_RUPIAH,
  NILAI_POIN,
} from "@/lib/poin";
import { formatWhatsapp, normalisasiWhatsapp, validasiPelanggan } from "@/lib/pelanggan";
import {
  Loader2,
  ReceiptText,
  Search,
  UserCheck,
  UserPlus,
  UserRound,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";
import { bukanNamaOrang, labelPencatat } from "@/lib/jejak-pencatat";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/**
 * Tombol nominal cepat. Kasir membaca angka bulat dari struk majoo,
 * jadi satu ketukan lebih cepat daripada mengetik nol berulang.
 * "000" dipakai untuk menyambung: ketik 45 lalu 000 -> 45.000.
 */
const NOMINAL_CEPAT = [10000, 20000, 25000, 50000, 100000];

/**
 * "47000" / "47 000" / "Rp 47.000" -> 47000.
 * Semua karakter selain angka dibuang, jadi pemisah apa pun (titik,
 * spasi, spasi tak-putus) tidak berpengaruh.
 */
function angkaDari(teks: string): number {
  const digit = (teks || "").replace(/\D/g, "");
  return digit ? parseInt(digit, 10) : 0;
}

/**
 * 47000 -> "47 000" untuk ditampilkan di input.
 *
 * Sengaja memakai pemisah SPASI, bukan titik. Format Indonesia menulis
 * ribuan dengan titik ("47.000"), tetapi titik juga berarti desimal di
 * sistem lain. Akibatnya angka yang sedang diketik gampang salah dibaca
 * (baik oleh manusia maupun alat lain) sebagai 47 koma nol.
 * Spasi tidak dipakai sebagai pemisah desimal di mana pun, jadi aman.
 */
function ribuan(n: number): string {
  if (!n) return "";
  return n.toLocaleString("id-ID").replace(/\./g, "\u00a0");
}

interface Pelanggan {
  id: string;
  nama: string;
  whatsapp: string;
  tgl_lahir: string | null;
  poin: number;
}

interface Transaksi {
  id: string;
  total: number;
  diskon: number;
  poin_dipakai: number;
  poin_didapat: number;
  external_ref: string | null;
  created_at: string;
  pelanggan: { nama: string } | null;
  // Jejak pencatat, diisi otomatis oleh database dari sesi yang menyimpan.
  dicatat_oleh: string | null;
  dicatat_oleh_nama: string | null;
}

/** 2026-09-14T11:26 -> "14 Sep, 18.26" */
function waktuRingkas(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(".", ":");
}

export default function TransaksiPage() {
  const supabase = createClient();

  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null);
  const [cariTerbuka, setCariTerbuka] = useState(false);
  const [kandidat, setKandidat] = useState<Pelanggan[]>([]);
  const [kataKunci, setKataKunci] = useState("");
  const [mencari, setMencari] = useState(false);

  const [total, setTotal] = useState(0);
  const [diskon, setDiskon] = useState(0);
  const [poinDipakai, setPoinDipakai] = useState(0);
  const [struk, setStruk] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const [pelangganBaruTerbuka, setPelangganBaruTerbuka] = useState(false);
  const [formBaru, setFormBaru] = useState({ nama: "", whatsapp: "", tgl_lahir: "" });
  const [menyimpanBaru, setMenyimpanBaru] = useState(false);

  // Daftar transaksi terakhir. Tanpa ini kasir tidak punya bukti bahwa
  // transaksinya tersimpan, sehingga terasa seperti "tidak jalan".
  const [riwayat, setRiwayat] = useState<Transaksi[]>([]);
  const [memuatRiwayat, setMemuatRiwayat] = useState(true);
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(true);

  const inputTotal = useRef<HTMLInputElement>(null);

  // ---- hitungan langsung, tanpa tombol "hitung" ----
  const hitung = useMemo(
    () =>
      hitungPoinTransaksi({
        total,
        diskon,
        poin_dipakai: poinDipakai,
        poin_tersedia: pelanggan?.poin ?? 0,
      }),
    [total, diskon, poinDipakai, pelanggan],
  );

  const maksPoin = maxPoinDipakai(total, diskon);

  // ---- riwayat transaksi ----
  const ambilRiwayat = useCallback(async () => {
    const { data, error } = await supabase
      .from("transaksi")
      .select(
        "id, total, diskon, poin_dipakai, poin_didapat, external_ref, created_at, dicatat_oleh, dicatat_oleh_nama, pelanggan(nama)",
      )
      .order("created_at", { ascending: false })
      .limit(10);
    return { data: (data ?? []) as unknown as Transaksi[], error };
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const { data } = await ambilRiwayat();
      if (!aktif) return;
      setRiwayat(data);
      setMemuatRiwayat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambilRiwayat]);

  async function segarkanRiwayat() {
    const { data } = await ambilRiwayat();
    setRiwayat(data);
    setMemuatRiwayat(false);
  }

  // ---- cari pelanggan ----
  const cariPelanggan = useCallback(
    async (kata: string) => {
      setMencari(true);
      const angka = kata.replace(/\D/g, "");
      let q = supabase.from("pelanggan").select("id,nama,whatsapp,tgl_lahir,poin").limit(8);

      if (angka.length >= 3) {
        q = q.ilike("whatsapp", `%${angka}%`);
      } else if (kata.trim()) {
        q = q.ilike("nama", `%${kata.trim()}%`);
      } else {
        q = q.order("nama", { ascending: true });
      }

      const { data, error } = await q;
      setKandidat(error ? [] : ((data ?? []) as Pelanggan[]));
      setMencari(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (!cariTerbuka) return;
    let aktif = true;
    const timer = setTimeout(async () => {
      await cariPelanggan(kataKunci);
      if (!aktif) return;
    }, 250);
    return () => {
      aktif = false;
      clearTimeout(timer);
    };
  }, [cariTerbuka, kataKunci, cariPelanggan]);

  function pilihPelanggan(p: Pelanggan) {
    setPelanggan(p);
    setCariTerbuka(false);
    setKataKunci("");
    setPoinDipakai(0);
    setTimeout(() => inputTotal.current?.focus(), 120);
  }

  function lepasPelanggan() {
    setPelanggan(null);
    setPoinDipakai(0);
  }

  function resetForm() {
    setTotal(0);
    setDiskon(0);
    setPoinDipakai(0);
    setStruk("");
    setPelanggan(null);
    inputTotal.current?.focus();
  }

  async function simpanTransaksi() {
    if (total <= 0) {
      toast.error("Total tagihan belum diisi.");
      return;
    }
    if (diskon > total) {
      toast.error("Diskon melebihi total tagihan.");
      return;
    }
    if (hitung.errors.length > 0) {
      toast.error(hitung.errors[0]);
      return;
    }

    setMenyimpan(true);

    const { error } = await supabase.from("transaksi").insert({
      pelanggan_id: pelanggan?.id ?? null,
      total,
      diskon,
      poin_dipakai: poinDipakai,
      poin_didapat: hitung.poin_didapat,
      external_ref: struk.trim() || null,
      source: "majoo_parallel",
      items: [],
    });

    if (error) {
      catatGalat("simpan transaksi", error);
      toast.error(pesanGalat(error, "Gagal menyimpan transaksi. Coba lagi."));
      setMenyimpan(false);
      return;
    }

    toast.success(
      pelanggan
        ? `Tersimpan. ${pelanggan.nama} dapat ${hitung.poin_didapat} poin.`
        : "Transaksi tersimpan.",
      {
        description: `${rupiah.format(total)} · tercatat di daftar transaksi`,
      },
    );

    resetForm();
    setMenyimpan(false);
    segarkanRiwayat();
  }

  async function simpanPelangganBaru(e: React.FormEvent) {
    e.preventDefault();
    const pesan = validasiPelanggan(formBaru);
    if (pesan.length > 0) {
      toast.error(pesan[0]);
      return;
    }

    const nomor = normalisasiWhatsapp(formBaru.whatsapp);
    setMenyimpanBaru(true);

    const { data: kembar } = await supabase
      .from("pelanggan")
      .select("id,nama,whatsapp,tgl_lahir,poin")
      .eq("whatsapp", nomor)
      .limit(1);

    if (kembar && kembar.length > 0) {
      // Sudah terdaftar: langsung pakai, kasir tidak perlu ketik ulang.
      toast.info(`Sudah terdaftar sebagai ${kembar[0].nama}, langsung dipakai.`);
      setPelangganBaruTerbuka(false);
      setFormBaru({ nama: "", whatsapp: "", tgl_lahir: "" });
      setMenyimpanBaru(false);
      pilihPelanggan(kembar[0] as Pelanggan);
      return;
    }

    const { data, error } = await supabase
      .from("pelanggan")
      .insert({
        nama: formBaru.nama.trim(),
        whatsapp: nomor,
        tgl_lahir: formBaru.tgl_lahir,
      })
      .select("id,nama,whatsapp,tgl_lahir,poin")
      .single();

    if (error || !data) {
      catatGalat("simpan pelanggan baru", error);
      toast.error(
        pesanGalat(error, "Data pelanggan tidak kembali dari server. Coba lagi."),
      );
      setMenyimpanBaru(false);
      return;
    }

    toast.success(`${formBaru.nama.trim()} terdaftar.`);
    setPelangganBaruTerbuka(false);
    setFormBaru({ nama: "", whatsapp: "", tgl_lahir: "" });
    setMenyimpanBaru(false);
    pilihPelanggan(data as Pelanggan);
  }

  /**
   * Tombol "000": menyambung tiga nol ke angka yang sudah diketik.
   * 45 -> 45.000. Dipakai karena kasir membaca angka bulat dari struk.
   *
   * Sengaja menyambung DIGIT, bukan menambah angka. Versi sebelumnya
   * menambahkan bilangan 0 sehingga 45 menjadi 450 (bukan 45.000).
   */
  function sambungTigaNol() {
    setTotal((t) => angkaDari(String(t) + "000"));
  }

  return (
    <div className="grid gap-6 px-6 pb-10 pt-4 lg:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* ============ KOLOM KIRI: input transaksi ============ */}
      <div className="min-w-0">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Transaksi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catat transaksi dari struk majoo. Cukup total dan pelanggan, sisanya
            opsional.
          </p>
        </header>

        {/* Pelanggan */}
        <section className="mb-5">
          <Label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Pelanggan
          </Label>

          {pelanggan ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <UserCheck className="h-4 w-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{pelanggan.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhatsapp(pelanggan.whatsapp)}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="font-semibold tabular-nums">
                {pelanggan.poin} poin
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={lepasPelanggan}
                aria-label="Lepas pelanggan"
              >
                <X />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 gap-2 font-semibold sm:flex-none"
                onClick={() => setCariTerbuka(true)}
              >
                <Search className="h-4 w-4" />
                Cari pelanggan
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 gap-2 font-semibold sm:flex-none"
                onClick={() => setPelangganBaruTerbuka(true)}
              >
                <UserPlus className="h-4 w-4" />
                Pelanggan baru
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Boleh dikosongkan kalau pelanggan tidak mau memberi data.
              </p>
            </div>
          )}
        </section>

        {/* Total + keypad cepat */}
        <section className="mb-5">
          <Label htmlFor="total">Total tagihan</Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              Rp
            </span>
            <Input
              id="total"
              ref={inputTotal}
              inputMode="numeric"
              value={ribuan(total)}
              onChange={(e) => setTotal(angkaDari(e.target.value))}
              placeholder="0"
              className="h-14 pl-10 text-2xl font-extrabold tabular-nums"
              autoComplete="off"
            />
          </div>

          {/* Nominal cepat: satu ketukan, tanpa mengetik nol berulang */}
          <div className="mt-2 flex flex-wrap gap-2">
            {NOMINAL_CEPAT.map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                className="font-semibold tabular-nums"
                onClick={() => setTotal((t) => t + n)}
              >
                +{n / 1000}rb
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-semibold tabular-nums"
              onClick={sambungTigaNol}
              title="Menyambung angka: 45 lalu 000 menjadi 45.000"
            >
              +000
            </Button>
            {total > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTotal(0)}
              >
                Nolkan
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ketik dari struk, atau ketuk tombol cepat. Tombol +000 dipakai
            menyambung angka, misalnya 45 lalu +000 menjadi 45.000.
          </p>
        </section>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Diskon */}
          <section>
            <Label htmlFor="diskon">Diskon promo (opsional)</Label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                Rp
              </span>
              <Input
                id="diskon"
                inputMode="numeric"
                value={ribuan(diskon)}
                onChange={(e) => setDiskon(angkaDari(e.target.value))}
                placeholder="0"
                className="h-12 pl-10 text-lg font-bold tabular-nums"
                autoComplete="off"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Diskon dari majoo. Mengurangi poin yang didapat.
            </p>
          </section>

          {/* No. struk */}
          <section>
            <Label htmlFor="struk">Nomor struk majoo (opsional)</Label>
            <Input
              id="struk"
              value={struk}
              onChange={(e) => setStruk(e.target.value)}
              placeholder="Kosongkan kalau tidak dicatat"
              className="mt-2 h-12"
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Berguna untuk mencocokkan kalau ada selisih dengan majoo.
            </p>
          </section>
        </div>

        {/* Poin dipakai */}
        {pelanggan && (
          <section className="mt-5">
            <Label htmlFor="poin">Pakai poin (opsional)</Label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                id="poin"
                inputMode="numeric"
                value={poinDipakai ? String(poinDipakai) : ""}
                onChange={(e) => setPoinDipakai(angkaDari(e.target.value))}
                placeholder="0"
                className="h-12 max-w-32 text-lg font-bold tabular-nums"
                autoComplete="off"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPoinDipakai(Math.min(maksPoin, pelanggan.poin))}
                  disabled={maksPoin === 0 || pelanggan.poin === 0}
                >
                  Maks ({Math.min(maksPoin, pelanggan.poin)})
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPoinDipakai(0)}
                  disabled={poinDipakai === 0}
                >
                  Nolkan
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Saldo {pelanggan.poin} poin. Minimum tukar {MIN_REDEEM} poin, 1 poin
              senilai {rupiah.format(NILAI_POIN)}. Maksimal {maksPoin} poin untuk
              tagihan ini.
            </p>
          </section>
        )}
      </div>

      {/* ============ KOLOM KANAN: ringkasan + riwayat ============ */}
      <div className="space-y-5">
        {/* Ringkasan: menempel saat digulir supaya kasir selalu lihat total */}
        <section className="rounded-xl border border-border bg-card p-5 xl:sticky xl:top-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Ringkasan
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total tagihan</dt>
              <dd className="font-semibold tabular-nums">{rupiah.format(total)}</dd>
            </div>
            {diskon > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Diskon promo</dt>
                <dd className="font-semibold tabular-nums text-muted-foreground">
                  {rupiah.format(-diskon)}
                </dd>
              </div>
            )}
            {poinDipakai > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  Potongan {poinDipakai} poin
                </dt>
                <dd className="font-semibold tabular-nums text-muted-foreground">
                  {rupiah.format(-hitung.potongan)}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-2">
              <dt className="font-bold">Dibayar</dt>
              <dd className="text-2xl font-extrabold tabular-nums">
                {rupiah.format(hitung.net_total)}
              </dd>
            </div>
            {pelanggan && (
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Poin didapat</dt>
                <dd className="font-bold tabular-nums text-primary">
                  +{hitung.poin_didapat}
                </dd>
              </div>
            )}
          </dl>

          {pelanggan && hitung.poin_didapat > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              Poin dihitung dari tagihan setelah diskon, sebelum potongan poin
              (1 poin per {rupiah.format(POIN_PER_RUPIAH)}).
            </p>
          )}

          <Button
            className="mt-5 h-12 w-full gap-2 text-base font-bold"
            onClick={simpanTransaksi}
            disabled={menyimpan || total <= 0}
          >
            {menyimpan ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Menyimpan…
              </>
            ) : (
              <>
                <ReceiptText className="h-5 w-5" />
                Simpan transaksi
              </>
            )}
          </Button>
        </section>

        {/* Riwayat: bukti transaksi benar-benar tercatat */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setRiwayatTerbuka((v) => !v)}
            aria-expanded={riwayatTerbuka}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Transaksi terakhir
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                riwayatTerbuka ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {riwayatTerbuka && (
            <div className="border-t border-border">
              {memuatRiwayat ? (
                <div className="flex items-center justify-center gap-2 px-5 py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Memuat…</p>
                </div>
              ) : riwayat.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Belum ada transaksi tercatat.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {riwayat.map((t) => (
                    <li key={t.id} className="px-5 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-bold tabular-nums">
                          {rupiah.format(t.total)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {waktuRingkas(t.created_at)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {t.pelanggan?.nama ?? "Tanpa pelanggan"}
                          {t.external_ref ? ` · ${t.external_ref}` : ""}
                        </p>
                        {t.poin_didapat > 0 && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px] tabular-nums"
                          >
                            +{t.poin_didapat} poin
                          </Badge>
                        )}
                      </div>
                      {/* Jejak pencatat: jawaban untuk "ini siapa yang input". */}
                      <div className="mt-1.5 flex items-center gap-1.5 border-t border-border/60 pt-1.5">
                        <UserRound
                          className={`h-3 w-3 shrink-0 ${
                            bukanNamaOrang(t.dicatat_oleh_nama)
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground"
                          }`}
                          aria-hidden
                        />
                        <p
                          className={`truncate text-[11px] ${
                            bukanNamaOrang(t.dicatat_oleh_nama)
                              ? "text-muted-foreground/70 italic"
                              : "font-medium text-muted-foreground"
                          }`}
                        >
                          {labelPencatat(t.dicatat_oleh_nama)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Sheet cari pelanggan */}
      <Sheet open={cariTerbuka} onOpenChange={setCariTerbuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Cari pelanggan</SheetTitle>
            <SheetDescription>
              Ketik nama, atau beberapa digit nomor WhatsApp.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <Input
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              placeholder="Nama atau 3 digit akhir nomor"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {mencari ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Mencari…</p>
              </div>
            ) : kandidat.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold">Tidak ditemukan</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Pakai tombol Pelanggan baru kalau ini pelanggan baru.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {kandidat.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => pilihPelanggan(p)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {p.nama}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatWhatsapp(p.whatsapp)}
                        </span>
                      </span>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {p.poin} poin
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet pelanggan baru */}
      <Sheet open={pelangganBaruTerbuka} onOpenChange={setPelangganBaruTerbuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Pelanggan baru</SheetTitle>
            <SheetDescription>
              Tiga data ini yang standarnya ditanyakan kasir.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={simpanPelangganBaru} className="flex flex-1 flex-col gap-5 px-4">
            <div className="space-y-2">
              <Label htmlFor="baru-nama">Nama pelanggan</Label>
              <Input
                id="baru-nama"
                value={formBaru.nama}
                onChange={(e) => setFormBaru({ ...formBaru, nama: e.target.value })}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baru-wa">Nomor WhatsApp</Label>
              <Input
                id="baru-wa"
                inputMode="tel"
                value={formBaru.whatsapp}
                onChange={(e) => setFormBaru({ ...formBaru, whatsapp: e.target.value })}
                placeholder="0812 3456 789"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Boleh diketik 08 atau 62, nanti dirapikan otomatis.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="baru-lahir">Tanggal lahir</Label>
              <Input
                id="baru-lahir"
                type="date"
                value={formBaru.tgl_lahir}
                onChange={(e) => setFormBaru({ ...formBaru, tgl_lahir: e.target.value })}
              />
            </div>
            <SheetFooter className="px-0">
              <Button type="submit" className="h-11 w-full font-semibold" disabled={menyimpanBaru}>
                {menyimpanBaru ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Menyimpan…
                  </>
                ) : (
                  "Simpan dan pakai"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

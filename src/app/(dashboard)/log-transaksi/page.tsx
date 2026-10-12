"use client";

// ============================================================
// Halaman Log Transaksi, Kataloji CRM
// ============================================================
// Log seluruh transaksi, paling baru di depan, dengan rincian yang
// lebih dalam daripada panel "Transaksi terakhir" di halaman Transaksi.
//
// Menampilkan per baris: kapan, nomor struk, total, diskon, poin,
// pelanggan, sumber (manual / impor Majoo / paralel / CSV), status
// pencocokan, cara bayar, dan siapa yang mencatat. Tombol "Detail"
// membuka lembaran berisi baris lengkap + rincian item + jejak poin
// di buku poin.
//
// Filter: teks bebas, sumber, status pencocokan, dan rentang tanggal
// Majoo. Semua filter dikirim ke /api/log-transaksi (guard admin di
// server), halaman hanya menampilkan.
//
// Tersembunyi dari non-admin (menu + guard tampilan). Halaman ini
// hanya informatif; tidak ada aksi penwritan data di sini.
// ============================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Loader2,
  ScrollText,
  Search,
  ShieldOff,
  X,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { NILAI_POIN } from "@/lib/poin";
import { hitungPoinDiberikan } from "@/lib/dashboard-tampilan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface BarisLog {
  id: string;
  pelanggan_id: string | null;
  total: number;
  diskon: number;
  poin_dipakai: number;
  poin_didapat: number;
  items: { nama: string; qty: number }[];
  external_ref: string | null;
  created_at: string;
  source: string | null;
  dicatat_oleh: string | null;
  dicatat_oleh_nama: string | null;
  dicatat_pada: string | null;
  metode_bayar: string | null;
  kode_pelanggan_majoo: string | null;
  nama_pelanggan_majoo: string | null;
  status_pencocokan: string | null;
  tanggal_majoo: string | null;
  pelanggan: {
    id: string;
    nama: string;
    whatsapp: string;
    kode_majoo: string | null;
    poin: number;
  } | null;
}

interface BarisLedger {
  tipe: string;
  poin_masuk: number;
  poin_keluar: number;
  sisa: number;
  kedaluwarsa_pada: string | null;
  keterangan: string | null;
  created_at: string;
}

interface DetailLog {
  transaksi: BarisLog;
  ledger: BarisLedger[];
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const SUMBER_LABEL: Record<string, string> = {
  crm_manual: "CRM manual",
  majoo_import: "Impor Majoo",
  majoo_parallel: "Paralel Majoo",
  csv_import: "CSV",
};

const STATUS_LABEL: Record<string, string> = {
  terhubung: "Terhubung",
  menunggu_pencocokan: "Menunggu",
  anonim: "Anonim",
};

const TIPE_LEDGER_LABEL: Record<string, string> = {
  earn: "Dapat",
  redeem: "Tukar",
  expire: "Hangus",
  adjust: "Koreksi",
};

/**
 * Omzet bersih satu transaksi: uang yang benar-benar masuk = total
 * dikurangi diskon promo dan potongan poin, tak boleh di bawah nol.
 * Rumus sama dengan dashboard supaya angka per baris, ringkasan, dan
 * halaman lain saling cocok.
 */
function omzetBersih(t: {
  total: number;
  diskon: number;
  poin_dipakai: number;
}): number {
  return Math.max(0, t.total - t.diskon - t.poin_dipakai * NILAI_POIN);
}

function waktuPenuh(iso: string | null): string {
  if (!iso) return "Tidak tercatat";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(".", ":");
}

function tanggalMajoo(iso: string | null): string {
  if (!iso) return "Tidak ada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function HalamanLogTransaksi() {
  const supabase = useMemo(() => createClient(), []);

  const [peran, setPeran] = useState<string | null>(null);
  const [daftar, setDaftar] = useState<BarisLog[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [terpotong, setTerpotong] = useState(false);

  const [cari, setCari] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");

  const [detail, setDetail] = useState<DetailLog | null>(null);
  const [detailTerbuka, setDetailTerbuka] = useState(false);
  const [memuatDetail, setMemuatDetail] = useState(false);

  // Guard: non-admin tidak diberi data sama sekali.
  const ambilPeran = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPeran(null);
      return;
    }
    const { data: profil } = await supabase
      .from("profile")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    setPeran((profil?.role as string) ?? null);
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const hasil = await ambilPeran();
      if (aktif) void hasil;
    })();
    return () => {
      aktif = false;
    };
  }, [ambilPeran]);

  const ambilLog = useCallback(async () => {
    if (peran !== "admin") {
      setMemuat(false);
      return;
    }
    const qs = new URLSearchParams();
    if (cari.trim()) qs.set("cari", cari.trim());
    if (source) qs.set("source", source);
    if (status) qs.set("status", status);
    if (dari) qs.set("dari", dari);
    if (sampai) qs.set("sampai", sampai);
    const res = await fetch(`/api/log-transaksi?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      toast.error(json?.error ?? "Gagal memuat log transaksi.");
      setMemuat(false);
      return;
    }
    const data = (await res.json()) as {
      transaksi: BarisLog[];
      total: number;
      terpotong: boolean;
    };
    setDaftar(data.transaksi ?? []);
    setTerpotong(Boolean(data.terpotong));
    setMemuat(false);
  }, [peran, cari, source, status, dari, sampai]);

  useEffect(() => {
    let aktif = true;
    // Tulis bebas teks butuh jeda kecil agar tidak menembak API setiap ketikan.
    const timer = setTimeout(() => {
      void (async () => {
        await ambilLog();
        if (!aktif) return;
      })();
    }, 250);
    return () => {
      aktif = false;
      clearTimeout(timer);
    };
  }, [ambilLog]);

  async function bukaDetail(baris: BarisLog) {
    setDetailTerbuka(true);
    setDetail(null);
    setMemuatDetail(true);
    const res = await fetch(`/api/log-transaksi?detail=${baris.id}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      toast.error(json?.error ?? "Gagal membuka detail transaksi.");
      setMemuatDetail(false);
      return;
    }
    const data = (await res.json()) as DetailLog;
    setDetail(data);
    setMemuatDetail(false);
  }

  function resetFilter() {
    setCari("");
    setSource("");
    setStatus("");
    setDari("");
    setSampai("");
  }

  // Ringkasan ringan dari baris yang sedang terfilter.
  // Pakai rumus yang sama dengan dashboard supaya angka omzet dan poin
  // tidak nyimpang antar-halaman. Omzet bersih = uang yang benar-benar
  // masuk (total minus diskon promo dan potongan poin); poin terbit hanya
  // dihitung untuk transaksi yang punya pelanggan (yang memang masuk buku
  // poin), bukan penjumlahan mentah kolom poin_didapat.
  const ringkasan = useMemo(() => {
    const omzet = daftar.reduce(
      (n, t) => n + Math.max(0, t.total - t.diskon - t.poin_dipakai * NILAI_POIN),
      0,
    );
    const poin = hitungPoinDiberikan(daftar);
    return { omzet, poin, jumlah: daftar.length };
  }, [daftar]);

  // Berapa filter yang sedang menyala. Dipakai untuk memutuskan apakah baris
  // "Reset" dan chip filter aktif perlu muncul, supaya tabel yang sedikit
  // tidak tertukar dengan tabel yang tersaring.
  const jumlahFilter = [cari, source, status, dari, sampai].filter(
    (v) => v.trim() !== "",
  ).length;

  if (peran !== null && peran !== "admin") {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldOff className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-bold text-foreground">
            Halaman ini hanya untuk admin
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Log transaksi lengkap hanya bisa dilihat admin. Hubungi admin
            kalau ada transaksi yang perlu ditelusuri.
          </p>
        </div>
      </div>
    );
  }

  if (memuat) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-24">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Memuat log...</p>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Log Transaksi
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Riwayat seluruh transaksi beserta sumber, poin, dan pencatatnya.
          </p>
        </div>
        {/* Ringkasan ikut header supaya angka yang dibaca selalu
            berdampingan dengan baris yang sedang tersaring, bukan
            menggantung di baris sendiri di bawah filter. */}
        <div className="flex flex-wrap items-center gap-2">
          <ChipRingkas label="Transaksi" nilai={String(ringkasan.jumlah)} />
          <ChipRingkas
            label="Omzet"
            nilai={rupiah.format(ringkasan.omzet)}
          />
          <ChipRingkas label="Poin terbit" nilai={String(ringkasan.poin)} aksen />
        </div>
      </header>

      {/* Bar filter: satu baris, semua kontrol tinggi dan sejajar.
          Sebelumnya kotak pencarian tidak punya label sehingga duduk 21px
          lebih tinggi daripada empat kontrol lain, dan tingginya 44px
          sedangkan select 36px. */}
      <div className="mb-3 rounded-xl border border-border bg-card p-3">
        <div className="grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_1fr_auto]">
          <div>
            <Label className="mb-1 block h-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              Cari
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Struk, kode, atau nama"
                className="h-9 pl-9"
                aria-label="Cari transaksi"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block h-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              Sumber
            </Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Filter sumber"
            >
              <option value="">Semua sumber</option>
              {Object.entries(SUMBER_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block h-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              Pencocokan
            </Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Filter status pencocokan"
            >
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block h-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              Dari
            </Label>
            <Input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
              className="h-9"
              aria-label="Tanggal awal"
            />
          </div>
          <div>
            <Label className="mb-1 block h-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              Sampai
            </Label>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              className="h-9"
              aria-label="Tanggal akhir"
            />
          </div>
          {/* Reset duduk di dalam baris filter, hanya muncul saat ada yang
              perlu direset, supaya tidak jadi baris kosong tersendiri. */}
          <div className="flex h-9 items-center">
            {jumlahFilter > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilter}
                className="w-full lg:w-auto"
              >
                <X />
                Reset
              </Button>
            ) : (
              <span className="hidden text-[11px] text-muted-foreground lg:block">
                Tanpa filter
              </span>
            )}
          </div>
        </div>

        {/* Filter aktif ditampilkan sebagai chip yang bisa dicabut satu-satu.
            Tanpa ini, daftar yang sedikit sulit dibedakan dari data yang
            memang cuma sedikit. */}
        {jumlahFilter > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filter aktif
            </span>
            {cari.trim() && (
              <ChipAktif label={`Cari: ${cari.trim()}`} onHapus={() => setCari("")} />
            )}
            {source && (
              <ChipAktif
                label={`Sumber: ${SUMBER_LABEL[source] ?? source}`}
                onHapus={() => setSource("")}
              />
            )}
            {status && (
              <ChipAktif
                label={`Pencocokan: ${STATUS_LABEL[status] ?? status}`}
                onHapus={() => setStatus("")}
              />
            )}
            {dari && (
              <ChipAktif
                label={`Dari: ${tanggalMajoo(dari)}`}
                onHapus={() => setDari("")}
              />
            )}
            {sampai && (
              <ChipAktif
                label={`Sampai: ${tanggalMajoo(sampai)}`}
                onHapus={() => setSampai("")}
              />
            )}
          </div>
        )}
      </div>

      {terpotong && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
          Data terpotong pada 20.000 baris. Persempit filter untuk melihat
          semuanya.
        </div>
      )}

      {daftar.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <ReceiptText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">Tidak ada transaksi</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Belum ada baris yang cocok dengan filter ini. Longgarkan filter
            atau pastikan sudah ada transaksi tercatat.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Waktu</th>
                <th className="px-4 py-2.5 font-semibold">No. struk</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Total
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Poin
                </th>
                <th className="px-4 py-2.5 font-semibold">Pelanggan</th>
                <th className="px-4 py-2.5 font-semibold">Sumber</th>
                <th className="px-4 py-2.5 font-semibold">Cocok</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {daftar.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => void bukaDetail(t)}
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium tabular-nums">
                      {waktuPenuh(t.dicatat_pada ?? t.created_at)}
                    </p>
                    {t.tanggal_majoo && (
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        laporan {tanggalMajoo(t.tanggal_majoo)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top tabular-nums">
                    {t.external_ref ?? "Belum ada"}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <p className="font-semibold tabular-nums">
                      {rupiah.format(omzetBersih(t))}
                    </p>
                    {t.diskon > 0 && (
                      <p className="text-xs text-muted-foreground">
                        diskon {rupiah.format(t.diskon)}
                      </p>
                    )}
                    {t.poin_dipakai > 0 && (
                      <p className="text-xs text-muted-foreground">
                        poin {rupiah.format(t.poin_dipakai * NILAI_POIN)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    {t.poin_didapat > 0 ? (
                      <span className="font-semibold tabular-nums text-primary">
                        +{t.poin_didapat}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {t.pelanggan ? (
                      <div className="flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{t.pelanggan.nama}</p>
                          {t.pelanggan.kode_majoo && (
                            <p className="text-xs text-muted-foreground">
                              {t.pelanggan.kode_majoo}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : t.kode_pelanggan_majoo || t.nama_pelanggan_majoo ? (
                      <div>
                        <p className="font-medium">
                          {t.nama_pelanggan_majoo ?? "Tanpa nama"}
                        </p>
                        {t.kode_pelanggan_majoo && (
                          <p className="text-xs text-muted-foreground">
                            {t.kode_pelanggan_majoo}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        Anonim
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge variant="secondary" className="tabular-nums">
                      {SUMBER_LABEL[t.source ?? ""] ?? t.source ?? "Tidak tercatat"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {t.status_pencocokan ? (
                      <Badge
                        variant={
                          t.status_pencocokan === "menunggu_pencocokan"
                            ? "destructive"
                            : t.status_pencocokan === "anonim"
                              ? "outline"
                              : "default"
                        }
                      >
                        {STATUS_LABEL[t.status_pencocokan] ??
                          t.status_pencocokan}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Tidak impor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void bukaDetail(t);
                      }}
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                      Detail
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lembaran detail */}
      <Sheet open={detailTerbuka} onOpenChange={setDetailTerbuka}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Detail transaksi</SheetTitle>
            <SheetDescription>
              {detail?.transaksi.external_ref ?? "Riwayat lengkap satu baris"}
            </SheetDescription>
          </SheetHeader>

          {memuatDetail ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Memuat...</p>
            </div>
          ) : detail ? (
            <div className="space-y-5 px-4">
              {/* Ringkas */}
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total dibayar
                  </dt>
                  <dd className="text-lg font-bold tabular-nums">
                    {rupiah.format(omzetBersih(detail.transaksi))}
                  </dd>
                  {detail.transaksi.diskon > 0 && (
                    <dd className="text-xs text-muted-foreground">
                      diskon {rupiah.format(detail.transaksi.diskon)}
                    </dd>
                  )}
                  {detail.transaksi.poin_dipakai > 0 && (
                    <dd className="text-xs text-muted-foreground">
                      potongan poin{" "}
                      {rupiah.format(detail.transaksi.poin_dipakai * NILAI_POIN)}
                    </dd>
                  )}
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Poin
                  </dt>
                  <dd className="text-lg font-bold tabular-nums text-primary">
                    +{detail.transaksi.poin_didapat}
                  </dd>
                  {detail.transaksi.poin_dipakai > 0 && (
                    <dd className="text-xs text-muted-foreground">
                      pakai {detail.transaksi.poin_dipakai}
                    </dd>
                  )}
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Waktu tercatat
                  </dt>
                  <dd className="text-sm font-medium">
                    {waktuPenuh(detail.transaksi.dicatat_pada ?? detail.transaksi.created_at)}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Majoo
                  </dt>
                  <dd className="text-sm font-medium">
                    {detail.transaksi.tanggal_majoo
                      ? tanggalMajoo(detail.transaksi.tanggal_majoo)
                      : "Tidak ada"}
                  </dd>
                </div>
              </dl>

              {/* Identitas */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Identitas
                </p>
                <div className="space-y-1.5 text-sm">
                  <BarisKunci label="Pelanggan">
                    {detail.transaksi.pelanggan
                      ? detail.transaksi.pelanggan.nama
                      : detail.transaksi.nama_pelanggan_majoo ?? "Anonim"}
                  </BarisKunci>
                  <BarisKunci label="Kode Majoo">
                    {detail.transaksi.kode_pelanggan_majoo ?? "Tidak ada"}
                  </BarisKunci>
                  <BarisKunci label="Cara bayar">
                    {detail.transaksi.metode_bayar ?? "Tidak tercatat"}
                  </BarisKunci>
                  <BarisKunci label="Sumber">
                    {SUMBER_LABEL[detail.transaksi.source ?? ""] ??
                      detail.transaksi.source ??
                      "Tidak tercatat"}
                  </BarisKunci>
                  <BarisKunci label="Pencatat">
                    {detail.transaksi.dicatat_oleh_nama ?? "Sistem"}
                  </BarisKunci>
                </div>
              </div>

              {/* Rincian item */}
              {detail.transaksi.items?.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Rincian item
                  </p>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {detail.transaksi.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>{item.nama}</span>
                        <span className="tabular-nums text-muted-foreground">
                          x{item.qty}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Jejak poin */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Jejak poin
                </p>
                {detail.ledger.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Tidak ada pergerakan poin tercatat untuk transaksi ini.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {detail.ledger.map((l, i) => (
                      <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">
                            {TIPE_LEDGER_LABEL[l.tipe] ?? l.tipe}
                          </span>
                          {l.keterangan && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {l.keterangan}
                            </span>
                          )}
                        </div>
                        <span className="tabular-nums text-muted-foreground">
                          {l.poin_masuk > 0 && `+${l.poin_masuk}`}
                          {l.poin_keluar > 0 && ` -${l.poin_keluar}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Chip angka ringkasan di header (transaksi, omzet, poin terbit). */
function ChipRingkas({
  label,
  nilai,
  aksen = false,
}: {
  label: string;
  nilai: string;
  aksen?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          "text-sm font-bold tabular-nums " +
          (aksen ? "text-primary" : "text-foreground")
        }
      >
        {nilai}
      </span>
    </span>
  );
}

/** Chip filter yang sedang aktif, bisa dicabut sendiri tanpa reset semua. */
function ChipAktif({
  label,
  onHapus,
}: {
  label: string;
  onHapus: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onHapus}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-xs text-foreground transition-colors hover:bg-muted"
      aria-label={`Hapus filter ${label}`}
    >
      {label}
      <X className="h-3 w-3 text-muted-foreground" aria-hidden />
    </button>
  );
}

/** Baris label-nilai untuk blok identitas di lembar detail. */
function BarisKunci({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

"use client";

// ============================================================
// Halaman Impor Majoo, Kataloji CRM
// ============================================================
// Alur: pilih file ekspor Majoo -> tinjau (preview) -> terapkan (apply).
//
// CRM diisi H+1, bukan paralel realtime. Jadi admin mengekspor Data
// Pelanggan / Detail Penjualan dari Majoo, lalu mengimpornya ke sini.
// Mengimpor file yang sama dua kali aman (idempoten): baris yang sudah
// ada diperbarui, bukan digandakan.
//
// Poin TIDAK ikut diimpor dari Majoo; CRM tetap sumber kebenaran poin.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogKonfirmasi } from "@/components/dialog-konfirmasi";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ShieldOff,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Tipe hasil dari route /api/impor-majoo ----------

interface HasilPreview {
  jumlah: { pelanggan: number; transaksi: number; dilewati: number };
  pelanggan: {
    kode_majoo: string;
    nama: string;
    whatsapp: string;
    tgl_lahir: string;
    jenis_kelamin: string;
    email: string;
    alamat: string;
    baris: number;
  }[];
  transaksi: {
    external_ref: string;
    total: number;
    metode_bayar: string;
    items: { nama: string; qty: number }[];
    waktu: string;
    baris: number;
  }[];
  dilewati: { baris: number; alasan: string }[];
}

interface RingkasanImpor {
  pelanggan: { dibuat: number; diperbarui: number; dilewati: number; gagal: number };
  transaksi: { dibuat: number; diperbarui: number; dilewati: number; gagal: number };
  galat: { baris: number; pesan: string }[];
}

/** Format rupiah singkat, tanpa desimal. */
function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ImporMajooPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [bolehKelola, setBolehKelola] = useState<boolean | null>(null);

  const [memuat, setMemuat] = useState(false);
  const [preview, setPreview] = useState<HasilPreview | null>(null);
  const [ringkasan, setRingkasan] = useState<RingkasanImpor | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [menerapkan, setMenerapkan] = useState(false);

  const batalPilih = useCallback(() => {
    setBerkas(null);
    setPreview(null);
    setRingkasan(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Peran sendiri dibaca supaya non-admin tidak melihat form impor. Lapisan
  // sesungguhnya tetap di server: /api/impor-majoo menolak 403 selain admin.
  useEffect(() => {
    let aktif = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (aktif && user) {
        const { data } = await supabase
          .from("profile")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (aktif) setBolehKelola((data?.role as string) === "admin");
      } else if (aktif) {
        setBolehKelola(false);
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  async function tinjau(file: File) {
    setBerkas(file);
    setPreview(null);
    setRingkasan(null);
    setMemuat(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/impor-majoo?mode=preview", {
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "File tidak bisa dibaca.");
        batalPilih();
        return;
      }
      setPreview(json as HasilPreview);
    } catch {
      toast.error("Tidak bisa menghubungi server. Coba lagi.");
      batalPilih();
    } finally {
      setMemuat(false);
    }
  }

  async function terapkan() {
    if (!berkas) return;
    setMenerapkan(true);
    setKonfirmasi(false);

    try {
      const form = new FormData();
      form.append("file", berkas);
      const res = await fetch("/api/impor-majoo?mode=apply", {
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Impor gagal.");
        return;
      }
      setRingkasan(json.ringkasan as RingkasanImpor);
      toast.success("Impor selesai", {
        description: "Data Majoo berhasil masuk ke CRM.",
      });
    } catch {
      toast.error("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setMenerapkan(false);
    }
  }

  const totalPreview =
    (preview?.jumlah.pelanggan ?? 0) + (preview?.jumlah.transaksi ?? 0);

  if (bolehKelola === false) {
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
            Impor data Majoo ke CRM hanya bisa dilakukan oleh admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Impor Majoo</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Masukkan data pelanggan &amp; transaksi dari ekspor Majoo ke CRM
          (pengisian H+1). File yang sama bisa diimpor ulang tanpa menggandakan
          data.
        </p>
      </header>

      {/* ---------- Langkah 1: pilih file ---------- */}
      <Card>
        <CardContent className="p-6">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) tinjau(f);
            }}
          />

          {!berkas ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-14 text-center transition-colors hover:bg-muted/60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                Pilih file ekspor Majoo
              </span>
              <span className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                Format .xlsx, .xls, atau .csv. Bisa ekspor &quot;Data
                Pelanggan&quot; maupun &quot;Detail Penjualan&quot;.
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {berkas.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(berkas.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 gap-1.5 text-xs text-muted-foreground"
                onClick={batalPilih}
                disabled={memuat || menerapkan}
              >
                <X className="h-3.5 w-3.5" />
                Ganti file
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Langkah 2: tinjau ---------- */}
      {memuat && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Membaca file…</span>
        </div>
      )}

      {preview && !ringkasan && (
        <div className="mt-5">
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pelanggan
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {preview.jumlah.pelanggan}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transaksi
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {preview.jumlah.transaksi}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Baris dilewati
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums",
                  preview.jumlah.dilewati > 0
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {preview.jumlah.dilewati}
              </p>
            </div>
          </div>

          {preview.dilewati.length > 0 && (
            <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="text-xs leading-relaxed text-destructive">
                  <p className="font-semibold">Beberapa baris akan dilewati:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {preview.dilewati.slice(0, 5).map((d, i) => (
                      <li key={i}>
                        Baris {d.baris}: {d.alasan}
                      </li>
                    ))}
                    {preview.dilewati.length > 5 && (
                      <li>
                        …dan {preview.dilewati.length - 5} baris lainnya.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Cuplikan isi */}
          {preview.pelanggan.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-xl border border-border">
              <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cuplikan pelanggan
              </p>
              <ul className="divide-y divide-border bg-card">
                {preview.pelanggan.slice(0, 5).map((p) => (
                  <li key={p.kode_majoo} className="px-4 py-2.5 text-sm">
                    <span className="font-semibold text-foreground">{p.nama}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.kode_majoo} · {p.whatsapp || "tanpa WA"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.transaksi.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl border border-border">
              <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cuplikan transaksi
              </p>
              <ul className="divide-y divide-border bg-card">
                {preview.transaksi.slice(0, 5).map((t) => (
                  <li key={t.external_ref} className="px-4 py-2.5 text-sm">
                    <span className="font-semibold text-foreground">
                      {t.external_ref}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {rupiah(t.total)} · {t.metode_bayar || "tanpa metode"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {totalPreview} baris siap diimpor. Periksa dulu sebelum menerapkan.
            </p>
            <Button onClick={() => setKonfirmasi(true)}>
              Terapkan impor
            </Button>
          </div>
        </div>
      )}

      {/* ---------- Langkah 3: hasil ---------- */}
      {ringkasan && (
        <div className="mt-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Impor selesai
            </h2>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pelanggan
              </p>
              <p className="mt-1 text-sm tabular-nums text-foreground">
                {ringkasan.pelanggan.dibuat} baru ·{" "}
                {ringkasan.pelanggan.diperbarui} diperbarui ·{" "}
                {ringkasan.pelanggan.dilewati} dilewati ·{" "}
                {ringkasan.pelanggan.gagal} gagal
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transaksi
              </p>
              <p className="mt-1 text-sm tabular-nums text-foreground">
                {ringkasan.transaksi.dibuat} baru ·{" "}
                {ringkasan.transaksi.diperbarui} diperbarui ·{" "}
                {ringkasan.transaksi.dilewati} dilewati ·{" "}
                {ringkasan.transaksi.gagal} gagal
              </p>
            </div>
          </div>

          {ringkasan.galat.length > 0 && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive">
                {ringkasan.galat.length} catatan:
              </p>
              <ul className="mt-1 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-xs leading-relaxed text-destructive">
                {ringkasan.galat.slice(0, 20).map((g, i) => (
                  <li key={i}>
                    Baris {g.baris}: {g.pesan}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={batalPilih}>
              Impor file lain
            </Button>
          </div>
        </div>
      )}

      {/* ---------- Dialog konfirmasi ---------- */}
      <DialogKonfirmasi
        terbuka={konfirmasi}
        onTutup={() => setKonfirmasi(false)}
        judul="Terapkan impor?"
        keterangan={
          <>
            {totalPreview} baris akan ditulis ke CRM. Baris yang sudah ada akan
            diperbarui, bukan digandakan. Poin tetap dihitung CRM, bukan dari
            Majoo.
          </>
        }
        labelAksi="Terapkan"
        sedangProses={menerapkan}
        onKonfirmasi={terapkan}
      />
    </div>
  );
}

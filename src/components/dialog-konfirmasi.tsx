"use client";

// ============================================================
// Dialog konfirmasi untuk tindakan yang sulit dibatalkan.
//
// Menggantikan window.confirm() dan window.prompt(). Dialog bawaan peramban
// punya tiga masalah yang nyata di aplikasi ini:
//
//   1. Tidak bisa ditata, sehingga tampil sebagai kotak asing yang tidak
//      terlihat bagian dari Kataloji, dan tombolnya berbahasa Inggris
//      mengikuti bahasa peramban ("OK" / "Cancel").
//   2. Memblokir seluruh halaman, dan di iPad kadang muncul di posisi yang
//      jauh dari jari sehingga kasir menekan asal supaya kotaknya hilang.
//   3. Bisa dimatikan peramban. Kalau itu terjadi, window.confirm() langsung
//      mengembalikan false dan tindakannya batal tanpa penjelasan, sedangkan
//      window.prompt() mengembalikan null sehingga alur berhenti diam-diam.
//
// Dialog ini juga memaksa satu hal yang tidak dilakukan dialog bawaan: tombol
// yang merusak diberi warna merah dan TIDAK menjadi tombol yang terfokus
// pertama, supaya menekan Enter secara refleks tidak langsung menghapus.
// ============================================================

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DialogKonfirmasiProps {
  terbuka: boolean;
  onTutup: () => void;
  judul: string;
  keterangan: React.ReactNode;
  labelAksi: string;
  /** Tampilan merah untuk tindakan yang menghapus atau mencabut akses. */
  merusak?: boolean;
  sedangProses?: boolean;
  /**
   * Kalau diisi, dialog menampilkan satu isian teks dan nilainya dikirim ke
   * onKonfirmasi. Dipakai untuk alasan pengarsipan, yang boleh dikosongkan.
   */
  isian?: { label: string; petunjuk?: string; wajib?: boolean };
  onKonfirmasi: (nilaiIsian: string) => void;
}

export function DialogKonfirmasi({
  terbuka,
  onTutup,
  judul,
  keterangan,
  labelAksi,
  merusak = false,
  sedangProses = false,
  isian,
  onKonfirmasi,
}: DialogKonfirmasiProps) {
  const [nilai, setNilai] = React.useState("");

  const kurang = Boolean(isian?.wajib) && nilai.trim() === "";

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (kurang || sedangProses) return;
    onKonfirmasi(nilai);
  }

  return (
    <DialogPrimitive.Root
      open={terbuka}
      onOpenChange={(o) => {
        if (!o && !sedangProses) onTutup();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-lg duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          // Fokus awal diarahkan ke Batal, bukan ke tombol yang merusak.
          onOpenAutoFocus={(e) => {
            if (!merusak || isian) return;
            e.preventDefault();
            const batal = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
              "[data-tombol=batal]",
            );
            batal?.focus();
          }}
        >
          <div className="flex items-start gap-3">
            {merusak && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-bold leading-tight">
                {judul}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {keterangan}
                </div>
              </DialogPrimitive.Description>
            </div>
          </div>

          <form onSubmit={kirim}>
            {isian && (
              <div className="mt-4">
                <Label htmlFor="isian-konfirmasi" className="text-xs font-bold">
                  {isian.label}
                </Label>
                <Input
                  id="isian-konfirmasi"
                  value={nilai}
                  onChange={(e) => setNilai(e.target.value)}
                  placeholder={isian.petunjuk}
                  autoComplete="off"
                  className="mt-1.5"
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                data-tombol="batal"
                onClick={onTutup}
                disabled={sedangProses}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant={merusak ? "destructive" : "default"}
                disabled={kurang || sedangProses}
              >
                {sedangProses ? "Memproses" : labelAksi}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

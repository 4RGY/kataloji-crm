"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MIN_REDEEM, NILAI_POIN, POIN_PER_RUPIAH } from "@/lib/poin";
import { Button } from "@/components/ui/button";
import {
  ringkasPemeriksaan,
  type HasilPeriksa,
} from "@/lib/pelanggan-tampilan";
import {
  AlertTriangle,
  ArrowUpRight,
  Coins,
  Database,
  Lock,
  ShieldCheck,
  UserCog,
} from "lucide-react";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Masa berlaku poin, mengikuti interval '12 months' di ledger-poin.sql. */
const MASA_BERLAKU_BULAN = 12;

interface Aturan {
  label: string;
  nilai: string;
  arti: string;
}

const ATURAN_POIN: Aturan[] = [
  {
    label: "Poin per belanja",
    nilai: `1 poin / ${rupiah.format(POIN_PER_RUPIAH)}`,
    arti: `Belanja ${rupiah.format(POIN_PER_RUPIAH * 3)} menghasilkan 3 poin. Sisa belanja yang belum genap tidak dibulatkan ke atas.`,
  },
  {
    label: "Nilai satu poin",
    nilai: rupiah.format(NILAI_POIN),
    arti: `Menukar 10 poin memotong tagihan ${rupiah.format(NILAI_POIN * 10)}.`,
  },
  {
    label: "Minimal penukaran",
    nilai: `${MIN_REDEEM} poin`,
    arti: "Di bawah jumlah ini poin belum bisa dipakai.",
  },
  {
    label: "Masa berlaku poin",
    nilai: `${MASA_BERLAKU_BULAN} bulan`,
    arti: "Dihitung sejak poin didapat. Poin tertua dipakai lebih dulu saat menukar.",
  },
  {
    label: "Dasar perhitungan",
    nilai: "Sebelum potongan poin",
    arti: "Poin dihitung dari tagihan setelah diskon promo, tetapi sebelum dipotong penukaran poin. Menukar poin tidak mengurangi poin yang didapat.",
  },
];

export default function Halaman() {
  const supabase = useMemo(() => createClient(), []);
  const [peran, setPeran] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // Hasil pemeriksaan pembukuan poin. null berarti belum selesai diperiksa,
  // dan itu dibedakan dari "sudah diperiksa, hasilnya bersih": keduanya
  // terlihat sama kalau hanya memakai daftar kosong.
  const [periksa, setPeriksa] = useState<HasilPeriksa[] | null>(null);
  const [periksaGagal, setPeriksaGagal] = useState(false);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!aktif || !data.user) return;
      setEmail(data.user.email ?? null);
      const { data: profil } = await supabase
        .from("profile")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (aktif) setPeran(profil?.role ?? null);

      const { data: hasil, error } = await supabase.rpc(
        "periksa_keseimbangan_poin",
      );
      if (!aktif) return;
      if (error) {
        // Fungsinya ada di supabase/perbaikan-ledger.sql. Kalau berkas itu
        // belum dijalankan, panggilannya gagal. Itu keadaan yang perlu
        // dikatakan, bukan disembunyikan sebagai layar kosong.
        setPeriksaGagal(true);
      } else {
        setPeriksa((hasil as HasilPeriksa[]) ?? []);
      }
    })();
    return () => {
      aktif = false;
    };
  }, [supabase]);

  const ringkas = periksa ? ringkasPemeriksaan(periksa) : null;

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Pengaturan</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Aturan yang sedang berlaku di Kataloji, dan di mana masing-masing
          bisa diubah.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Pemeriksaan pembukuan. Ditaruh di atas penjelasan aturan karena
              ini satu satunya bagian halaman yang bisa menuntut tindakan. */}
          <section
            className={
              "rounded-xl border px-5 py-4 " +
              (periksaGagal
                ? "border-border bg-muted/30"
                : ringkas && !ringkas.seimbang
                  ? "border-destructive/40 bg-destructive/10"
                  : "border-border bg-card")
            }
          >
            <h2 className="flex items-center gap-2 text-sm font-bold">
              {periksaGagal ? (
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              ) : ringkas && !ringkas.seimbang ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-primary" />
              )}
              {periksaGagal
                ? "Pemeriksaan pembukuan belum aktif"
                : ringkas
                  ? ringkas.judul
                  : "Memeriksa pembukuan poin"}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {periksaGagal
                ? "Jalankan supabase/perbaikan-ledger.sql untuk mengaktifkan pemeriksaan ini."
                : ringkas
                  ? ringkas.rincian
                  : "Membandingkan poin yang masuk dan keluar dengan sisa yang tercatat."}
            </p>

            {periksa && periksa.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-destructive/30 pt-3">
                {periksa.map((h) => (
                  <li
                    key={h.pelanggan_id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="font-semibold">{h.nama}</span>
                    <span className="tabular-nums text-muted-foreground">
                      tercatat masuk {h.buku}, tersisa {h.terpakai}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Aturan poin */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Coins className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold">Aturan poin</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Berlaku untuk seluruh transaksi
                  </p>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3 w-3" />
                Baca saja
              </span>
            </div>

            <dl className="divide-y divide-border">
              {ATURAN_POIN.map((a) => (
                <div key={a.label} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="text-sm font-semibold">{a.label}</dt>
                    <dd className="text-sm font-bold tabular-nums text-primary">
                      {a.nilai}
                    </dd>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {a.arti}
                  </p>
                </div>
              ))}
            </dl>
          </section>

          {/* Alasan angka di atas tidak bisa diubah dari layar ini. Ditulis
              terbuka supaya tidak terbaca sebagai fitur yang belum jadi. */}
          <section className="rounded-xl border border-border bg-muted/30 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Kenapa angka di atas tidak bisa diubah di sini
            </h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                Poin dihitung oleh database, bukan oleh aplikasi. Ini disengaja:
                kalau perhitungannya ada di aplikasi, siapa pun yang bisa
                memanggil database dapat menuliskan poin sesukanya.
              </p>
              <p>
                Akibatnya, mengubah rasio berarti mengubah cara hitung untuk
                seluruh transaksi berikutnya. Kalau perubahan itu tidak dicatat
                beserta tanggal berlakunya, poin lama dan poin baru memakai
                aturan berbeda tanpa ada yang bisa menjelaskan yang mana dipakai
                kapan. Saat pelanggan bertanya kenapa poinnya berbeda, tidak ada
                jawaban yang bisa dipertanggungjawabkan.
              </p>
              <p>
                Sampai aturan berversi itu dibuat, mengubah rasio dilakukan lewat
                perubahan kode dan migrasi database, bukan lewat satu kolom isian
                yang tampak sederhana.
              </p>
            </div>
          </section>

          {/* Kelola staf: menautkan, bukan menyalin */}
          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <UserCog className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold">Akun staf dan peran</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Dikelola di halaman Staf, khusus admin.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="h-10 gap-2">
                <Link href="/staf">
                  Buka halaman Staf
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Akun kamu
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-0.5 truncate font-semibold">{email ?? "Memuat"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Peran</dt>
                <dd className="mt-0.5 font-semibold capitalize">{peran ?? "Memuat"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Yang belum ada
            </h2>
            <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li>
                Rekonsiliasi dengan majoo. Permintaan akses API ditolak, jadi
                pencocokan omzet masih manual.
              </li>
              <li>
                Aturan poin berversi, supaya rasio bisa diubah tanpa membuat
                poin lama kehilangan penjelasan.
              </li>
              <li>
                Profil kedai seperti jam buka. Belum ada yang membacanya, jadi
                menyimpannya sekarang hanya menambah kolom yang tidak dipakai.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

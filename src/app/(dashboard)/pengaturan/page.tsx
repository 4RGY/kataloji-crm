"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PanelAturanPoin } from "@/components/panel-aturan-poin";
import { Button } from "@/components/ui/button";
import {
  ringkasPemeriksaan,
  type HasilPeriksa,
} from "@/lib/pelanggan-tampilan";
import {
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  UserCog,
} from "lucide-react";

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
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aturan poin yang berlaku.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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

          {/* Aturan poin: panel berversi. Admin bisa menambah periode;
              poin lama tidak dihitung ulang. Tampilan tetap jujur kalau
              tabel aturan_poin belum di-migrasi (lihat PanelAturanPoin). */}
          <PanelAturanPoin peran={peran} />

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
              {peran === "admin" && (
                <Button asChild variant="outline" className="h-11 gap-2">
                  <Link href="/staf">
                    Buka halaman Staf
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
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

        </aside>
      </div>
    </div>
  );
}

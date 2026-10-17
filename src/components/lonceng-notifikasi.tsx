"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import {
  angkaLonceng,
  belumDibaca,
  KUNCI_SIMPAN,
  susunNotifikasi,
  type JenisNotif,
  type Notif,
  type SumberNotif,
} from "@/lib/notifikasi";
import { bersaldo } from "@/lib/pelanggan-tampilan";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Cake, Clock3, HandCoins } from "lucide-react";

interface BarisPelanggan {
  id: string;
  nama: string;
  tgl_lahir: string | null;
}
interface BarisTransaksi {
  pelanggan_id: string | null;
  created_at: string;
}
interface BarisLedger {
  pelanggan_id: string;
  tipe: string;
  sisa: number;
  kedaluwarsa_pada: string | null;
}

const IKON: Record<JenisNotif, typeof Bell> = {
  hangus: HandCoins,
  sepi: Clock3,
  ultah: Cake,
};

function bacaSimpanan(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const isi = window.localStorage.getItem(KUNCI_SIMPAN);
    const urai = isi ? JSON.parse(isi) : [];
    return Array.isArray(urai) ? urai : [];
  } catch {
    // Isi localStorage bisa rusak kalau diedit manual atau versinya berubah.
    // Kalau itu terjadi, lebih baik semua notifikasi dianggap belum dibaca
    // daripada seluruh lonceng ikut mati.
    return [];
  }
}

export function LonceNotifikasi({ className }: { className?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [notif, setNotif] = useState<Notif[]>([]);
  const [dibaca, setDibaca] = useState<string[]>([]);
  const [terbuka, setTerbuka] = useState(false);

  // Tanda dibaca dibaca sekali saat pemasangan. useState dengan fungsi
  // pemula tidak dipakai karena localStorage tidak ada saat render server,
  // sehingga hasil render pertama harus sama di kedua sisi.
  const [siapDibaca, setSiapDibaca] = useState(false);
  if (!siapDibaca && typeof window !== "undefined") {
    setSiapDibaca(true);
    setDibaca(bacaSimpanan());
  }

  const muat = useCallback(async () => {
    const [hasilPelanggan, hasilTransaksi, hasilLedger] = await Promise.all([
      ambilSemua<BarisPelanggan>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, nama, tgl_lahir")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<BarisTransaksi>((dari, sampai) =>
        supabase
          .from("transaksi")
          .select("pelanggan_id, created_at")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
      ambilSemua<BarisLedger>((dari, sampai) =>
        supabase
          .from("point_ledger")
          .select("pelanggan_id, tipe, sisa, kedaluwarsa_pada")
          .order("created_at", { ascending: false })
          .range(dari, sampai),
      ),
    ]);

    // Lonceng gagal memuat tidak perlu diteriakkan: ini pengingat tambahan,
    // bukan tugas utama layar. Halaman yang bersangkutan sudah menampilkan
    // galatnya sendiri kalau memang datanya bermasalah.
    if (hasilPelanggan.error || hasilTransaksi.error || hasilLedger.error) return null;

    const kunjungan = new Map<string, number>();
    const terakhir = new Map<string, string>();
    for (const t of hasilTransaksi.data ?? []) {
      if (!t.pelanggan_id) continue;
      kunjungan.set(t.pelanggan_id, (kunjungan.get(t.pelanggan_id) ?? 0) + 1);
      const lama = terakhir.get(t.pelanggan_id);
      if (!lama || t.created_at > lama) terakhir.set(t.pelanggan_id, t.created_at);
    }

    const poin = new Map<string, number>();
    const hangus = new Map<string, string>();
    for (const b of hasilLedger.data ?? []) {
      if (!bersaldo(b.tipe) || b.sisa <= 0) continue;
      poin.set(b.pelanggan_id, (poin.get(b.pelanggan_id) ?? 0) + b.sisa);
      if (b.kedaluwarsa_pada) {
        const lama = hangus.get(b.pelanggan_id);
        if (!lama || b.kedaluwarsa_pada < lama) hangus.set(b.pelanggan_id, b.kedaluwarsa_pada);
      }
    }

    const sumber: SumberNotif[] = (hasilPelanggan.data ?? []).map((p) => ({
      id: p.id,
      nama: p.nama,
      poin: poin.get(p.id) ?? 0,
      tgl_lahir: p.tgl_lahir,
      kunjungan: kunjungan.get(p.id) ?? 0,
      terakhirIso: terakhir.get(p.id) ?? null,
      hangusPada: hangus.get(p.id) ?? null,
    }));

    return susunNotifikasi(sumber, new Date());
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const hasil = await muat();
      if (aktif && hasil) setNotif(hasil);
    })();
    return () => {
      aktif = false;
    };
  }, [muat]);

  const baru = belumDibaca(notif, dibaca);
  const angka = angkaLonceng(baru.length);

  function tandaiSemua() {
    const semua = notif.map((n) => n.id);
    setDibaca(semua);
    try {
      window.localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(semua));
    } catch {
      // Mode penyamaran browser menolak localStorage. Tandanya hilang saat
      // halaman dimuat ulang, dan itu lebih baik daripada layar mati.
    }
  }

  return (
    <DropdownMenu open={terbuka} onOpenChange={setTerbuka}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent",
            className,
          )}
          aria-label={
            baru.length > 0
              ? `Notifikasi, ${baru.length} belum dibaca`
              : "Notifikasi"
          }
        >
          <span className="relative shrink-0">
            <Bell className="h-4.5 w-4.5" />
            {angka && (
              // Titik dan angka ditaruh menempel pada ikon, bukan di ujung
              // tombol, supaya tetap terlihat saat sidebar menyempit dan
              // teksnya disembunyikan.
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground tabular-nums">
                {angka}
              </span>
            )}
          </span>
          <span className="hidden lg:inline">Notifikasi</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-bold">Perlu perhatian</p>
          {baru.length > 0 && (
            <button
              onClick={tandaiSemua}
              className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
            >
              Tandai dibaca
            </button>
          )}
        </div>

        {notif.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
            Tidak ada yang mendesak. Poin belum ada yang mendekati hangus.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {notif.map((n) => {
              const Ikon = IKON[n.jenis];
              const belum = !dibaca.includes(n.id);
              return (
                <li key={n.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={n.tautan}
                    onClick={() => setTerbuka(false)}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        n.jenis === "hangus"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Ikon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold leading-snug">
                          {n.judul}
                        </span>
                        {belum && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {n.isi}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

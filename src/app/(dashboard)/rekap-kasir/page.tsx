"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";
import { bolehLihatRekap } from "@/lib/staf";
import {
  bagianOmzet,
  bukanNamaOrang,
  inisialPencatat,
  namaPendekPencatat,
  PERIODE_REKAP,
  rataPerStrukStaf,
  ringkasRekap,
  susunRekap,
  totalRekap,
  type BarisTransaksiRekap,
} from "@/lib/jejak-pencatat";
import { Button } from "@/components/ui/button";
import { AksesDitolak } from "@/components/akses-ditolak";
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** "2026-09-15T04:02:56Z" -> "15 Sep 2026, 11.02" */
function waktuPanjang(iso: string | null): string {
  if (!iso) return "belum pernah";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "belum pernah";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function HalamanRekapKasir() {
  const supabase = useMemo(() => createClient(), []);

  const [transaksi, setTransaksi] = useState<BarisTransaksiRekap[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [periode, setPeriode] = useState<string>("all");
  // null = belum diketahui. Selama belum diketahui, isi tidak ditampilkan
  // sama sekali supaya angka kinerja staf tidak sempat terlihat sekejap.
  const [bolehLihat, setBolehLihat] = useState<boolean | null>(null);
  const [peranSaya, setPeranSaya] = useState<string | null>(null);

  const hariIni = useMemo(() => new Date(), []);

  const ambil = useCallback(async () => {
    // Transaksi diambil UTUH lewat ambilSemua, bukan .limit(), karena
    // PostgREST memotong respons di 1000 baris tanpa memberi tahu. Tanpa ini
    // rekap akan terlihat lebih kecil daripada kenyataannya.
    //
    // Rekap disusun ulang dari baris transaksi, BUKAN dibaca dari view
    // rekap_pencatat_transaksi, karena view itu sudah teragregasi sehingga
    // tidak bisa disaring per periode.
    return ambilSemua<BarisTransaksiRekap>((dari, sampai) =>
      supabase
        .from("transaksi")
        .select("total, dicatat_oleh, dicatat_oleh_nama, created_at, tanggal_majoo")
        .order("created_at", { ascending: false })
        .range(dari, sampai),
    );
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      // Peran diperiksa lebih dulu. Halaman ini memuat kinerja tiap staf,
      // dan itu bukan urusan sesama kasir.
      const { data: sesi } = await supabase.auth.getUser();
      if (!aktif) return;

      if (!sesi?.user) {
        setBolehLihat(false);
        setMemuat(false);
        return;
      }

      const { data: profil } = await supabase
        .from("profile")
        .select("role")
        .eq("id", sesi.user.id)
        .maybeSingle();
      if (!aktif) return;

      const role = profil?.role ?? null;
      setPeranSaya(role);

      // Syarat yang sama dipakai sidebar, supaya menu dan halaman tidak
      // pernah berbeda pendapat.
      const boleh = bolehLihatRekap(role);
      setBolehLihat(boleh);

      if (!boleh) {
        setMemuat(false);
        return;
      }

      const hasil = await ambil();
      if (!aktif) return;

      if (hasil.error) {
        catatGalat("muat rekap pencatat", hasil.error);
        setGalat(
          pesanGalat(hasil.error, "Gagal memuat rekap. Coba muat ulang."),
        );
      } else {
        setTransaksi(hasil.data ?? []);
        setGalat(null);
      }
      setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambil, supabase]);

  async function muatUlang() {
    setMemuat(true);
    const hasil = await ambil();
    if (hasil.error) {
      catatGalat("muat ulang rekap pencatat", hasil.error);
      setGalat(pesanGalat(hasil.error, "Gagal memuat rekap."));
    } else {
      setTransaksi(hasil.data ?? []);
      setGalat(null);
    }
    setMemuat(false);
  }

  const pilihan = PERIODE_REKAP.find((p) => p.kunci === periode) ?? PERIODE_REKAP[2];
  const rekap = useMemo(
    () => susunRekap(transaksi, pilihan.hari, hariIni),
    [transaksi, pilihan, hariIni],
  );
  const total = useMemo(() => totalRekap(rekap), [rekap]);

  if (memuat || bolehLihat === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Memuat rekap…
        </div>
      </div>
    );
  }

  // Bukan admin: tidak menampilkan satu angka pun. Menampilkan tabel kosong
  // dengan tombol saring hanya menyesatkan, seperti pada halaman Staf.
  //
  // Ini penjagaan TAMPILAN, bukan penegakan database. Kasir berhak membaca
  // tabel `transaksi` (butuh untuk riwayat di layar kasir), dan view-nya
  // memakai security_invoker sehingga ikut aturan yang sama. Jadi kasir yang
  // paham teknis masih bisa menyusun rekap ini lewat API. Yang dicegah di
  // sini hal yang nyata terjadi di kedai: membuka menu lalu tanpa sengaja
  // melihat perbandingan kinerja rekan. Menutupnya sampai database menuntut
  // RLS `transaksi` dipersempit, dan itu mematahkan layar kasir.
  if (bolehLihat === false) {
    return (
      <AksesDitolak
        judul="Rekap kasir"
        keterangan="Siapa mencatat transaksi apa, untuk pertanggungjawaban kas."
        peran={peranSaya}
        // Sebelumnya di sini tertulis "Halaman ini hanya untuk admin".
        // Itu tidak benar: manajer juga boleh membuka halaman ini, hanya kasir
        // yang tidak. Keterangan yang keliru membuat kasir mengira hanya admin
        // yang bisa membantunya, padahal manajer di sebelahnya juga bisa.
        alasan="Rekap kinerja antar staf hanya bisa dilihat admin dan manajer. Hubungi salah satunya kalau ada transaksi yang perlu ditelusuri."
      />
    );
  }

  if (galat) {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Rekap kasir</h1>
        </header>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
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
          <h1 className="text-2xl font-extrabold tracking-tight">Rekap kasir</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {ringkasRekap(rekap)}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 gap-2"
          onClick={muatUlang}
          disabled={memuat}
        >
          <RefreshCw className={memuat ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Muat ulang
        </Button>
      </header>

      <section
        aria-label="Rekap pencatat transaksi"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Pencatat transaksi
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Paling banyak mencatat berada di urutan atas
              </p>
            </div>
          </div>
          <div
            className="flex gap-1 rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="Periode rekap"
          >
            {PERIODE_REKAP.map((p) => (
              <button
                key={p.kunci}
                type="button"
                role="tab"
                aria-selected={periode === p.kunci}
                onClick={() => setPeriode(p.kunci)}
                className={
                  // min-h-11: sama seperti tab tenggat di halaman Loyalitas,
                  // py-1.5 saja hanya menghasilkan 28px pada text-xs.
                  "flex min-h-11 items-center rounded-md px-4 text-xs font-bold transition-colors " +
                  (periode === p.kunci
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {rekap.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold">
              Belum ada transaksi pada {pilihan.label.toLowerCase()} terakhir
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Rekap terisi sendiri setiap kali kasir menyimpan transaksi.
            </p>
          </div>
        ) : (
          <>
            {/* Kepala kolom hanya tampil pada layar lebar. Pada layar sempit
                tiap baris sudah memuat labelnya sendiri. */}
            <div className="hidden border-b border-border bg-muted/40 px-6 py-2.5 lg:grid lg:grid-cols-[minmax(0,2fr)_0.8fr_1.1fr_1fr_1.2fr] lg:gap-4">
              {["Staf", "Transaksi", "Omzet", "Rata per struk", "Terakhir mencatat"].map(
                (h) => (
                  <p
                    key={h}
                    className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {h}
                  </p>
                ),
              )}
            </div>

            <ul className="divide-y divide-border">
              {rekap.map((b) => {
                const khusus = bukanNamaOrang(b.nama);
                const bagian = bagianOmzet(b.total_omzet, total.omzet);
                return (
                  <li
                    key={b.staf_id ?? `nama:${b.nama}`}
                    className="grid grid-cols-1 gap-2 px-6 py-3.5 lg:grid-cols-[minmax(0,2fr)_0.8fr_1.1fr_1fr_1.2fr] lg:items-center lg:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className={
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold " +
                          (khusus
                            ? "border border-dashed border-border text-muted-foreground"
                            : "bg-primary/12 text-primary")
                        }
                      >
                        {khusus ? "?" : inisialPencatat(b.nama)}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={
                            "truncate text-sm font-bold " +
                            (khusus ? "italic text-muted-foreground" : "")
                          }
                        >
                          {namaPendekPencatat(b.nama)}
                        </p>
                        {/* Baris tanpa jejak diberi keterangan supaya saat
                            audit tidak ada yang membacanya sebagai nama staf. */}
                        {khusus && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                            Transaksi lama, sebelum nama pencatat mulai disimpan
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-semibold tabular-nums">
                      <span className="text-muted-foreground lg:hidden">
                        Transaksi:{" "}
                      </span>
                      {b.jumlah_transaksi}
                    </p>

                    <div>
                      <p className="text-sm font-extrabold tabular-nums">
                        <span className="text-xs font-semibold text-muted-foreground lg:hidden">
                          Omzet:{" "}
                        </span>
                        {rupiah.format(b.total_omzet)}
                      </p>
                      <div
                        className="mt-1.5 hidden h-1.5 overflow-hidden rounded-full bg-muted lg:block"
                        role="img"
                        aria-label={`${bagian} persen dari omzet periode ini`}
                      >
                        <div
                          className={
                            "h-full rounded-full " +
                            (khusus ? "bg-muted-foreground/40" : "bg-primary")
                          }
                          style={{ width: `${bagian}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-sm tabular-nums text-muted-foreground">
                      <span className="lg:hidden">Rata per struk: </span>
                      {rupiah.format(
                        rataPerStrukStaf(b.total_omzet, b.jumlah_transaksi),
                      )}
                    </p>

                    <p className="text-xs tabular-nums text-muted-foreground">
                      <span className="lg:hidden">Terakhir: </span>
                      {waktuPanjang(b.terakhir_mencatat)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="grid grid-cols-1 gap-2 border-t-2 border-border bg-muted/30 px-6 py-3.5 lg:grid-cols-[minmax(0,2fr)_0.8fr_1.1fr_1fr_1.2fr] lg:items-center lg:gap-4">
              <p className="text-sm font-bold">Total</p>
              <p className="text-sm font-bold tabular-nums">
                <span className="font-semibold text-muted-foreground lg:hidden">
                  Transaksi:{" "}
                </span>
                {total.transaksi}
              </p>
              <p className="text-sm font-extrabold tabular-nums">
                {rupiah.format(total.omzet)}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {rupiah.format(rataPerStrukStaf(total.omzet, total.transaksi))}
              </p>
              <p />
            </div>
          </>
        )}
      </section>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Nama pencatat menempel saat transaksi disimpan dan tidak bisa diubah
        lagi, termasuk oleh admin.
      </p>
    </div>
  );
}

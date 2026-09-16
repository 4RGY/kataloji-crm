"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";
import { NILAI_POIN } from "@/lib/poin";
import { formatWhatsapp } from "@/lib/pelanggan";

import {
  adaMasalahBerat,
  CONTOH_PESAN,
  periksaPesan,
  pilihSegmen,
  pisahkanTanpaNomor,
  ringkasKirim,
  SEGMEN,
  SISIPAN,
  susunPesan,
  tautanWhatsapp,
  type KodeSegmen,
  type TargetCampaign,
} from "@/lib/campaign";
import { bersaldo } from "@/lib/pelanggan-tampilan";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AksesDitolak } from "@/components/akses-ditolak";
import { bolehLihatPemasaran } from "@/lib/staf";
import {
  AlertTriangle,
  Check,
  Loader2,
  MessageCircle,
  PhoneOff,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";

interface BarisPelanggan {
  id: string;
  nama: string;
  whatsapp: string;
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

interface BarisKirim {
  pelanggan_id: string;
  segmen: string;
  dikirim_pada: string;
}

export default function Halaman() {
  // useSearchParams memaksa halaman ini dirender di sisi klien. Tanpa
  // Suspense, Next menolak membangun halaman statis di sekitarnya.
  return (
    <Suspense fallback={<MemuatCampaign />}>
      <IsiCampaign />
    </Suspense>
  );
}

function MemuatCampaign() {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-24 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Menyiapkan campaign
    </div>
  );
}

function IsiCampaign() {
  const supabase = useMemo(() => createClient(), []);
  const parameter = useSearchParams();

  // Peran dibaca dari database, bukan dari sesi atau email, karena peran
  // hanya boleh ditentukan server. Syaratnya sama dengan yang dipakai
  // sidebar supaya menu dan halaman tidak pernah berbeda pendapat.
  const [peran, setPeran] = useState<string | null>(null);
  const [bolehLihat, setBolehLihat] = useState<boolean | null>(null);

  const [pelanggan, setPelanggan] = useState<BarisPelanggan[]>([]);
  const [transaksi, setTransaksi] = useState<BarisTransaksi[]>([]);
  const [ledger, setLedger] = useState<BarisLedger[]>([]);
  const [terkirim, setTerkirim] = useState<BarisKirim[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  // Tabel campaign_kirim mungkin belum dipasang di database. Halaman tetap
  // harus bisa dipakai tanpa tabel itu, hanya tanpa catatan riwayat, supaya
  // fiturnya tidak mati total gara-gara satu berkas SQL belum dijalankan.
  const [tabelSiap, setTabelSiap] = useState(true);

  const [segmen, setSegmen] = useState<KodeSegmen>("hangus");
  const [pesan, setPesan] = useState(CONTOH_PESAN[0].isi);
  const [menandai, setMenandai] = useState<string | null>(null);

  const hariIni = useMemo(() => new Date(), []);

  /** Ambil semua sumber sekaligus. Dipisah dari penerapan state supaya
      pemanggilnya yang memutuskan kapan hasilnya dipasang. */
  const ambilSemuaData = useCallback(async () => {
    // Peran diperiksa lebih dulu. Kalau tidak boleh, data pelanggan tidak
    // perlu diambil sama sekali: menolak di layar sementara datanya sudah
    // terunduh ke perangkat bukan penolakan, hanya penyembunyian.
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
      return { ditolak: true as const, role };
    }

    const [hasilPelanggan, hasilTransaksi, hasilLedger] = await Promise.all([
      ambilSemua<BarisPelanggan>((dari, sampai) =>
        supabase
          .from("pelanggan")
          .select("id, nama, whatsapp, tgl_lahir")
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

    const hasilKirim = await supabase
      .from("campaign_kirim")
      .select("pelanggan_id, segmen, dikirim_pada");

    return {
      ditolak: false as const,
      role,
      hasilPelanggan,
      hasilTransaksi,
      hasilLedger,
      hasilKirim,
    };
  }, [supabase]);

  type HasilMuat = Awaited<ReturnType<typeof ambilSemuaData>>;

  function terapkan(hasil: HasilMuat) {
    setPeran(hasil.role);

    if (hasil.ditolak) {
      setBolehLihat(false);
      setMemuat(false);
      return;
    }
    setBolehLihat(true);

    const { hasilPelanggan, hasilTransaksi, hasilLedger, hasilKirim } = hasil;
    const rusak = hasilPelanggan.error ?? hasilTransaksi.error ?? hasilLedger.error;
    if (rusak) {
      catatGalat("campaign muat", rusak);
      setGalat(pesanGalat(rusak, "Gagal memuat data pelanggan. Coba muat ulang."));
      setMemuat(false);
      return;
    }

    setGalat(null);
    setPelanggan(hasilPelanggan.data ?? []);
    setTransaksi(hasilTransaksi.data ?? []);
    setLedger(hasilLedger.data ?? []);

    // Tabel campaign_kirim mungkin belum dipasang. Halaman tetap berguna
    // tanpa tabel itu, hanya kehilangan tanda "sudah dikirim".
    if (hasilKirim.error) {
      setTabelSiap(false);
      setTerkirim([]);
    } else {
      setTabelSiap(true);
      setTerkirim(hasilKirim.data ?? []);
    }

    setMemuat(false);
  }

  async function muatUlang() {
    setMemuat(true);
    terapkan(await ambilSemuaData());
  }

  // Segmen bisa ditentukan dari tautan notifikasi, supaya menekan lonceng
  // langsung mendarat pada orang yang dimaksud. Dibaca saat render, bukan
  // lewat effect, agar tidak memicu render bertingkat.
  const segmenDariTautan = parameter.get("segmen");
  const [segmenTerakhir, setSegmenTerakhir] = useState<string | null>(null);
  if (segmenDariTautan !== segmenTerakhir) {
    setSegmenTerakhir(segmenDariTautan);
    const cocok = SEGMEN.find((s) => s.kode === segmenDariTautan);
    if (cocok) {
      setSegmen(cocok.kode);
      const contoh = CONTOH_PESAN.find((c) => c.untuk === cocok.kode);
      if (contoh) setPesan(contoh.isi);
    }
  }

  useEffect(() => {
    let aktif = true;
    (async () => {
      const hasil = await ambilSemuaData();
      if (!aktif) return;
      terapkan(hasil);
    })();
    return () => {
      aktif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambilSemuaData]);

  /** Gabungkan tiga sumber menjadi bentuk yang dipakai logika campaign. */
  const target: TargetCampaign[] = useMemo(() => {
    const kunjungan = new Map<string, number>();
    const terakhir = new Map<string, string>();
    for (const t of transaksi) {
      if (!t.pelanggan_id) continue;
      kunjungan.set(t.pelanggan_id, (kunjungan.get(t.pelanggan_id) ?? 0) + 1);
      const lama = terakhir.get(t.pelanggan_id);
      if (!lama || t.created_at > lama) terakhir.set(t.pelanggan_id, t.created_at);
    }

    const poin = new Map<string, number>();
    const hangus = new Map<string, string>();
    for (const b of ledger) {
      if (!bersaldo(b.tipe) || b.sisa <= 0) continue;
      poin.set(b.pelanggan_id, (poin.get(b.pelanggan_id) ?? 0) + b.sisa);
      if (b.kedaluwarsa_pada) {
        const lama = hangus.get(b.pelanggan_id);
        if (!lama || b.kedaluwarsa_pada < lama) {
          hangus.set(b.pelanggan_id, b.kedaluwarsa_pada);
        }
      }
    }

    return pelanggan.map((p) => ({
      id: p.id,
      nama: p.nama,
      whatsapp: p.whatsapp,
      poin: poin.get(p.id) ?? 0,
      tgl_lahir: p.tgl_lahir,
      kunjungan: kunjungan.get(p.id) ?? 0,
      terakhirIso: terakhir.get(p.id) ?? null,
      hangusPada: hangus.get(p.id) ?? null,
    }));
  }, [pelanggan, transaksi, ledger]);

  const dipilih = useMemo(
    () => pilihSegmen(target, segmen, hariIni),
    [target, segmen, hariIni],
  );
  const { siap, tanpaNomor } = useMemo(
    () => pisahkanTanpaNomor(dipilih),
    [dipilih],
  );

  const sudahDikirim = useMemo(() => {
    const set = new Set<string>();
    for (const k of terkirim) {
      if (k.segmen === segmen) set.add(k.pelanggan_id);
    }
    return set;
  }, [terkirim, segmen]);

  const jumlahSegmen = useMemo(() => {
    const peta: Partial<Record<KodeSegmen, number>> = {};
    for (const s of SEGMEN) {
      peta[s.kode] = pilihSegmen(target, s.kode, hariIni).length;
    }
    return peta;
  }, [target, hariIni]);

  const masalah = useMemo(() => periksaPesan(pesan), [pesan]);
  const terkunci = adaMasalahBerat(masalah);

  async function kirim(orang: TargetCampaign) {
    const isi = susunPesan(pesan, orang, NILAI_POIN);
    const tautan = tautanWhatsapp(orang.whatsapp, isi);
    if (!tautan) {
      toast.error("Nomor WhatsApp pelanggan ini tidak bisa dibuka.");
      return;
    }

    // WhatsApp dibuka lebih dulu. Kalau pencatatan didahulukan lalu gagal,
    // kasir menunggu tanpa tahu apakah boleh lanjut.
    window.open(tautan, "_blank", "noopener,noreferrer");

    if (!tabelSiap) return;

    setMenandai(orang.id);
    const { data: sesi } = await supabase.auth.getUser();
    const uid = sesi.user?.id;
    if (!uid) {
      setMenandai(null);
      return;
    }

    const { error } = await supabase.from("campaign_kirim").insert({
      pelanggan_id: orang.id,
      segmen,
      pesan: isi,
      dikirim_oleh: uid,
    });

    if (error) {
      catatGalat("campaign catat", error);
      toast.error("WhatsApp terbuka, tetapi pengirimannya belum tercatat.", {
        description: pesanGalat(error, "Coba catat ulang lewat tombol Kirim."),
      });
    } else {
      setTerkirim((lama) => [
        ...lama,
        { pelanggan_id: orang.id, segmen, dikirim_pada: new Date().toISOString() },
      ]);
    }
    setMenandai(null);
  }

  // Selama peran belum diketahui, jangan tampilkan apa pun yang bersifat
  // memutuskan. Menampilkan halaman penuh lebih dulu lalu menggantinya
  // dengan penolakan membuat isinya sempat terbaca, dan itu justru
  // membocorkan hal yang sedang dijaga.
  if (bolehLihat === null) return <MemuatCampaign />;

  if (!bolehLihat) {
    return (
      <AksesDitolak
        judul="Campaign"
        keterangan="Kirim pesan ke pelanggan yang perlu dihubungi."
        peran={peran}
        alasan="Mengirim pesan promosi adalah keputusan pengelola, bukan bagian dari melayani antrean. Hubungi admin atau manajer kalau ada pelanggan yang perlu dikontak."
      />
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Campaign</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pilih siapa yang perlu dihubungi, susun pesannya sekali, lalu kirim
            lewat WhatsApp kedai satu per satu.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-10"
          onClick={() => void muatUlang()}
          disabled={memuat}
          aria-label="Muat ulang"
        >
          <RefreshCw className={memuat ? "animate-spin" : undefined} />
        </Button>
      </header>

      {/* Batas yang jujur, ditulis sekali di tempat yang pasti terbaca.
          Menyembunyikannya hanya memindahkan kekecewaan ke saat kasir
          sudah menekan tombol kirim yang ternyata tidak otomatis. */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pesan dikirim dari WhatsApp yang terpasang di perangkat ini, bukan
          otomatis dari server. Setiap nama dibuka satu per satu, dan kamu
          menekan kirim sendiri di WhatsApp.
        </p>
      </div>

      {galat && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {galat}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          {/* Langkah 1 */}
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              1. Pilih siapa yang dihubungi
            </h2>
            <div className="flex flex-wrap gap-2">
              {SEGMEN.map((s) => {
                const jumlah = jumlahSegmen[s.kode] ?? 0;
                const aktif = segmen === s.kode;
                return (
                  <Button
                    key={s.kode}
                    variant={aktif ? "default" : "outline"}
                    className="h-11 px-4 text-sm font-bold"
                    onClick={() => {
                      setSegmen(s.kode);
                      const contoh = CONTOH_PESAN.find((c) => c.untuk === s.kode);
                      if (contoh) setPesan(contoh.isi);
                    }}
                    aria-pressed={aktif}
                    disabled={jumlah === 0 && s.kode !== "semua"}
                  >
                    {s.nama}
                    <span className="ml-2 tabular-nums opacity-70">{jumlah}</span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2.5 text-sm text-muted-foreground">
              {SEGMEN.find((s) => s.kode === segmen)?.alasan}
            </p>
          </section>

          {/* Langkah 2 */}
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              2. Susun pesannya
            </h2>
            <Textarea
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
              rows={5}
              className="resize-y !text-base leading-relaxed"
              aria-label="Isi pesan"
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">Sisipkan:</span>
              {SISIPAN.map((s) => (
                <Button
                  key={s.kunci}
                  variant="outline"
                  className="h-11 px-3 font-mono text-xs"
                  onClick={() => setPesan((lama) => lama + " " + s.kunci)}
                  title={s.arti}
                >
                  {s.kunci}
                </Button>
              ))}
            </div>

            {masalah.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {masalah.map((m, i) => (
                  <p
                    key={i}
                    role="status"
                    className={
                      "flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium leading-relaxed " +
                      (m.berat
                        ? "border border-destructive/40 bg-destructive/10 text-destructive"
                        : "border border-border bg-muted/50 text-muted-foreground")
                    }
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {m.teks}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {CONTOH_PESAN.map((c) => (
                <Button
                  key={c.judul}
                  variant="outline"
                  className="h-11 px-3 text-xs font-semibold"
                  onClick={() => setPesan(c.isi)}
                >
                  {c.judul}
                </Button>
              ))}
            </div>
          </section>

          {/* Langkah 3 */}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              3. Kirim satu per satu
            </h2>

            <p className="mb-3 text-sm text-muted-foreground">
              {ringkasKirim(siap.length, tanpaNomor.length, sudahDikirim.size)}
            </p>

            {memuat ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat pelanggan
              </div>
            ) : siap.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
                <p className="text-sm font-semibold">Tidak ada yang perlu dihubungi</p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Coba segmen lain di langkah pertama, atau lengkapi nomor
                  WhatsApp pelanggan lewat halaman Pelanggan.
                </p>
                <Button variant="outline" asChild className="mt-4 h-11 gap-2">
                  <Link href="/pelanggan">
                    <Users className="h-4 w-4" aria-hidden />
                    Buka halaman Pelanggan
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {siap.map((p) => {
                  const sudah = sudahDikirim.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.nama}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {formatWhatsapp(p.whatsapp)}
                          {p.poin > 0 && ` \u00b7 ${p.poin} poin`}
                        </p>
                      </div>
                      <Button
                        variant={sudah ? "outline" : "default"}
                        className="h-11 gap-2 px-4 font-semibold"
                        onClick={() => void kirim(p)}
                        disabled={terkunci || menandai === p.id}
                      >
                        {menandai === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : sudah ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {sudah ? "Kirim lagi" : "Kirim"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {tanpaNomor.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <PhoneOff className="h-4 w-4 text-muted-foreground" />
                  {tanpaNomor.length} pelanggan dilewati
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Nomor WhatsApp mereka belum lengkap: {" "}
                  {tanpaNomor.map((p) => p.nama).join(", ")}.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Pratinjau. Ditempel supaya tetap terlihat saat daftar digulung,
            karena inilah yang memberi tahu kasir pesan apa yang akan keluar. */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Pratinjau
            </h2>
            {siap.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pratinjau muncul setelah ada pelanggan pada segmen ini.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Seperti yang akan dibaca {siap[0].nama}:
                </p>
                {/* Sengaja dibuat mirip gelembung WhatsApp: yang ditinjau di
                    sini adalah pesan yang dibaca pelanggan, bukan isi kolom. */}
                <div className="rounded-xl rounded-tr-sm bg-primary/10 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {susunPesan(pesan, siap[0], NILAI_POIN) || "Pesan masih kosong."}
                  </p>
                </div>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  {susunPesan(pesan, siap[0], NILAI_POIN).length} huruf
                </p>
              </>
            )}

            {!tabelSiap && (
              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                Catatan pengiriman belum aktif karena tabel campaign_kirim
                belum dipasang. Pesan tetap bisa dikirim, tetapi tanda sudah
                dikirim tidak tersimpan. Jalankan supabase/campaign.sql untuk
                mengaktifkannya.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

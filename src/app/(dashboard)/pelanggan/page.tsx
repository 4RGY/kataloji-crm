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
import {
  cocokCari,
  formatWhatsapp,
  normalisasiWhatsapp,
  validasiPelanggan,
} from "@/lib/pelanggan";
import { Loader2, RefreshCw, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = ["Nama", "WhatsApp", "Tanggal lahir", "Poin"];

interface Pelanggan {
  id: string;
  nama: string;
  whatsapp: string;
  tgl_lahir: string | null;
  poin: number;
}

const KOSONG = { nama: "", whatsapp: "", tgl_lahir: "" };

/** 1995-05-20 -> 20 Mei 1995 */
function tanggalIndonesia(iso: string | null): string {
  if (!iso) return "Belum diisi";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function PelangganPage() {
  const supabase = createClient();

  const [daftar, setDaftar] = useState<Pelanggan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Form tambah pelanggan
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [form, setForm] = useState(KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);

  // Ambil data: setState-nya hanya terjadi setelah await, bukan sinkron
  // di body effect, jadi tidak melanggar aturan set-state-in-effect.
  // Flag `aktif` mencegah setState setelah komponen dilepas.
  const ambilDaftar = useCallback(async () => {
    const { data, error } = await supabase
      .from("pelanggan")
      .select("id, nama, whatsapp, tgl_lahir, poin")
      .order("nama", { ascending: true });
    return { data: (data ?? []) as Pelanggan[], error };
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const { data, error } = await ambilDaftar();
      if (!aktif) return;
      if (error) {
        setGalat("Gagal memuat daftar pelanggan. Coba muat ulang.");
        setDaftar([]);
      } else {
        setGalat(null);
        setDaftar(data);
      }
      setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambilDaftar]);

  async function muatUlang() {
    setMemuat(true);
    const { data, error } = await ambilDaftar();
    if (error) {
      setGalat("Gagal memuat daftar pelanggan. Coba muat ulang.");
      setDaftar([]);
    } else {
      setGalat(null);
      setDaftar(data);
    }
    setMemuat(false);
  }

  const hasil = useMemo(
    () => daftar.filter((p) => cocokCari(p, query)),
    [daftar, query],
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
      toast.error("Gagal menyimpan pelanggan.", { description: error.message });
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
    <div className="max-w-6xl px-6 pb-10 pt-4 lg:px-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Pelanggan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftar pelanggan Kataloji: nama, nomor WhatsApp, dan poin loyalitas
          mereka.
        </p>
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

      {/* Tabel pelanggan */}
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Header tabel */}
        <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_0.7fr] gap-4 border-b border-border bg-muted/40 px-6 py-3 sm:grid">
          {COLUMNS.map((c) => (
            <p
              key={c}
              className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
            >
              {c}
            </p>
          ))}
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
              Pelanggan baru otomatis masuk daftar ini setelah transaksi pertama
              mereka dicatat, atau bisa ditambah manual lewat tombol di atas.
            </p>
          </div>
        ) : hasil.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 bg-card px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">
              Tidak ada yang cocok
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Tidak ada pelanggan dengan kata kunci &ldquo;{query}&rdquo;. Coba
              nama lain atau beberapa digit nomor WhatsApp.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border bg-card">
            {hasil.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-1 gap-1 px-6 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[2fr_1.5fr_1.2fr_0.7fr] sm:items-center sm:gap-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  {p.nama}
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {formatWhatsapp(p.whatsapp)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tanggalIndonesia(p.tgl_lahir)}
                </p>
                <p className="text-sm font-bold tabular-nums text-primary">
                  {p.poin}
                </p>
              </li>
            ))}
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

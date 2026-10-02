"use client";

// ============================================================
// Panel Aturan Poin, Kataloji CRM
// ============================================================
// Gantikan panel "Aturan poin" yang tadinya baca-saja & hardcode
// (Rp20.000 / 1 poin). Sekarang: aturan berversi per periode, bisa
// dipilih per_nominal / per_kunjungan / per_transaksi, dan tercatat
// siapa & kapan mengubahnya (tabel aturan_poin + dibuat_oleh).
//
// Pola aman-gagal (sama seperti fitur arsip pelanggan):
//   - Table aturan_poin baru ada setelah supabase/aturan-poin.sql
//     dijalankan di cloud. Sebelum itu, panel ini TUNGGU dan
//     bilang keadaannya, bukan menampilkan layar kosong / angka
//     mengambang.
//   - Poin lama TIDAK dihitung ulang: tiap transaksi memakai aturan
//     yang berlaku pada tanggal transaksinya (lihat aturan-poin.sql).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  aturanAktif,
  deskripsiMode,
  labelMode,
  NOMINAL_FALLBACK,
  validasiInputAturan,
  type BarisAturanPoin,
  type InputAturanBaru,
  type ModeAturan,
} from "@/lib/aturan-poin";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Coins,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { catatGalat, pesanGalat } from "@/lib/pesan-galat";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const HARI_INI = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function hariKedua(hariIni: string): string {
  const d = new Date(hariIni + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatTanggal(iso: string | null): string {
  if (!iso) return "belum selesai";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

interface Props {
  /** Peran yang sedang login; menentukan form boleh dibuka. */
  peran: string | null;
}

export function PanelAturanPoin({ peran }: Props) {
  const supabase = useState(() => createClient())[0];
  const [siap, setSiap] = useState<boolean | null>(null); // null = belum probe
  const [aturan, setAturan] = useState<BarisAturanPoin[]>([]);
  const [memuat, setMemuat] = useState(true);

  // Form aturan baru (admin).
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [form, setForm] = useState<InputAturanBaru>({
    mode: "per_kunjungan",
    mulai: HARI_INI(),
    selesai: "",
    nominal: "20000",
    keterangan: "",
  });
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    // Probe dulu: table ada? Kalau belum migration, seluruh query
    // aturan_poin ditolak PostgREST (404). Jangan biarkan itu terlihat
    // sebagai "data kosong"; bilang keadaannya.
    const { error: probe } = await supabase.from("aturan_poin").select("id").limit(1);
    if (probe) {
      setSiap(false);
      setMemuat(false);
      return;
    }
    const { data, error } = await ambilSemua<BarisAturanPoin>(
      (dari, sampai) =>
        supabase
          .from("aturan_poin")
          .select("id, mode, nominal, mulai, selesai, keterangan")
          .order("mulai", { ascending: true })
          .range(dari, sampai),
    );
    setSiap(true);
    setAturan((data ?? []) as BarisAturanPoin[]);
    if (error) catatGalat("muat aturan poin", error);
    setMemuat(false);
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      await muat();
      if (!aktif) return;
    })();
    return () => {
      aktif = false;
    };
  }, [muat]);

  const dapatUbah = peran === "admin";
  const berlakuHariIni = aturanAktif(aturan, HARI_INI());

  async function simpan() {
    const galat = validasiInputAturan(form, aturan);
    if (galat.length > 0) {
      toast.error(galat[0]);
      return;
    }
    setMenyimpan(true);
    const nominal =
      form.mode === "per_nominal"
        ? Number((form.nominal || "").replace(/[^0-9]/g, "")) || null
        : null;
    const { data: { id: userId } } = await supabase.auth.getUser();
    const { error } = await supabase.from("aturan_poin").insert({
      mode: form.mode as ModeAturan,
      nominal,
      mulai: form.mulai,
      selesai: form.selesai || null,
      dibuat_oleh: userId ?? null,
      keterangan: form.keterangan.trim() || null,
    });
    setMenyimpan(false);
    if (error) {
      // Trigger penjaga (tumpang tindih) mengembalikan 23514.
      if (String(error.message).includes("bertumpang")) {
        toast.error("Periode ini bertumpang tindih dengan aturan yang ada.");
        return;
      }
      catatGalat("simpan aturan poin", error);
      toast.error(pesanGalat(error, "Gagal menyimpan aturan poin."));
      return;
    }
    toast.success("Aturan poin tersimpan", {
      description: "Berlaku untuk transaksi pada periodenya. Poin lama tidak berubah.",
    });
    setFormTerbuka(false);
    setForm({
      mode: "per_kunjungan",
      mulai: HARI_INI(),
      selesai: "",
      nominal: "20000",
      keterangan: "",
    });
    await muat();
  }

  // ---------- State belum migration ----------
  if (siap === false) {
    return (
      <section className="rounded-xl border border-border bg-muted/30 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Aturan poin berversi belum aktif
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Jalankan{" "}
          <code className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs">
            supabase/aturan-poin.sql
          </code>{" "}
          di Supabase SQL Editor untuk membuka pengaturan ini. Sampai saat itu,
          poin tetap dihitung dengan model lama (1 poin per {rupiah.format(NOMINAL_FALLBACK)}).
        </p>
      </section>
    );
  }

  // ---------- Sedang memuat ----------
  if (memuat) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Memuat aturan poin...</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Coins className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Aturan poin</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dapatUbah
                ? "Bisa diubah admin; poin lama tidak dihitung ulang"
                : "Berdampak untuk poin transaksi baru, poin lama tetap tersimpan"}
            </p>
          </div>
        </div>
        {dapatUbah ? (
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setFormTerbuka((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            Atur periode
          </Button>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Lock className="h-3 w-3" />
            Baca saja
          </span>
        )}
      </div>

      {/* Form aturan baru (admin) */}
      {dapatUbah && formTerbuka && (
        <div className="border-b border-border bg-muted/20 px-5 py-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Periode baru
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mode poin</Label>
              <Select
                value={form.mode}
                onValueChange={(v) => setForm({ ...form, mode: v as ModeAturan })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_nominal">Per nominal</SelectItem>
                  <SelectItem value="per_kunjungan">Per kunjungan</SelectItem>
                  <SelectItem value="per_transaksi">Per transaksi</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {form.mode === "per_kunjungan"
                  ? "1 poin per pelanggan per tanggal. Kunjungan berikutnya di tanggal sama tetap dicatat, tapi tidak menambah poin."
                  : form.mode === "per_transaksi"
                    ? "Setiap transaksi yang tertaut pelanggan menghasilkan 1 poin."
                    : "Poin dihitung dari nilai nominal belanja sesuai aturan di bawah."}
              </p>
            </div>
            {form.mode === "per_nominal" && (
              <div className="space-y-1.5">
                <Label htmlFor="aturan-nominal">1 poin per (rupiah)</Label>
                <Input
                  id="aturan-nominal"
                  inputMode="numeric"
                  value={form.nominal}
                  onChange={(e) => setForm({ ...form, nominal: e.target.value })}
                  placeholder="20000"
                  className="h-10 tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Contoh: 20000 = 1 poin per Rp20.000.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="aturan-mulai">Berlaku mulai</Label>
              <Input
                id="aturan-mulai"
                type="date"
                value={form.mulai}
                onChange={(e) => setForm({ ...form, mulai: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aturan-selesai">Berlaku sampai (opsional)</Label>
              <Input
                id="aturan-selesai"
                type="date"
                value={form.selesai}
                min={form.mulai ? hariKedua(form.mulai) : undefined}
                onChange={(e) => setForm({ ...form, selesai: e.target.value })}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Kosongkan bila masih berlaku sampai saat ini.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="aturan-ket">Catatan (untuk riwayat)</Label>
              <Input
                id="aturan-ket"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Contoh: promo loyalitas bulan ini"
                className="h-10"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Periode yang tumpang tindih akan ditolak. Poin transaksi lama
              tetap memakai aturan yang berlaku saat tanggal transaksinya.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-9" onClick={() => setFormTerbuka(false)} disabled={menyimpan}>
                Batal
              </Button>
              <Button size="sm" className="h-9" onClick={simpan} disabled={menyimpan}>
                {menyimpan ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan aturan"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Aturan yang berlaku hari ini */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Berlaku saat ini
            </p>
            {berlakuHariIni ? (
              <>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {labelMode(berlakuHariIni.mode)}
                  {berlakuHariIni.nominal
                    ? ` · 1 poin per ${rupiah.format(berlakuHariIni.nominal)}`
                    : ""}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {deskripsiMode(berlakuHariIni)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold text-foreground">
                Model lama (1 poin per {rupiah.format(NOMINAL_FALLBACK)})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Daftar periode */}
      {aturan.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">
          Belum ada periode khusus. Poin dihitung dengan model lama.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {aturan.map((a) => (
            <li key={a.id} className="px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {labelMode(a.mode)}
                  {a.nominal ? ` · 1 poin per ${rupiah.format(a.nominal)}` : ""}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatTanggal(a.mulai)}
                  {a.selesai ? ` – ${formatTanggal(a.selesai)}` : " – masih berlaku"}
                </p>
              </div>
              {a.keterangan && (
                <p className="mt-0.5 text-xs text-muted-foreground">{a.keterangan}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

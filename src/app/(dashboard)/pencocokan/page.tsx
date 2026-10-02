"use client";

// ============================================================
// Halaman Pencocokan, Kataloji CRM
// ============================================================
// Daftar transaksi hasil impor Majoo yang belum berhasil
// tertaut ke pelanggan CRM (status_pencocokan = 'menunggu_pencocokan').
//
// Alur:
//   1. Admin melihat daftar transaksi pending, dengan
//      pengenal Majoo yang tersedia (kode + nama bila ada).
//   2. Pilih pelanggan yang benar dari daftar.
//   3. Sistem menghubungkan dan (di trigger database)
//      menerbitkan poin menurut aturan periode yang berlaku.
//
// Halaman ini tersembunyi dari non-admin (menu + guard di server).
// Notifikasi terpisah "Impor & Pencocokan" mengarahkan ke sini
// bila ada baris yang menunggu, supaya tidak bercampur dengan
// lonceng operasional (poin hangus / sepi / ultah).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  ShieldOff,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface BarisPending {
  id: string;
  external_ref: string | null;
  total: number;
  tanggal_majoo: string | null;
  kode_pelanggan_majoo: string | null;
  nama_pelanggan_majoo: string | null;
  metode_bayar: string | null;
  created_at: string;
}

interface Pelanggan {
  id: string;
  nama: string;
  whatsapp: string;
  kode_majoo: string | null;
  poin: number;
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function tanggalIsol(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function HalamanPencocokan() {
  const supabase = useMemo(() => createClient(), []);

  const [peran, setPeran] = useState<string | null>(null);
  const [daftar, setDaftar] = useState<BarisPending[]>([]);
  const [pelanggan, setPelanggan] = useState<Pelanggan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState<string | null>(null);
  const [sudah, setSudah] = useState<Set<string>>(new Set());

  const ambil = useCallback(async () => {
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

    if ((profil?.role as string) !== "admin") {
      setMemuat(false);
      return;
    }

    const res = await fetch("/api/pencocokan", { cache: "no-store" });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setGalat(json?.error ?? "Gagal memuat daftar pencocokan.");
      setMemuat(false);
      return;
    }
    const data = (await res.json()) as {
      menunggu: BarisPending[];
      pelanggan: Pelanggan[];
    };
    setDaftar(data.menunggu ?? []);
    setPelanggan(data.pelanggan ?? []);
    setGalat(null);
    setMemuat(false);
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const r = await ambil();
      if (aktif) void r;
    })();
    return () => {
      aktif = false;
    };
  }, [ambil]);

  const terfilter = useMemo(() => {
    if (!cari.trim()) return daftar;
    const k = cari.toLowerCase();
    return daftar.filter(
      (t) =>
        (t.external_ref ?? "").toLowerCase().includes(k) ||
        (t.kode_pelanggan_majoo ?? "").toLowerCase().includes(k) ||
        (t.nama_pelanggan_majoo ?? "").toLowerCase().includes(k),
    );
  }, [daftar, cari]);

  const pelangganTersaring = useMemo(() => {
    if (!cari.trim()) return pelanggan;
    const k = cari.toLowerCase();
    return pelanggan.filter(
      (p) =>
        p.nama.toLowerCase().includes(k) ||
        (p.kode_majoo ?? "").toLowerCase().includes(k),
    );
  }, [pelanggan, cari]);

  async function cocokkan(idTrx: string) {
    const pelangganId = pilih[idTrx];
    if (!pelangganId) {
      toast.error("Pilih pelanggan dulu sebelum memproses.");
      return;
    }
    setMenyimpan(idTrx);
    const res = await fetch("/api/pencocokan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaksi_id: idTrx,
        pelanggan_id: pelangganId,
      }),
    });
    setMenyimpan(null);
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; pelanggan?: string; error?: string }
      | null;
    if (!res.ok || !json?.ok) {
      toast.error(json?.error ?? "Gagal menghubungkan transaksi.");
      return;
    }
    setSudah((prev) => new Set(prev).add(idTrx));
    toast.success(`${json.pelanggan} terhubung`, {
      description: "Poin akan dihitung otomatis sesuai aturan periode.",
    });
    // Muat ulang daftar: baris ini seharusnya sudah hilang dari pending.
    await ambil();
  }

  // Guard tampilan non-admin (server API tetap jadi gerbang sesungguhnya).
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
            Mencocokkan transaksi impor Majoo ke pelanggan CRM hanya bisa
            dilakukan admin. Hubungi admin kalau ada transaksi yang perlu
            ditelusuri.
          </p>
        </div>
      </div>
    );
  }

  if (memuat) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-24">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Memuat daftar...</p>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Impor &amp; Pencocokan
        </h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
          Transaksi dari impor Majoo yang belum tertaut ke pelanggan CRM.
          Hubungkan satu per satu, poin akan diterbitkan otomatis menurut
          aturan periode yang berlaku.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nomor transaksi, kode, atau nama pelanggan"
            className="pl-9"
          />
        </div>
      </div>

      {galat && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{galat}</p>
        </div>
      )}

      {terfilter.length === 0 && !galat ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <p className="text-sm font-semibold">
            Tidak ada transaksi menunggu pencocokan.
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Semua transaksi impor Majoo sudah tertaut ke pelanggan, atau
            memang tercatat sebagai transaksi anonim (tanpa identitas).
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Transaksi</span>
            <span>Pengenal Majoo</span>
            <span>Pelanggan CRM</span>
            <span className="text-right">Aksi</span>
          </div>
          <ul className="divide-y divide-border">
            {terfilter.map((t) => {
              const selesai = sudah.has(t.id);
              return (
                <li key={t.id} className="px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {t.external_ref ?? t.id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rupiah.format(t.total)}
                        {t.tanggal_majoo ? ` · ${tanggalIsol(t.tanggal_majoo)}` : ""}
                        {t.metode_bayar ? ` · ${t.metode_bayar}` : ""}
                      </p>
                    </div>
                    <div>
                      {t.kode_pelanggan_majoo || t.nama_pelanggan_majoo ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.kode_pelanggan_majoo && (
                            <Badge variant="secondary" className="tabular-nums">
                              {t.kode_pelanggan_majoo}
                            </Badge>
                          )}
                          {t.nama_pelanggan_majoo && (
                            <span className="text-xs text-muted-foreground">
                              {t.nama_pelanggan_majoo}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Tanpa identitas
                        </span>
                      )}
                    </div>
                    <select
                      value={pilih[t.id] ?? ""}
                      onChange={(e) =>
                        setPilih((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      disabled={selesai}
                      className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                      aria-label="Pilih pelanggan untuk transaksi ini"
                    >
                      <option value="">
                        {pelangganTersaring.length
                          ? "Pilih pelanggan..."
                          : "Tidak ada pelanggan cocok"}
                      </option>
                      {pelangganTersaring.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                          {p.kode_majoo ? ` (${p.kode_majoo})` : ""} · {p.whatsapp}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-end gap-2">
                      {selesai ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <UserCheck className="h-4 w-4" />
                          Tersambung
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="h-9"
                          onClick={() => cocokkan(t.id)}
                          disabled={!pilih[t.id] || menyimpan === t.id}
                        >
                          {menyimpan === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Cocokkan"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

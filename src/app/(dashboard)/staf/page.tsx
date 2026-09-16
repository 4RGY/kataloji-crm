"use client";

import { useCallback, useEffect, useState } from "react";
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
import { DialogKonfirmasi } from "@/components/dialog-konfirmasi";
import { createClient } from "@/lib/supabase/client";
import {
  KETERANGAN_ROLE,
  LABEL_ROLE,
  ROLE_VALID,
  inisial,
  validasiStafBaru,
  validasiUbahStaf,
} from "@/lib/staf";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Staf {
  id: string;
  nama: string;
  role: string;
  email: string;
  email_terkonfirmasi: boolean;
  created_at: string;
  diri_sendiri: boolean;
}

const BARU_KOSONG = { nama: "", email: "", password: "", role: "kasir" };

/** timestamp ISO -> "14 Sep 2026" */
function tanggalSingkat(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Halaman kelola akun staf. Hanya admin.
 *
 * Halaman ini memanggil route /api/staf, bukan Supabase langsung, karena
 * membuat akun berarti membuat user di Supabase Auth dan itu butuh kunci
 * service role yang tidak boleh ada di peramban.
 */
export default function StafPage() {
  const [daftar, setDaftar] = useState<Staf[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  // null = belum diketahui, true/false = hasil pemeriksaan.
  // Selama belum diketahui, panel kelola tidak ditampilkan sama sekali.
  const [bolehKelola, setBolehKelola] = useState<boolean | null>(null);
  const [roleSendiri, setRoleSendiri] = useState<string | null>(null);

  const [sheetBaru, setSheetBaru] = useState(false);
  const [formBaru, setFormBaru] = useState(BARU_KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);

  const [sheetUbah, setSheetUbah] = useState<Staf | null>(null);
  const [formUbah, setFormUbah] = useState({ nama: "", role: "kasir" });

  const [sibukId, setSibukId] = useState<string | null>(null);

  const ambilDaftar = useCallback(async () => {
    const res = await fetch("/api/staf", { cache: "no-store" });
    const json = await res.json();

    // 403 berarti yang membuka bukan admin. Halaman ini tidak menyembunyikan
    // datanya saja, tetapi juga tidak menampilkan tombol yang pasti gagal.
    // Tanpa pemeriksaan ini, kasir bisa membuka /staf dan melihat panel
    // kelola kosong dengan tombol "Tambah akun" yang selalu ditolak server.
    if (res.status === 403) {
      setBolehKelola(false);
      setGalat(null);
      setDaftar([]);
      return;
    }

    if (!res.ok) {
      setBolehKelola(true);
      setGalat(json.error ?? "Gagal memuat daftar staf.");
      setDaftar([]);
      return;
    }
    setBolehKelola(true);
    setGalat(null);
    setDaftar(json.data ?? []);
  }, []);

  useEffect(() => {
    let aktif = true;
    (async () => {
      // Peran sendiri dibaca terpisah supaya tetap diketahui walau daftar
      // staf ditolak (kasir tidak boleh membaca daftar seluruh staf).
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
        if (aktif) setRoleSendiri((data?.role as string) ?? null);
      }

      await ambilDaftar();
      if (aktif) setMemuat(false);
    })();
    return () => {
      aktif = false;
    };
  }, [ambilDaftar]);

  async function muatUlang() {
    setMemuat(true);
    await ambilDaftar();
    setMemuat(false);
  }

  async function simpanBaru() {
    const pesan = validasiStafBaru(formBaru);
    if (pesan.length > 0) {
      toast.error(pesan[0]);
      return;
    }

    setMenyimpan(true);
    try {
      const res = await fetch("/api/staf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formBaru),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Akun gagal dibuat.");
        return;
      }

      toast.success(`Akun ${formBaru.nama} dibuat`, {
        description: `Peran ${LABEL_ROLE[formBaru.role] ?? formBaru.role}. Bisa langsung dipakai masuk.`,
      });
      setSheetBaru(false);
      setFormBaru(BARU_KOSONG);
      await muatUlang();
    } catch {
      toast.error("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function simpanUbah() {
    if (!sheetUbah) return;

    const pesan = validasiUbahStaf(formUbah);
    if (pesan.length > 0) {
      toast.error(pesan[0]);
      return;
    }

    setMenyimpan(true);
    try {
      const res = await fetch("/api/staf", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheetUbah.id, ...formUbah }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Perubahan gagal disimpan.");
        return;
      }

      toast.success("Perubahan disimpan");
      setSheetUbah(null);
      await muatUlang();
    } catch {
      toast.error("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  /**
   * Menghapus akun mencabut akses masuk seseorang, dan itu tidak bisa
   * dibatalkan dari sini. Konfirmasinya lewat dialog aplikasi supaya tombol
   * yang merusak bisa diberi warna merah dan tidak menjadi tombol yang
   * terfokus lebih dulu, sehingga menekan Enter secara refleks tidak langsung
   * menghapus. window.confirm() tidak bisa melakukan keduanya.
   */
  const [calonHapus, setCalonHapus] = useState<Staf | null>(null);

  async function hapus(staf: Staf) {
    setSibukId(staf.id);
    try {
      const res = await fetch(`/api/staf?id=${encodeURIComponent(staf.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Akun gagal dihapus.");
        return;
      }

      setCalonHapus(null);
      toast.success(`Akun ${staf.nama} dihapus`);
      await muatUlang();
    } catch {
      toast.error("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSibukId(null);
    }
  }

  const jumlahAdmin = daftar.filter((s) => s.role === "admin").length;

  // Peran akun yang sedang membuka, dibaca dari baris profile miliknya
  // sendiri (policy "profile sendiri" mengizinkan ini). Dipakai hanya untuk
  // menjelaskan kenapa halaman ini tertutup bagi yang bukan admin.
  const peranSaya = daftar.find((s) => s.diri_sendiri)?.role ?? roleSendiri;
  const labelPeranSaya = peranSaya ? (LABEL_ROLE[peranSaya] ?? peranSaya) : "staf";

  // Selama jawaban server belum tiba, jangan tampilkan panel kelola apa pun.
  // Ini mencegah kedipan: sekejap tombol "Tambah akun" muncul untuk kasir
  // lalu hilang, dan itu terbaca seolah kasir memang berhak.
  if (bolehKelola === null) {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Staf</h1>
        </header>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-24">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Memuat</span>
        </div>
      </div>
    );
  }

  // Bukan admin: jangan tampilkan panel kelola sama sekali. Server sudah
  // menolak (403), jadi menampilkan tombol hanya menyesatkan.
  if (bolehKelola === false) {
    return (
      <div className="px-6 pb-10 pt-4 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Staf</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola akun yang bisa masuk ke Kataloji CRM beserta perannya.
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold text-foreground">
            Halaman ini hanya untuk admin
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Akun Anda masuk sebagai {labelPeranSaya}.
            Pengelolaan akun staf hanya bisa dilakukan oleh admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Staf</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola akun yang bisa masuk ke Kataloji CRM beserta perannya.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setFormBaru(BARU_KOSONG);
            setSheetBaru(true);
          }}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Tambah akun
        </Button>
      </header>

      {/* Ringkasan peran: menjelaskan akibat tiap peran sebelum dipilih,
          supaya admin tidak menebak-nebak saat mengangkat staf. */}
      <section
        aria-label="Arti tiap peran"
        className="mb-5 grid gap-3 sm:grid-cols-3"
      >
        {ROLE_VALID.map((r) => (
          <div
            key={r}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground">
                {LABEL_ROLE[r]}
              </p>
              {/* Jumlah hanya ditampilkan kalau daftarnya benar-benar
                  terbaca. Menulis "0 akun" saat pemuatan gagal akan
                  terbaca sebagai "tidak ada staf", padahal artinya lain. */}
              <span className="text-xs tabular-nums text-muted-foreground">
                {memuat || galat
                  ? ""
                  : `${daftar.filter((s) => s.role === r).length} akun`}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {KETERANGAN_ROLE[r]}
            </p>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-6 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Akun terdaftar
          </p>
          <div className="flex items-center gap-3">
            <p className="text-xs tabular-nums text-muted-foreground">
              {daftar.length} akun
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 gap-1.5 px-3 text-xs"
              disabled={memuat}
              onClick={muatUlang}
            >
              <RefreshCw className={cn("h-3 w-3", memuat && "animate-spin")} />
              Muat ulang
            </Button>
          </div>
        </div>

        {memuat ? (
          <div className="flex items-center justify-center gap-2 bg-card px-6 py-20">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Memuat daftar staf…</p>
          </div>
        ) : galat ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-card px-6 py-20 text-center">
            <p className="max-w-md text-sm font-semibold text-foreground">
              {galat}
            </p>
            <Button variant="outline" size="sm" onClick={muatUlang}>
              Coba lagi
            </Button>
          </div>
        ) : daftar.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 bg-card px-6 py-20 text-center">
            <p className="text-sm font-semibold text-foreground">
              Belum ada akun staf
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Tambahkan akun kasir lewat tombol di atas supaya pegawai bisa
              mulai mencatat transaksi.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border bg-card">
            {daftar.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-1 gap-3 px-6 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.6fr)_1.4fr_auto] sm:items-center sm:gap-4"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-bold text-primary"
                  >
                    {inisial(s.nama)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {s.nama}
                      {s.diri_sendiri ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (akun Anda)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.email || "email tidak terbaca"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      s.role === "admin"
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.role === "admin" ? (
                      <ShieldCheck className="h-3 w-3" />
                    ) : null}
                    {LABEL_ROLE[s.role] ?? s.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    sejak {tanggalSingkat(s.created_at)}
                  </span>
                </div>

                {/* Jarak antar tombol dilebarkan karena yang kanan menghapus
                    akses seseorang. Dengan gap-2 (8px) dan tombol setinggi
                    32px, Ubah dan Hapus terlalu berdekatan untuk diketuk jari
                    di iPad. Sekarang keduanya 44px dengan jarak 12px. */}
                <div className="flex items-center gap-3 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 text-xs"
                    onClick={() => {
                      setSheetUbah(s);
                      setFormUbah({ nama: s.nama, role: s.role });
                    }}
                  >
                    Ubah
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 gap-1.5 px-3 text-xs text-muted-foreground hover:text-destructive"
                    disabled={sibukId === s.id || s.diri_sendiri}
                    title={
                      s.diri_sendiri
                        ? "Tidak bisa menghapus akun yang sedang Anda pakai"
                        : undefined
                    }
                    onClick={() => setCalonHapus(s)}
                  >
                    {sibukId === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {jumlahAdmin === 1 ? (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Saat ini hanya ada satu akun admin. Selama masih satu, akun itu tidak
          bisa dihapus atau diturunkan perannya, supaya tidak ada yang terkunci
          di luar aplikasi.
        </p>
      ) : null}

      {/* ---------- Sheet: tambah akun ---------- */}
      <Sheet open={sheetBaru} onOpenChange={setSheetBaru}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Tambah akun staf</SheetTitle>
            <SheetDescription>
              Akun langsung aktif tanpa perlu konfirmasi email, karena dibuat
              oleh admin untuk pegawai toko.
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              simpanBaru();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staf-nama">Nama staf</Label>
              <Input
                id="staf-nama"
                value={formBaru.nama}
                onChange={(e) =>
                  setFormBaru({ ...formBaru, nama: e.target.value })
                }
                placeholder="Contoh: Sinta"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staf-email">Email</Label>
              <Input
                id="staf-email"
                type="email"
                value={formBaru.email}
                onChange={(e) =>
                  setFormBaru({ ...formBaru, email: e.target.value })
                }
                placeholder="nama@kataloji.id"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staf-sandi">Kata sandi awal</Label>
              <Input
                id="staf-sandi"
                type="text"
                value={formBaru.password}
                onChange={(e) =>
                  setFormBaru({ ...formBaru, password: e.target.value })
                }
                placeholder="Minimal 8 karakter, huruf dan angka"
                autoComplete="off"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sampaikan kepada staf, lalu minta segera diganti. Ditampilkan
                terbuka supaya admin bisa menyalinnya tanpa salah ketik.
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Peran</legend>
              <div className="flex flex-col gap-2">
                {ROLE_VALID.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                      formBaru.role === r
                        ? "border-primary bg-primary/6"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="peran-baru"
                      value={r}
                      checked={formBaru.role === r}
                      onChange={() => setFormBaru({ ...formBaru, role: r })}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        {LABEL_ROLE[r]}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {KETERANGAN_ROLE[r]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <SheetFooter className="mt-auto px-0">
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={menyimpan}
              >
                {menyimpan ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {menyimpan ? "Menyimpan…" : "Buat akun"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ---------- Sheet: ubah akun ---------- */}
      <Sheet
        open={sheetUbah !== null}
        onOpenChange={(buka) => {
          if (!buka) setSheetUbah(null);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Ubah akun staf</SheetTitle>
            <SheetDescription>
              {sheetUbah ? sheetUbah.email : ""}
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              simpanUbah();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ubah-nama">Nama staf</Label>
              <Input
                id="ubah-nama"
                value={formUbah.nama}
                onChange={(e) =>
                  setFormUbah({ ...formUbah, nama: e.target.value })
                }
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Peran</legend>
              {ROLE_VALID.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                    formUbah.role === r
                      ? "border-primary bg-primary/6"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="peran-ubah"
                    value={r}
                    checked={formUbah.role === r}
                    onChange={() => setFormUbah({ ...formUbah, role: r })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {LABEL_ROLE[r]}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {KETERANGAN_ROLE[r]}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <SheetFooter className="mt-auto px-0">
              <Button
                type="submit"
                className="w-full"
                disabled={menyimpan}
              >
                {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <DialogKonfirmasi
        terbuka={calonHapus !== null}
        onTutup={() => setCalonHapus(null)}
        judul={`Hapus akun ${calonHapus?.nama ?? ""}?`}
        keterangan={
          <>
            {calonHapus?.email} tidak akan bisa masuk lagi ke Kataloji CRM.
            Transaksi yang pernah dia catat tetap tersimpan beserta namanya,
            karena jejak pencatat tidak boleh hilang saat akunnya dihapus.
          </>
        }
        labelAksi="Hapus akun"
        merusak
        sedangProses={calonHapus !== null && sibukId === calonHapus.id}
        onKonfirmasi={() => {
          if (calonHapus) void hapus(calonHapus);
        }}
      />
    </div>
  );
}

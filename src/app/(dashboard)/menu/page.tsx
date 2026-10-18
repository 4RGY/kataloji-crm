"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pesanGalat } from "@/lib/pesan-galat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Coffee,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface MenuKategori {
  id: string;
  nama: string;
  urutan: number;
}

interface Menu {
  id: string;
  nama: string;
  harga: number;
  gambar_url: string | null;
  kategori_id: string | null;
  aktif: boolean;
  kategori_nama?: string;
}

interface Profil {
  nama: string;
  role: string;
  email: string;
}

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID");
}

export default function HalamanMenu() {
  const supabase = createClient();
  const [bolehKelola, setBolehKelola] = useState<boolean | null>(null);
  const [menuList, setMenuList] = useState<Menu[]>([]);
  const [kategoriList, setKategoriList] = useState<MenuKategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState("");
  const [filterKategori, setFilterKategori] = useState<string>("semua");
  const [sheetBuka, setSheetBuka] = useState(false);
  const [editMenu, setEditMenu] = useState<Menu | null>(null);
  const [hapusMenu, setHapusMenu] = useState<Menu | null>(null);
  const [nama, setNama] = useState("");
  const [harga, setHarga] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [gambarUrl, setGambarUrl] = useState("");
  const [aktif, setAktif] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  const muatProfil = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profilData } = await supabase
      .from("profile")
      .select("nama, role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profilData) {
      setBolehKelola((profilData as Profil).role === "admin" || (profilData as Profil).role === "manager");
    }
  }, [supabase]);

  const muatData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: menuData, error: menuErr } = await supabase
        .from("menu")
        .select("id, nama, harga, gambar_url, kategori_id, aktif")
        .order("nama");
      const { data: katData } = await supabase
        .from("menu_kategori")
        .select("id, nama, urutan")
        .order("urutan");

      if (menuErr) {
        toast.error(pesanGalat(menuErr, "Gagal memuat data menu"));
        setLoading(false);
        return;
      }
      const katMap = new Map(
        (katData || []).map((k: MenuKategori) => [k.id, k.nama]),
      );
      const menuDenganKategori = (menuData || []).map((m: Menu) => ({
        ...m,
        kategori_nama: m.kategori_id ? katMap.get(m.kategori_id) : null,
      }));
      setMenuList(menuDenganKategori);
      setKategoriList((katData || []) as MenuKategori[]);
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal memuat data menu"));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      await muatProfil();
      await muatData();
    })();
  }, [muatProfil, muatData]);

  const menuTampil = menuList.filter((m) => {
    const cocokCari = m.nama.toLowerCase().includes(cari.toLowerCase());
    const cocokKategori =
      filterKategori === "semua" || m.kategori_id === filterKategori;
    return cocokCari && cocokKategori;
  });

  function bukaTambah() {
    setEditMenu(null);
    setNama("");
    setHarga("");
    setKategoriId(kategoriList[0]?.id || "");
    setGambarUrl("");
    setAktif(true);
    setSheetBuka(true);
  }

  function bukaEdit(menu: Menu) {
    setEditMenu(menu);
    setNama(menu.nama);
    setHarga(String(menu.harga));
    setKategoriId(menu.kategori_id || "");
    setGambarUrl(menu.gambar_url || "");
    setAktif(menu.aktif);
    setSheetBuka(true);
  }

  async function simpan() {
    const namaTrim = nama.trim();
    if (!namaTrim) {
      toast.error("Nama menu wajib diisi");
      return;
    }
    const hargaNum = parseInt(harga.replace(/[^0-9]/g, "") || "0", 10);
    if (hargaNum <= 0) {
      toast.error("Harga harus lebih dari 0");
      return;
    }
    setMenyimpan(true);
    try {
      if (editMenu) {
        const { error } = await supabase
          .from("menu")
          .update({
            nama: namaTrim,
            harga: hargaNum,
            kategori_id: kategoriId || null,
            gambar_url: gambarUrl.trim() || null,
            aktif,
          })
          .eq("id", editMenu.id);
        if (error) throw error;
        toast.success("Menu diperbarui");
      } else {
        const { error } = await supabase.from("menu").insert({
          nama: namaTrim,
          harga: hargaNum,
          kategori_id: kategoriId || null,
          gambar_url: gambarUrl.trim() || null,
          aktif,
        });
        if (error) throw error;
        toast.success("Menu ditambahkan");
      }
      setSheetBuka(false);
      await muatData();
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menyimpan menu"));
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus() {
    if (!hapusMenu) return;
    try {
      const { error } = await supabase
        .from("menu")
        .delete()
        .eq("id", hapusMenu.id);
      if (error) throw error;
      toast.success("Menu dihapus");
      setHapusMenu(null);
      await muatData();
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menghapus menu"));
    }
  }

  if (bolehKelola === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bolehKelola === false) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <p className="text-base font-bold">Halaman ini hanya untuk admin dan manajer.</p>
        </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Menu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola menu yang tersedia di kasir. Tambah, ubah harga, atau
          nonaktifkan menu.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari menu"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterKategori === "semua" ? "default" : "outline"}
            size="sm"
            className="h-11"
            onClick={() => setFilterKategori("semua")}
          >
            Semua
          </Button>
          {kategoriList.map((k) => (
            <Button
              key={k.id}
              variant={
                filterKategori === k.id ? "default" : "outline"
              }
              size="sm"
              className="h-11"
              onClick={() => setFilterKategori(k.id)}
            >
              {k.nama}
            </Button>
          ))}
        </div>
        <Button onClick={bukaTambah} className="h-11">
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah menu
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : menuTampil.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
          <Coffee className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {cari || filterKategori !== "semua"
              ? "Tidak ada menu yang cocok."
              : "Belum ada menu. Tambahkan menu pertama."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {menuTampil.map((m) => (
            <div
              key={m.id}
              className={cn(
                "group relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30",
                !m.aktif && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold tracking-tight">
                    {m.nama}
                  </p>
                  {m.kategori_nama && (
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {m.kategori_nama}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xl font-extrabold tabular-nums text-primary">
                Rp {formatRupiah(m.harga)}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => bukaEdit(m)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-destructive hover:text-destructive"
                  onClick={() => setHapusMenu(m)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Hapus
                </Button>
              </div>
              {!m.aktif && (
                <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Nonaktif
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Total menu: {menuList.length}
      </p>

      {/* Sheet tambah/edit */}
      <Sheet open={sheetBuka} onOpenChange={setSheetBuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editMenu ? "Edit menu" : "Tambah menu"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama-menu">Nama menu</Label>
              <Input
                id="nama-menu"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Cappuccino"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="harga-menu">Harga (Rp)</Label>
              <Input
                id="harga-menu"
                value={harga}
                onChange={(e) =>
                  setHarga(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="25000"
                inputMode="numeric"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kategori-menu">Kategori</Label>
              <select
                id="kategori-menu"
                value={kategoriId}
                onChange={(e) => setKategoriId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Tanpa kategori</option>
                {kategoriList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gambar-menu">URL gambar (opsional)</Label>
              <Input
                id="gambar-menu"
                value={gambarUrl}
                onChange={(e) => setGambarUrl(e.target.value)}
                placeholder="https://..."
                className="h-11"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aktif-menu"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="aktif-menu" className="text-sm">
                Menu aktif (tampil di kasir)
              </Label>
            </div>
          </div>
          <SheetFooter>
            <Button
              onClick={simpan}
              disabled={menyimpan}
              className="h-11 w-full"
            >
              {menyimpan ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menyimpan
                </>
              ) : editMenu ? (
                "Simpan perubahan"
              ) : (
                "Tambah menu"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Dialog hapus */}
      <Dialog
        open={!!hapusMenu}
        onOpenChange={(o) => !o && setHapusMenu(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus menu?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Menu &quot;{hapusMenu?.nama}&quot; akan dihapus permanen.
            Transaksi yang sudah dicatat tetap menyimpan nama menu.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHapusMenu(null)}
              className="h-11"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={hapus}
              className="h-11"
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pesanGalat } from "@/lib/pesan-galat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
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

interface Promo {
  id: string;
  nama: string;
  tipe: string;
  nilai: number;
  syarat_min: number;
  aktif: boolean;
  berlaku_mulai: string | null;
  berlaku_sampai: string | null;
}

interface Profil {
  nama: string;
  role: string;
  email: string;
}

const LABEL_TIPE: Record<string, string> = {
  diskon_persen: "Diskon %",
  diskon_tetap: "Diskon Rp",
  bundle: "Bundle",
};

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID");
}

export default function HalamanPromo() {
  const supabase = createClient();
  const [bolehKelola, setBolehKelola] = useState<boolean | null>(null);
  const [promoList, setPromoList] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetBuka, setSheetBuka] = useState(false);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [hapusPromo, setHapusPromo] = useState<Promo | null>(null);
  const [nama, setNama] = useState("");
  const [tipe, setTipe] = useState("diskon_persen");
  const [nilai, setNilai] = useState("");
  const [syaratMin, setSyaratMin] = useState("");
  const [aktif, setAktif] = useState(true);
  const [berlakuMulai, setBerlakuMulai] = useState("");
  const [berlakuSampai, setBerlakuSampai] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const muatProfil = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profilData } = await supabase
      .from("profile")
      .select("nama, role, email")
      .eq("id", userData.user.id)
      .single();
    if (profilData) {
      setBolehKelola((profilData as Profil).role === "admin" || (profilData as Profil).role === "manager");
    }
  }, [supabase]);

  const muatData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(pesanGalat(error, "Gagal memuat data promo"));
      setLoading(false);
      return;
    }
    setPromoList((data || []) as Promo[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      await muatProfil();
      await muatData();
    })();
  }, [muatProfil, muatData]);

  function bukaTambah() {
    setEditPromo(null);
    setNama("");
    setTipe("diskon_persen");
    setNilai("");
    setSyaratMin("");
    setAktif(true);
    setBerlakuMulai("");
    setBerlakuSampai("");
    setSheetBuka(true);
  }

  function bukaEdit(promo: Promo) {
    setEditPromo(promo);
    setNama(promo.nama);
    setTipe(promo.tipe);
    setNilai(String(promo.nilai));
    setSyaratMin(String(promo.syarat_min));
    setAktif(promo.aktif);
    setBerlakuMulai(promo.berlaku_mulai || "");
    setBerlakuSampai(promo.berlaku_sampai || "");
    setSheetBuka(true);
  }

  async function simpan() {
    const namaTrim = nama.trim();
    if (!namaTrim) {
      toast.error("Nama promo wajib diisi");
      return;
    }
    const nilaiNum = parseInt(nilai.replace(/[^0-9]/g, "") || "0", 10);
    if (nilaiNum <= 0) {
      toast.error("Nilai promo harus lebih dari 0");
      return;
    }
    if (tipe === "diskon_persen" && nilaiNum > 100) {
      toast.error("Diskon persen tidak boleh lebih dari 100%");
      return;
    }
    setMenyimpan(true);
    try {
      const payload = {
        nama: namaTrim,
        tipe,
        nilai: nilaiNum,
        syarat_min: parseInt(syaratMin.replace(/[^0-9]/g, "") || "0", 10),
        aktif,
        berlaku_mulai: berlakuMulai || null,
        berlaku_sampai: berlakuSampai || null,
      };
      if (editPromo) {
        const { error } = await supabase
          .from("promo")
          .update(payload)
          .eq("id", editPromo.id);
        if (error) throw error;
        toast.success("Promo diperbarui");
      } else {
        const { error } = await supabase.from("promo").insert(payload);
        if (error) throw error;
        toast.success("Promo ditambahkan");
      }
      setSheetBuka(false);
      await muatData();
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menyimpan promo"));
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus() {
    if (!hapusPromo) return;
    try {
      const { error } = await supabase
        .from("promo")
        .delete()
        .eq("id", hapusPromo.id);
      if (error) throw error;
      toast.success("Promo dihapus");
      setHapusPromo(null);
      await muatData();
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menghapus promo"));
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
        <h1 className="text-2xl font-extrabold tracking-tight">Promo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola promo, diskon, dan bundle yang bisa dipakai di kasir.
        </p>
      </header>

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {promoList.filter((p) => p.aktif).length} promo aktif dari{" "}
          {promoList.length} total
        </p>
        <Button onClick={bukaTambah} className="h-11">
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah promo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : promoList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-20 text-center">
          <Tag className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Belum ada promo. Tambahkan promo pertama.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {promoList.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4",
                !p.aktif && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-bold tracking-tight">
                    {p.nama}
                  </p>
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {LABEL_TIPE[p.tipe] || p.tipe}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.tipe === "diskon_persen" &&
                    `Diskon ${p.nilai}% dari subtotal`}
                  {p.tipe === "diskon_tetap" &&
                    `Potongan Rp ${formatRupiah(p.nilai)}`}
                  {p.tipe === "bundle" &&
                    `Bundle: ${p.nilai} item`}
                  {p.syarat_min > 0 &&
                    `, min belanja Rp ${formatRupiah(p.syarat_min)}`}
                </p>
                {(p.berlaku_mulai || p.berlaku_sampai) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {p.berlaku_mulai || "..."}
                    {" s/d "}
                    {p.berlaku_sampai || "..."}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => bukaEdit(p)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-destructive hover:text-destructive"
                  onClick={() => setHapusPromo(p)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet tambah/edit */}
      <Sheet open={sheetBuka} onOpenChange={setSheetBuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editPromo ? "Edit promo" : "Tambah promo"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama-promo">Nama promo</Label>
              <Input
                id="nama-promo"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Diskon Happy Hour"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipe-promo">Tipe</Label>
              <select
                id="tipe-promo"
                value={tipe}
                onChange={(e) => setTipe(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="diskon_persen">Diskon Persen (%)</option>
                <option value="diskon_tetap">Diskon Tetap (Rp)</option>
                <option value="bundle">Bundle</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nilai-promo">
                {tipe === "diskon_persen"
                  ? "Nilai diskon (%)"
                  : tipe === "diskon_tetap"
                    ? "Nilai diskon (Rp)"
                    : "Jumlah item bundle"}
              </Label>
              <Input
                id="nilai-promo"
                value={nilai}
                onChange={(e) =>
                  setNilai(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder={tipe === "diskon_persen" ? "10" : "5000"}
                inputMode="numeric"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="syarat-promo">
                Syarat minimum belanja (Rp, opsional)
              </Label>
              <Input
                id="syarat-promo"
                value={syaratMin}
                onChange={(e) =>
                  setSyaratMin(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
                inputMode="numeric"
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mulai">Berlaku mulai</Label>
                <Input
                  id="mulai"
                  type="date"
                  value={berlakuMulai}
                  onChange={(e) => setBerlakuMulai(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampai">Berlaku sampai</Label>
                <Input
                  id="sampai"
                  type="date"
                  value={berlakuSampai}
                  onChange={(e) => setBerlakuSampai(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aktif-promo"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="aktif-promo" className="text-sm">
                Promo aktif
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
              ) : editPromo ? (
                "Simpan perubahan"
              ) : (
                "Tambah promo"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Dialog hapus */}
      <Dialog
        open={!!hapusPromo}
        onOpenChange={(o) => !o && setHapusPromo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus promo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Promo &quot;{hapusPromo?.nama}&quot; akan dihapus permanen.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHapusPromo(null)}
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

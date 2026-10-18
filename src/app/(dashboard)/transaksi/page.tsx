"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pesanGalat } from "@/lib/pesan-galat";
import { formatWhatsapp, normalisasiWhatsapp, validasiPelanggan } from "@/lib/pelanggan";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Search,
  UserPlus,
  UserRound,
  X,
  ChevronDown,
  Minus,
  Plus,
  Trash2,
  Coffee,
  ReceiptText,
  Download,
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
import { DialogStruk, type DataStruk } from "@/components/dialog-struk";

// ---- Tipe ----
interface MenuKategori {
  id: string;
  nama: string;
  urutan: number;
}

interface Menu {
  id: string;
  nama: string;
  harga: number;
  kategori_id: string | null;
}

interface ItemKeranjang {
  menu_id: string;
  nama: string;
  harga: number;
  qty: number;
}

interface Pelanggan {
  id: string;
  nama: string;
  whatsapp: string | null;
  poin: number;
}

interface Promo {
  id: string;
  nama: string;
  tipe: string;
  nilai: number;
  syarat_min: number;
}

interface Transaksi {
  id: string;
  total: number;
  no_nota: string | null;
  metode_bayar: string;
  created_at: string;
  pelanggan: { nama: string } | null;
}

const NILAI_POIN = 1000;

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID");
}

function waktuRingkas(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransaksiPage() {
  const supabase = createClient();

  // Data dari DB
  const [menuList, setMenuList] = useState<Menu[]>([]);
  const [kategoriList, setKategoriList] = useState<MenuKategori[]>([]);
  const [promoList, setPromoList] = useState<Promo[]>([]);
  const [ppnPersen, setPpnPersen] = useState(10);
  const [biayaLayananPersen, setBiayaLayananPersen] = useState(5);
  const [loading, setLoading] = useState(true);

  // UI state
  const [cari, setCari] = useState("");
  const [filterKategori, setFilterKategori] = useState("semua");
  const [keranjang, setKeranjang] = useState<ItemKeranjang[]>([]);

  // Pelanggan
  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null);
  const [cariTerbuka, setCariTerbuka] = useState(false);
  const [kandidat, setKandidat] = useState<Pelanggan[]>([]);
  const [kataKunci, setKataKunci] = useState("");
  const [mencari, setMencari] = useState(false);
  const [pelangganBaruTerbuka, setPelangganBaruTerbuka] = useState(false);
  const [formBaru, setFormBaru] = useState({ nama: "", whatsapp: "", tgl_lahir: "" });
  const [menyimpanBaru, setMenyimpanBaru] = useState(false);

  // Diskon & poin
  const [diskon, setDiskon] = useState(0);
  const [poinDipakai, setPoinDipakai] = useState(0);
  const [promoTerpilih, setPromoTerpilih] = useState<Promo | null>(null);

  // Pembayaran
  const [metodeBayar, setMetodeBayar] = useState<"tunai" | "debit" | "qris">("tunai");
  const [jumlahBayar, setJumlahBayar] = useState(0);

  // Simpan
  const [menyimpan, setMenyimpan] = useState(false);

  // Struk
  const [strukData, setStrukData] = useState<DataStruk | null>(null);
  const [strukBuka, setStrukBuka] = useState(false);

  // Riwayat
  const [riwayat, setRiwayat] = useState<Transaksi[]>([]);
  const [memuatRiwayat, setMemuatRiwayat] = useState(true);
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(true);

  // ---- Hitungan ----
  const subtotal = useMemo(
    () => keranjang.reduce((sum, item) => sum + item.harga * item.qty, 0),
    [keranjang],
  );

  const ppn = useMemo(
    () => Math.round((subtotal * ppnPersen) / 100),
    [subtotal, ppnPersen],
  );

  const biayaLayanan = useMemo(
    () => Math.round((subtotal * biayaLayananPersen) / 100),
    [subtotal, biayaLayananPersen],
  );

  const potonganPoin = poinDipakai * NILAI_POIN;

  const total = useMemo(
    () => Math.max(0, subtotal - diskon + ppn + biayaLayanan - potonganPoin),
    [subtotal, diskon, ppn, biayaLayanan, potonganPoin],
  );

  const kembalian = metodeBayar === "tunai" ? Math.max(0, jumlahBayar - total) : 0;

  const bolehSimpan = keranjang.length > 0 && (metodeBayar !== "tunai" || jumlahBayar >= total);

  // ---- Load data ----
  const muatData = useCallback(async () => {
    setLoading(true);
    const [menuRes, katRes, promoRes, setRes] = await Promise.all([
      supabase.from("menu").select("id, nama, harga, kategori_id").eq("aktif", true).order("nama"),
      supabase.from("menu_kategori").select("id, nama, urutan").order("urutan"),
      supabase.from("promo").select("id, nama, tipe, nilai, syarat_min").eq("aktif", true).order("nama"),
      supabase.from("settings").select("key, value").in("key", ["ppn_persen", "biaya_layanan_persen"]),
    ]);

    setMenuList((menuRes.data || []) as Menu[]);
    setKategoriList((katRes.data || []) as MenuKategori[]);
    setPromoList((promoRes.data || []) as Promo[]);
    for (const s of setRes.data || []) {
      if (s.key === "ppn_persen") setPpnPersen(parseInt(s.value) || 10);
      if (s.key === "biaya_layanan_persen") setBiayaLayananPersen(parseInt(s.value) || 5);
    }
    setLoading(false);
  }, [supabase]);

  const ambilRiwayat = useCallback(async () => {
    setMemuatRiwayat(true);
    const { data } = await supabase
      .from("transaksi")
      .select("id, total, no_nota, metode_bayar, created_at, pelanggan(nama)")
      .order("created_at", { ascending: false })
      .limit(5);
    setRiwayat((data || []) as unknown as Transaksi[]);
    setMemuatRiwayat(false);
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      await muatData();
      if (!aktif) return;
      await ambilRiwayat();
    })();
    return () => { aktif = false; };
  }, [muatData, ambilRiwayat]);

  // ---- Keranjang ----
  function tambahMenu(menu: Menu) {
    setKeranjang((prev) => {
      const idx = prev.findIndex((i) => i.menu_id === menu.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { menu_id: menu.id, nama: menu.nama, harga: menu.harga, qty: 1 }];
    });
  }

  function ubahQty(menuId: string, delta: number) {
    setKeranjang((prev) =>
      prev
        .map((i) =>
          i.menu_id === menuId ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  }

  function hapusItem(menuId: string) {
    setKeranjang((prev) => prev.filter((i) => i.menu_id !== menuId));
  }

  function resetForm() {
    setKeranjang([]);
    setPelanggan(null);
    setDiskon(0);
    setPoinDipakai(0);
    setPromoTerpilih(null);
    setJumlahBayar(0);
    setMetodeBayar("tunai");
  }

  // ---- Pelanggan search ----
  async function cariPelanggan() {
    if (!kataKunci.trim()) return;
    setMencari(true);
    const { data } = await supabase
      .from("pelanggan")
      .select("id, nama, whatsapp, poin")
      .or(`nama.ilike.%${kataKunci.trim()}%,whatsapp.ilike.%${kataKunci.trim()}%`)
      .limit(10);
    setKandidat((data || []) as Pelanggan[]);
    setMencari(false);
  }

  async function simpanPelangganBaru(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      nama: formBaru.nama,
      whatsapp: normalisasiWhatsapp(formBaru.whatsapp),
      tgl_lahir: formBaru.tgl_lahir || "",
    };
    const pesan = validasiPelanggan(input);
    if (pesan.length > 0) {
      toast.error(pesan[0]);
      return;
    }
    setMenyimpanBaru(true);
    try {
      const { data, error } = await supabase
        .from("pelanggan")
        .insert({ nama: input.nama, whatsapp: input.whatsapp, tanggal_lahir: input.tgl_lahir || null })
        .select("id, nama, whatsapp, poin")
        .single();
      if (error) throw error;
      setPelanggan(data as Pelanggan);
      setPelangganBaruTerbuka(false);
      setFormBaru({ nama: "", whatsapp: "", tgl_lahir: "" });
      toast.success(`Pelanggan ${data.nama} ditambahkan`);
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menambah pelanggan"));
    } finally {
      setMenyimpanBaru(false);
    }
  }

  // ---- Promo ----
  function pilihPromo(promo: Promo | null) {
    setPromoTerpilih(promo);
    if (!promo) {
      setDiskon(0);
      return;
    }
    if (promo.tipe === "diskon_persen") {
      setDiskon(Math.round((subtotal * promo.nilai) / 100));
    } else if (promo.tipe === "diskon_tetap") {
      setDiskon(promo.nilai);
    } else {
      setDiskon(0);
    }
  }

  // ---- Simpan transaksi ----
  async function simpanTransaksi() {
    if (!bolehSimpan) return;
    setMenyimpan(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profilData } = userData.user
        ? await supabase.from("profile").select("nama").eq("id", userData.user.id).maybeSingle()
        : { data: null };

      const payload = {
        pelanggan_id: pelanggan?.id ?? null,
        subtotal,
        diskon,
        ppn,
        biaya_layanan: biayaLayanan,
        total,
        poin_dipakai: poinDipakai,
        source: "crm_pos",
        metode_bayar: metodeBayar,
        jumlah_bayar: metodeBayar === "tunai" ? jumlahBayar : total,
        kembalian: metodeBayar === "tunai" ? kembalian : 0,
        items: keranjang.map((i) => ({ menu_id: i.menu_id, nama: i.nama, qty: i.qty, harga_satuan: i.harga, subtotal: i.harga * i.qty })),
        dicatat_oleh: userData.user?.id ?? null,
        dicatat_oleh_nama: profilData?.nama ?? null,
        dicatat_pada: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("transaksi")
        .insert(payload)
        .select("id, no_nota, poin_didapat")
        .single();

      if (error) throw error;

      // Insert transaksi_item
      if (data) {
        const items = keranjang.map((i) => ({
          transaksi_id: data.id,
          menu_id: i.menu_id,
          nama: i.nama,
          qty: i.qty,
          harga_satuan: i.harga,
          subtotal: i.harga * i.qty,
        }));
        await supabase.from("transaksi_item").insert(items);
      }

      toast.success(
        pelanggan
          ? `Tersimpan. ${pelanggan.nama} dapat ${data.poin_didapat} poin.`
          : "Transaksi tersimpan.",
        { description: `Rp ${formatRupiah(total)} · ${data.no_nota}` },
      );

      // Buka dialog struk
      const { data: strukSettings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["struk_nama", "struk_alamat", "struk_wifi_nama", "struk_wifi_pass", "struk_instagram", "struk_footer"]);

      const sm = new Map<string, string>(
        (strukSettings || []).map((s: { key: string; value: string }) => [s.key, s.value]),
      );

      setStrukData({
        no_nota: data.no_nota || "",
        waktu: new Date().toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        items: keranjang.map((i) => ({
          nama: i.nama,
          qty: i.qty,
          harga_satuan: i.harga,
          subtotal: i.harga * i.qty,
        })),
        subtotal,
        diskon,
        ppn,
        biaya_layanan: biayaLayanan,
        potongan_poin: potonganPoin,
        total,
        metode_bayar: metodeBayar,
        jumlah_bayar: metodeBayar === "tunai" ? jumlahBayar : total,
        kembalian,
        poin_didapat: data.poin_didapat,
        poin_dipakai: poinDipakai,
        nama_pelanggan: pelanggan?.nama ?? null,
        struk_nama: sm.get("struk_nama") || "Kataloji Coffee and Eatery",
        struk_alamat: sm.get("struk_alamat") || "",
        struk_wifi_nama: sm.get("struk_wifi_nama") || "",
        struk_wifi_pass: sm.get("struk_wifi_pass") || "",
        struk_instagram: sm.get("struk_instagram") || "",
        struk_footer: sm.get("struk_footer") || "",
      });
      setStrukBuka(true);

      resetForm();
      ambilRiwayat();
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menyimpan transaksi"));
    } finally {
      setMenyimpan(false);
    }
  }

  // Download struk dari transaksi riwayat (tanpa buka dialog)
  async function downloadStrukRiwayat(t: Transaksi) {
    try {
      // Fetch detail transaksi + items + settings
      const [{ data: trxDetail }, { data: items }, { data: strukSettings }] = await Promise.all([
        supabase.from("transaksi").select("subtotal, diskon, ppn, biaya_layanan, potongan_poin, poin_didapat, poin_dipakai, jumlah_bayar, kembalian").eq("id", t.id).maybeSingle(),
        supabase.from("transaksi_item").select("nama, qty, harga_satuan, subtotal").eq("transaksi_id", t.id),
        supabase.from("settings").select("key, value").in("key", ["struk_nama", "struk_alamat", "struk_wifi_nama", "struk_wifi_pass", "struk_instagram", "struk_footer"]),
      ]);

      const sm = new Map<string, string>(
        (strukSettings || []).map((s: { key: string; value: string }) => [s.key, s.value]),
      );

      const dataStruk: DataStruk = {
        no_nota: t.no_nota || "",
        waktu: new Date(t.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }),
        items: (items || []).map((i: { nama: string; qty: number; harga_satuan: number; subtotal: number }) => ({ nama: i.nama, qty: i.qty, harga_satuan: i.harga_satuan, subtotal: i.subtotal })),
        subtotal: trxDetail?.subtotal ?? t.total,
        diskon: trxDetail?.diskon ?? 0,
        ppn: trxDetail?.ppn ?? 0,
        biaya_layanan: trxDetail?.biaya_layanan ?? 0,
        potongan_poin: trxDetail?.potongan_poin ?? 0,
        total: t.total,
        metode_bayar: t.metode_bayar,
        jumlah_bayar: trxDetail?.jumlah_bayar ?? t.total,
        kembalian: trxDetail?.kembalian ?? 0,
        poin_didapat: trxDetail?.poin_didapat ?? 0,
        poin_dipakai: trxDetail?.poin_dipakai ?? 0,
        nama_pelanggan: t.pelanggan?.nama ?? null,
        struk_nama: sm.get("struk_nama") || "Kataloji Coffee and Eatery",
        struk_alamat: sm.get("struk_alamat") || "",
        struk_wifi_nama: sm.get("struk_wifi_nama") || "",
        struk_wifi_pass: sm.get("struk_wifi_pass") || "",
        struk_instagram: sm.get("struk_instagram") || "",
        struk_footer: sm.get("struk_footer") || "",
      };

      // Generate plain text struk
      const W2 = 42;
      const garis = "-".repeat(W2);
      const baris: string[] = [];
      baris.push(garis);
      baris.push(dataStruk.struk_nama);
      for (const line of dataStruk.struk_alamat.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) baris.push(trimmed);
      }
      baris.push(garis);
      baris.push(`No Nota       : ${dataStruk.no_nota}`);
      baris.push(`Waktu         : ${dataStruk.waktu}`);
      if (dataStruk.nama_pelanggan) {
        baris.push(`Pelanggan     : ${dataStruk.nama_pelanggan}`);
      }
      baris.push(garis);
      for (const item of dataStruk.items) {
        baris.push(`${item.qty}x  ${item.nama}`);
        baris.push(`    ${item.subtotal.toLocaleString("id-ID")}`);
      }
      baris.push(garis);
      baris.push(`Subtotal        ${dataStruk.subtotal.toLocaleString("id-ID")}`);
      if (dataStruk.diskon > 0) baris.push(`Diskon          -${dataStruk.diskon.toLocaleString("id-ID")}`);
      if (dataStruk.biaya_layanan > 0) baris.push(`Biaya Layanan   ${dataStruk.biaya_layanan.toLocaleString("id-ID")}`);
      if (dataStruk.ppn > 0) baris.push(`Pajak (PPN)     ${dataStruk.ppn.toLocaleString("id-ID")}`);
      if (dataStruk.potongan_poin > 0) baris.push(`Potongan Poin   -${dataStruk.potongan_poin.toLocaleString("id-ID")}`);
      baris.push(garis);
      baris.push(`TOTAL           ${dataStruk.total.toLocaleString("id-ID")}`);
      baris.push(garis);
      const metodeLabel = dataStruk.metode_bayar === "tunai" ? "Tunai" : dataStruk.metode_bayar === "debit" ? "Kartu Debit" : "QRIS";
      baris.push(`${metodeLabel.padEnd(16)} ${dataStruk.jumlah_bayar.toLocaleString("id-ID")}`);
      if (dataStruk.kembalian > 0) baris.push(`Kembalian       ${dataStruk.kembalian.toLocaleString("id-ID")}`);
      if (dataStruk.poin_didapat > 0 || dataStruk.poin_dipakai > 0) {
        baris.push(garis);
        if (dataStruk.poin_didapat > 0) baris.push(`Poin didapat    +${dataStruk.poin_didapat}`);
        if (dataStruk.poin_dipakai > 0) baris.push(`Poin dipakai    -${dataStruk.poin_dipakai}`);
      }
      baris.push(garis);
      if (dataStruk.struk_wifi_nama) baris.push(`WiFi: ${dataStruk.struk_wifi_nama}`);
      if (dataStruk.struk_wifi_pass) baris.push(`Pass: ${dataStruk.struk_wifi_pass}`);
      if (dataStruk.struk_instagram) baris.push(`IG: @${dataStruk.struk_instagram}`);
      if (dataStruk.struk_footer) baris.push(dataStruk.struk_footer);

      const teks = baris.join("\n");
      const blob = new Blob([teks], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `struk-${dataStruk.no_nota || t.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Struk ${dataStruk.no_nota || ""} terunduh`);
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal mengunduh struk"));
    }
  }

  // ---- Filter menu ----
  const menuTampil = menuList.filter((m) => {
    const cocokCari = m.nama.toLowerCase().includes(cari.toLowerCase());
    const cocokKategori = filterKategori === "semua" || m.kategori_id === filterKategori;
    return cocokCari && cocokKategori;
  });

  const NOMINAL_CEPAT = [10000, 20000, 50000, 100000];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-3 lg:px-6">
      <div className="grid lg:grid-cols-[1fr_380px] gap-3">
        {/* ===== KOLOM KIRI: MENU GRID ===== */}
        <div className="space-y-3">
          <header className="flex items-center justify-between gap-3">
            <h1 className="font-heading text-xl font-extrabold tracking-tight">Kasir</h1>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[140px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari menu"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <Button
              variant={filterKategori === "semua" ? "default" : "outline"}
              size="sm"
              className="h-10"
              onClick={() => setFilterKategori("semua")}
            >
              Semua
            </Button>
            {kategoriList.map((k) => (
              <Button
                key={k.id}
                variant={filterKategori === k.id ? "default" : "outline"}
                size="sm"
                className="h-10"
                onClick={() => setFilterKategori(k.id)}
              >
                {k.nama}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {menuTampil.map((m) => (
              <button
                key={m.id}
                onClick={() => tambahMenu(m)}
                className="flex min-h-[72px] flex-col justify-between rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex items-start gap-1.5">
                  <Coffee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-[13px] font-bold leading-tight">{m.nama}</span>
                </div>
                <span className="mt-1 text-sm font-extrabold tabular-nums text-primary">
                  {formatRupiah(m.harga)}
                </span>
              </button>
            ))}
          </div>

          {menuTampil.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
              <Coffee className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Menu tidak ditemukan.</p>
            </div>
          )}
        </div>

        {/* ===== KOLOM KANAN: KERANJANG + CHECKOUT (STICKY) ===== */}
        <div className="space-y-2.5 lg:sticky lg:top-2 lg:self-start lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto">
          {/* Pelanggan */}
          <div className="rounded-lg border border-border bg-card p-2.5">
            {pelanggan ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold">{pelanggan.nama}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {pelanggan.poin} poin
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0"
                  onClick={() => setPelanggan(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => setCariTerbuka(true)}
                >
                  <Search className="mr-1 h-3.5 w-3.5" />
                  Cari pelanggan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPelangganBaruTerbuka(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Keranjang */}
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="mb-1.5 text-[13px] font-bold tracking-tight">Keranjang</p>
            {keranjang.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <ReceiptText className="h-5 w-5 text-muted-foreground/60" />
                <p className="text-[11px] text-muted-foreground">
                  Pilih menu di kiri untuk mulai.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {keranjang.map((item) => (
                  <div
                    key={item.menu_id}
                    className="flex items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{item.nama}</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {formatRupiah(item.harga)} x {item.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => ubahQty(item.menu_id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-[13px] font-bold tabular-nums">
                        {item.qty}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => ubahQty(item.menu_id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => hapusItem(item.menu_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ringkasan + Pembayaran (gabung jadi 1 kartu) */}
          {keranjang.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-semibold">{formatRupiah(subtotal)}</span>
                </div>

                {/* Promo selector */}
                {promoList.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Promo</span>
                    <select
                      value={promoTerpilih?.id || ""}
                      onChange={(e) => {
                        const p = promoList.find((x) => x.id === e.target.value);
                        pilihPromo(p || null);
                      }}
                      className="h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Tanpa promo</option>
                      {promoList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {diskon > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Diskon</span>
                    <span className="tabular-nums font-semibold">-{formatRupiah(diskon)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PPN ({ppnPersen}%)</span>
                  <span className="tabular-nums">{formatRupiah(ppn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Biaya ({biayaLayananPersen}%)</span>
                  <span className="tabular-nums">{formatRupiah(biayaLayanan)}</span>
                </div>

                {/* Poin redeem */}
                {pelanggan && pelanggan.poin >= 5 && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-muted-foreground">Poin dipakai</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setPoinDipakai(Math.max(0, poinDipakai - 1))}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-bold tabular-nums">
                        {poinDipakai}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          setPoinDipakai(Math.min(Math.floor(total / NILAI_POIN), Math.min(pelanggan.poin, poinDipakai + 1)))
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {potonganPoin > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Potongan poin</span>
                    <span className="tabular-nums font-semibold">-{formatRupiah(potonganPoin)}</span>
                  </div>
                )}
              </div>

              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <span className="text-sm font-extrabold">Total</span>
                <span className="text-lg font-extrabold tabular-nums text-primary">
                  {formatRupiah(total)}
                </span>
              </div>

              {/* Pembayaran inline, bukan kartu terpisah */}
              <div className="mt-2.5 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {(["tunai", "debit", "qris"] as const).map((m) => (
                    <Button
                      key={m}
                      variant={metodeBayar === m ? "default" : "outline"}
                      size="sm"
                      className="h-9 capitalize"
                      onClick={() => {
                        setMetodeBayar(m);
                        if (m !== "tunai") setJumlahBayar(0);
                      }}
                    >
                      {m === "tunai" ? "Tunai" : m === "debit" ? "Debit" : "QRIS"}
                    </Button>
                  ))}
                </div>

                {metodeBayar === "tunai" && (
                  <div className="space-y-1.5">
                    <Input
                      value={jumlahBayar ? String(jumlahBayar) : ""}
                      onChange={(e) => setJumlahBayar(parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10))}
                      placeholder={`Diterima: ${formatRupiah(total)}`}
                      inputMode="numeric"
                      className="h-10 text-base font-bold tabular-nums"
                    />
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setJumlahBayar(total)}
                      >
                        Uang pas
                      </Button>
                      {NOMINAL_CEPAT.map((n) => (
                        <Button
                          key={n}
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setJumlahBayar(jumlahBayar + n)}
                        >
                          +{formatRupiah(n)}
                        </Button>
                      ))}
                    </div>
                    {kembalian > 0 && (
                      <div className="flex justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
                        <span className="text-[13px] font-semibold">Kembalian</span>
                        <span className="text-sm font-extrabold tabular-nums text-primary">
                          {formatRupiah(kembalian)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={simpanTransaksi}
                  disabled={!bolehSimpan || menyimpan}
                  className="h-11 w-full text-sm font-bold"
                >
                  {menyimpan ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Menyimpan
                    </>
                  ) : (
                    <>Simpan · {formatRupiah(total)}</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== RIWAYAT TRANSAKSI ===== */}
      <div className="mt-4">
        <button
          onClick={() => setRiwayatTerbuka(!riwayatTerbuka)}
          className="flex w-full items-center gap-2 text-[13px] font-bold tracking-tight text-muted-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", !riwayatTerbuka && "-rotate-90")}
          />
          Transaksi terakhir
        </button>
        {riwayatTerbuka && (
          <div className="mt-2 space-y-1.5">
            {memuatRiwayat ? (
              <p className="text-[13px] text-muted-foreground">Memuat...</p>
            ) : riwayat.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Belum ada transaksi.</p>
            ) : (
              riwayat.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">
                      {t.pelanggan?.nama || "Tanpa pelanggan"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.no_nota || "-"} · {waktuRingkas(t.created_at)} · {t.metode_bayar}
                    </p>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadStrukRiwayat(t)}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Unduh struk"
                    >
                      <Download className="h-3 w-3" />
                      Struk
                    </button>
                    <span className="text-[13px] font-bold tabular-nums">
                      {formatRupiah(t.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ===== SHEET: CARI PELANGGAN ===== */}
      <Sheet open={cariTerbuka} onOpenChange={setCariTerbuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Cari pelanggan</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-2">
              <Input
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cariPelanggan()}
                placeholder="Nama atau nomor WA"
                className="h-11"
              />
              <Button onClick={cariPelanggan} disabled={mencari} className="h-11">
                {mencari ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cari"}
              </Button>
            </div>
            <div className="space-y-2">
              {kandidat.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPelanggan(p);
                    setCariTerbuka(false);
                    setKandidat([]);
                    setKataKunci("");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-accent/30"
                >
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.nama}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.whatsapp ? formatWhatsapp(p.whatsapp) : "Tanpa WA"} · {p.poin} poin
                    </p>
                  </div>
                </button>
              ))}
              {kandidat.length === 0 && kataKunci && !mencari && (
                <p className="text-sm text-muted-foreground">
                  Tidak ditemukan. Tambah pelanggan baru?
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== SHEET: PELANGGAN BARU ===== */}
      <Sheet open={pelangganBaruTerbuka} onOpenChange={setPelangganBaruTerbuka}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Pelanggan baru</SheetTitle>
          </SheetHeader>
          <form onSubmit={simpanPelangganBaru} className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="baru-nama">Nama</Label>
              <Input
                id="baru-nama"
                value={formBaru.nama}
                onChange={(e) => setFormBaru({ ...formBaru, nama: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baru-wa">WhatsApp</Label>
              <Input
                id="baru-wa"
                value={formBaru.whatsapp}
                onChange={(e) => setFormBaru({ ...formBaru, whatsapp: e.target.value })}
                placeholder="08123456789"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baru-lahir">Tanggal lahir (opsional)</Label>
              <Input
                id="baru-lahir"
                type="date"
                value={formBaru.tgl_lahir}
                onChange={(e) => setFormBaru({ ...formBaru, tgl_lahir: e.target.value })}
                className="h-11"
              />
            </div>
            <SheetFooter>
              <Button type="submit" disabled={menyimpanBaru} className="h-11 w-full">
                {menyimpanBaru ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Menyimpan
                  </>
                ) : (
                  "Tambah pelanggan"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ===== DIALOG STRUK ===== */}
      <DialogStruk
        buka={strukBuka}
        onClose={() => setStrukBuka(false)}
        data={strukData}
      />
    </div>
  );
}

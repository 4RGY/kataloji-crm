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
  Flame,
  PauseCircle,
  Play,
  Wallet,
  Pencil,
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
  DialogDescription,
} from "@/components/ui/dialog";
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
  catatan?: string;
}

interface BillDitahan {
  id: string;
  label: string;
  waktu: string;
  tipePesanan: "dine_in" | "takeaway";
  nomorMeja: string;
  keranjang: ItemKeranjang[];
  pelanggan: Pelanggan | null;
  diskon: number;
  poinDipakai: number;
  promoTerpilih: Promo | null;
  subtotal: number;
  total: number;
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

interface TransaksiItemJson {
  menu_id?: string;
  nama?: string;
  qty?: number;
  harga_satuan?: number;
  subtotal?: number;
  catatan?: string | null;
}

interface Transaksi {
  id: string;
  total: number;
  no_nota: string | null;
  metode_bayar: string;
  created_at: string;
  items?: TransaksiItemJson[] | null;
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

  // Tipe pesanan (Dine In / Takeaway) & Meja
  const [tipePesanan, setTipePesanan] = useState<"dine_in" | "takeaway">("dine_in");
  const [nomorMeja, setNomorMeja] = useState("");

  // Pembayaran
  const [metodeBayar, setMetodeBayar] = useState<"tunai" | "debit" | "qris">("tunai");
  const [jumlahBayar, setJumlahBayar] = useState(0);

  // Simpan
  const [menyimpan, setMenyimpan] = useState(false);

  // Struk
  const [strukData, setStrukData] = useState<DataStruk | null>(null);
  const [strukBuka, setStrukBuka] = useState(false);

  // Fitur 1: Catatan / Modifier item
  const [dialogCatatanBuka, setDialogCatatanBuka] = useState(false);
  const [catatanIndex, setCatatanIndex] = useState<number | null>(null);
  const [teksCatatan, setTeksCatatan] = useState("");
  const CHIP_CATATAN = ["Dingin (Ice)", "Panas (Hot)", "Less Sugar (50%)", "No Sugar", "Gula Pisah", "Extra Shot"];

  // Fitur 2: Tahan Bill (Hold / Park Order)
  const [billsDitahan, setBillsDitahan] = useState<BillDitahan[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("kataloji_bills_ditahan");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dialogDitahanBuka, setDialogDitahanBuka] = useState(false);

  // Fitur 3: Kas Kecil (Petty Cash Pengeluaran)
  const [kasKeluarBuka, setKasKeluarBuka] = useState(false);
  const [nominalKas, setNominalKas] = useState("");
  const [kategoriKas, setKategoriKas] = useState("Bahan Baku");
  const [keteranganKas, setKeteranganKas] = useState("");
  const [loadingKas, setLoadingKas] = useState(false);
  const [totalKasKeluarHariIni, setTotalKasKeluarHariIni] = useState(0);
  const KATEGORI_KAS_KECIL = ["Bahan Baku", "Operasional", "Kebersihan", "Konsumsi", "Lainnya"];

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
      .select("id, total, no_nota, metode_bayar, created_at, items, pelanggan(nama)")
      .order("created_at", { ascending: false })
      .limit(30);
    setRiwayat((data || []) as unknown as Transaksi[]);
    setMemuatRiwayat(false);
  }, [supabase]);

  // Muat kas kecil hari ini
  const ambilKasKecilHariIni = useCallback(async () => {
    try {
      const awalHari = new Date();
      awalHari.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("kas_kecil")
        .select("nominal")
        .gte("created_at", awalHari.toISOString());
      if (data) {
        const total = data.reduce((acc: number, r: { nominal: number }) => acc + (r.nominal || 0), 0);
        setTotalKasKeluarHariIni(total);
      }
    } catch {
      // Abaikan jika migrasi tabel belum dipasang
    }
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      await muatData();
      if (!aktif) return;
      await ambilRiwayat();
      await ambilKasKecilHariIni();
      try {
        const saved = localStorage.getItem("kataloji_bills_ditahan");
        if (saved && aktif) {
          setBillsDitahan(JSON.parse(saved));
        }
      } catch {
        // Abaikan error parse localStorage
      }
    })();

    return () => {
      aktif = false;
    };
  }, [muatData, ambilRiwayat, ambilKasKecilHariIni]);

  // Menu terlaris dari frekuensi transaksi riwayat (Fitur 4)
  const menuTerlarisIds = useMemo(() => {
    const frekuensi = new Map<string, number>();
    for (const trx of riwayat) {
      if (Array.isArray(trx.items)) {
        for (const it of trx.items) {
          if (it && it.menu_id) {
            frekuensi.set(it.menu_id, (frekuensi.get(it.menu_id) || 0) + (it.qty || 1));
          }
        }
      }
    }
    const sorted = [...frekuensi.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // Fallback ambil 6 menu teratas jika riwayat baru sedikit
    if (sorted.length < 4 && menuList.length > 0) {
      const defaults = menuList.slice(0, 6).map((m) => m.id);
      return Array.from(new Set([...sorted, ...defaults]));
    }
    return sorted.slice(0, 8);
  }, [riwayat, menuList]);

  // ---- Keranjang ----
  function tambahMenu(menu: Menu) {
    setKeranjang((prev) => {
      // Tambah qty jika item sama dan belum memiliki catatan khusus
      const idx = prev.findIndex((i) => i.menu_id === menu.id && !i.catatan);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { menu_id: menu.id, nama: menu.nama, harga: menu.harga, qty: 1 }];
    });
  }

  function ubahQtyByIndex(index: number, delta: number) {
    setKeranjang((prev) =>
      prev
        .map((item, idx) =>
          idx === index ? { ...item, qty: Math.max(0, item.qty + delta) } : item,
        )
        .filter((i) => i.qty > 0),
    );
  }

  function hapusItemByIndex(index: number) {
    setKeranjang((prev) => prev.filter((_, idx) => idx !== index));
  }

  // Fitur 1: Catatan / Modifier item
  function bukaDialogCatatan(index: number) {
    setCatatanIndex(index);
    setTeksCatatan(keranjang[index]?.catatan || "");
    setDialogCatatanBuka(true);
  }

  function simpanCatatanItem() {
    if (catatanIndex === null) return;
    setKeranjang((prev) =>
      prev.map((item, idx) =>
        idx === catatanIndex ? { ...item, catatan: teksCatatan.trim() || undefined } : item,
      ),
    );
    setDialogCatatanBuka(false);
    setCatatanIndex(null);
    setTeksCatatan("");
  }

  // Fitur 2: Tahan Bill & Pulihkan
  function tahanBill() {
    if (keranjang.length === 0) return;
    const label = pelanggan
      ? pelanggan.nama
      : `Antrean #${billsDitahan.length + 1} (${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })})`;

    const newBill: BillDitahan = {
      id: Date.now().toString(),
      label,
      waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      tipePesanan,
      nomorMeja,
      keranjang,
      pelanggan,
      diskon,
      poinDipakai,
      promoTerpilih,
      subtotal,
      total,
    };

    const nextBills = [newBill, ...billsDitahan];
    setBillsDitahan(nextBills);
    try {
      localStorage.setItem("kataloji_bills_ditahan", JSON.stringify(nextBills));
    } catch {}

    resetForm();
    toast.info(`Pesanan "${label}" ditahan sementara.`, {
      description: `${keranjang.length} item · Rp ${formatRupiah(total)}`,
    });
  }

  function pulihkanBill(bill: BillDitahan) {
    if (keranjang.length > 0) {
      if (!window.confirm("Keranjang kasir saat ini akan ditimpa dengan pesanan yang ditahan. Lanjutkan?")) {
        return;
      }
    }

    setKeranjang(bill.keranjang);
    setPelanggan(bill.pelanggan);
    setDiskon(bill.diskon);
    setPoinDipakai(bill.poinDipakai);
    setPromoTerpilih(bill.promoTerpilih);
    setTipePesanan(bill.tipePesanan || "dine_in");
    setNomorMeja(bill.nomorMeja || "");

    const sisa = billsDitahan.filter((b) => b.id !== bill.id);
    setBillsDitahan(sisa);
    try {
      localStorage.setItem("kataloji_bills_ditahan", JSON.stringify(sisa));
    } catch {}

    setDialogDitahanBuka(false);
    toast.success(`Pesanan "${bill.label}" dipulihkan ke kasir.`);
  }

  function hapusBillDitahan(id: string) {
    const sisa = billsDitahan.filter((b) => b.id !== id);
    setBillsDitahan(sisa);
    try {
      localStorage.setItem("kataloji_bills_ditahan", JSON.stringify(sisa));
    } catch {}
    toast.info("Pesanan ditahan dihapus.");
  }

  // Fitur 3: Simpan Kas Keluar (Petty Cash)
  async function simpanKasKeluar() {
    const nom = parseInt(nominalKas.replace(/\D/g, ""), 10);
    if (!nom || nom <= 0) {
      toast.error("Nominal kas keluar harus lebih dari 0.");
      return;
    }
    if (!keteranganKas.trim()) {
      toast.error("Keterangan kas keluar wajib diisi.");
      return;
    }

    setLoadingKas(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profilData } = userData.user
        ? await supabase.from("profile").select("nama").eq("id", userData.user.id).maybeSingle()
        : { data: null };

      const { error } = await supabase.from("kas_kecil").insert({
        nominal: nom,
        kategori: kategoriKas,
        keterangan: keteranganKas.trim(),
        dicatat_oleh: userData.user?.id ?? null,
        dicatat_oleh_nama: profilData?.nama ?? "Kasir",
      });

      if (error) {
        console.warn("Gagal simpan ke DB kas_kecil:", error.message);
      }

      setTotalKasKeluarHariIni((prev) => prev + nom);
      toast.success(`Kas keluar Rp ${formatRupiah(nom)} dicatat.`, {
        description: `${kategoriKas}: ${keteranganKas}`,
      });
      setKasKeluarBuka(false);
      setNominalKas("");
      setKeteranganKas("");
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal mencatat kas keluar"));
    } finally {
      setLoadingKas(false);
    }
  }

  function resetForm() {
    setKeranjang([]);
    setPelanggan(null);
    setDiskon(0);
    setPoinDipakai(0);
    setPromoTerpilih(null);
    setTipePesanan("dine_in");
    setNomorMeja("");
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
        items: keranjang.map((i) => ({
          menu_id: i.menu_id,
          nama: i.nama,
          qty: i.qty,
          harga_satuan: i.harga,
          subtotal: i.harga * i.qty,
          catatan: i.catatan || null,
        })),
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
          catatan: i.catatan || null,
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
        tipe_pesanan: tipePesanan,
        nomor_meja: tipePesanan === "dine_in" && nomorMeja.trim() ? nomorMeja.trim() : null,
        items: keranjang.map((i) => ({
          nama: i.nama,
          qty: i.qty,
          harga_satuan: i.harga,
          subtotal: i.harga * i.qty,
          catatan: i.catatan || null,
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
      if (dataStruk.tipe_pesanan) {
        const lbl = dataStruk.tipe_pesanan === "dine_in"
          ? (dataStruk.nomor_meja ? `Dine In (Meja ${dataStruk.nomor_meja})` : "Dine In")
          : "Take Away";
        baris.push(`Pesanan       : ${lbl}`);
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

  // ---- Filter menu (Termasuk Fitur 4: Terlaris) ----
  const menuTampil = useMemo(() => {
    return menuList.filter((m) => {
      const cocokCari = m.nama.toLowerCase().includes(cari.toLowerCase());
      if (filterKategori === "terlaris") {
        return cocokCari && menuTerlarisIds.includes(m.id);
      }
      const cocokKategori = filterKategori === "semua" || m.kategori_id === filterKategori;
      return cocokCari && cocokKategori;
    });
  }, [menuList, cari, filterKategori, menuTerlarisIds]);

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
      <div className="grid gap-3 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px]">
        {/* ===== KOLOM KIRI: MENU GRID ===== */}
        <div className="space-y-3">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-xl font-extrabold tracking-tight">Kasir</h1>
              {totalKasKeluarHariIni > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Kas Keluar: Rp {formatRupiah(totalKasKeluarHariIni)}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold"
              onClick={() => setKasKeluarBuka(true)}
            >
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              Kas Keluar
            </Button>
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
            {/* Fitur 4: Tab Terlaris */}
            <Button
              variant={filterKategori === "terlaris" ? "default" : "outline"}
              size="sm"
              className="h-10 font-bold"
              onClick={() => setFilterKategori("terlaris")}
            >
              <Flame className="mr-1 h-4 w-4 text-orange-500" />
              Terlaris
            </Button>
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
        <div className="space-y-2.5 md:sticky md:top-2 md:self-start md:max-h-[calc(100vh-1rem)] md:overflow-y-auto lg:max-h-[calc(100vh-1rem)]">
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

          {/* Opsi Dine In / Takeaway */}
          <div className="rounded-lg border border-border bg-card p-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                variant={tipePesanan === "dine_in" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => setTipePesanan("dine_in")}
              >
                Dine In
              </Button>
              <Button
                type="button"
                variant={tipePesanan === "takeaway" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => setTipePesanan("takeaway")}
              >
                Take Away
              </Button>
            </div>
            {tipePesanan === "dine_in" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] font-medium text-muted-foreground">No. Meja:</span>
                <Input
                  value={nomorMeja}
                  onChange={(e) => setNomorMeja(e.target.value)}
                  placeholder="Contoh: 04"
                  className="h-7 flex-1 text-xs"
                />
              </div>
            )}
          </div>

          {/* Keranjang */}
          <div className="rounded-lg border border-border bg-card p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold tracking-tight">
                Keranjang {tipePesanan === "dine_in" ? (nomorMeja ? `(Dine In - Meja ${nomorMeja})` : "(Dine In)") : "(Take Away)"}
              </p>
              <div className="flex items-center gap-1.5">
                {billsDitahan.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 border-amber-500/40 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                    onClick={() => setDialogDitahanBuka(true)}
                  >
                    <PauseCircle className="mr-1 h-3 w-3" />
                    Ditahan ({billsDitahan.length})
                  </Button>
                )}
                {keranjang.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={tahanBill}
                    title="Tahan transaksi sementara"
                  >
                    <PauseCircle className="mr-1 h-3 w-3" />
                    Tahan
                  </Button>
                )}
              </div>
            </div>

            {keranjang.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <ReceiptText className="h-5 w-5 text-muted-foreground/60" />
                <p className="text-[11px] text-muted-foreground">
                  Pilih menu di kiri untuk mulai.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {keranjang.map((item, idx) => (
                  <div
                    key={`${item.menu_id}-${idx}`}
                    className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-tight">{item.nama}</p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {formatRupiah(item.harga)} x {item.qty}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => ubahQtyByIndex(idx, -1)}
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
                          onClick={() => ubahQtyByIndex(idx, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => hapusItemByIndex(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Fitur 1: Catatan Item */}
                    <div className="flex items-center gap-1 pt-0.5">
                      {item.catatan ? (
                        <div className="flex flex-1 items-center justify-between rounded bg-background px-1.5 py-0.5 text-[11px]">
                          <span className="truncate italic text-primary font-medium">* {item.catatan}</span>
                          <button
                            type="button"
                            onClick={() => bukaDialogCatatan(idx)}
                            className="ml-1 text-[10px] text-muted-foreground underline hover:text-foreground"
                          >
                            Ubah
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => bukaDialogCatatan(idx)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          <span>+ Catatan / Suhu</span>
                        </button>
                      )}
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

      {/* ===== DIALOG FITUR 1: CATATAN / SUHU ITEM ===== */}
      <Dialog open={dialogCatatanBuka} onOpenChange={setDialogCatatanBuka}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catatan Item</DialogTitle>
            <DialogDescription>
              {catatanIndex !== null && keranjang[catatanIndex]
                ? `Kustomisasi untuk: ${keranjang[catatanIndex].nama}`
                : "Pilih opsi atau ketik catatan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {CHIP_CATATAN.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    const separator = teksCatatan.trim() ? ", " : "";
                    if (!teksCatatan.includes(chip)) {
                      setTeksCatatan((prev) => (prev ? `${prev}${separator}${chip}` : chip));
                    }
                  }}
                  className="rounded-full border border-border bg-accent/40 px-2.5 py-1 text-xs font-semibold hover:bg-primary/20 hover:text-primary transition-colors"
                >
                  + {chip}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="input-catatan" className="text-xs">Catatan Khusus Barista</Label>
              <Input
                id="input-catatan"
                placeholder="Contoh: Es sedikit, gula aren setengah"
                value={teksCatatan}
                onChange={(e) => setTeksCatatan(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTeksCatatan("");
                simpanCatatanItem();
              }}
            >
              Hapus Catatan
            </Button>
            <Button type="button" size="sm" onClick={simpanCatatanItem}>
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG FITUR 2: DAFTAR BILL DITAHAN ===== */}
      <Dialog open={dialogDitahanBuka} onOpenChange={setDialogDitahanBuka}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pesanan Ditahan ({billsDitahan.length})</DialogTitle>
            <DialogDescription>
              Pilih pesanan yang ingin dipulihkan ke kasir atau hapus antrean yang batal.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-y-auto py-2">
            {billsDitahan.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada pesanan yang ditahan.
              </p>
            ) : (
              billsDitahan.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{b.label}</span>
                      <span className="text-[11px] text-muted-foreground">({b.waktu})</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {b.keranjang.map((i) => `${i.qty}x ${i.nama}`).join(", ")}
                    </p>
                    <p className="text-xs font-extrabold text-primary tabular-nums mt-1">
                      Rp {formatRupiah(b.total)}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 gap-1 font-semibold"
                      onClick={() => pulihkanBill(b)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Pulihkan
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => hapusBillDitahan(b.id)}
                      title="Hapus bill ditahan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogDitahanBuka(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG FITUR 3: PENCATATAN KAS KELUAR ===== */}
      <Dialog open={kasKeluarBuka} onOpenChange={setKasKeluarBuka}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Kas Keluar (Petty Cash)</DialogTitle>
            <DialogDescription>
              Catat uang kas kecil yang diambil dari laci untuk keperluan operasional kafe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="nominal-kas" className="text-xs font-semibold">Nominal Pengeluaran (Rp)</Label>
              <Input
                id="nominal-kas"
                type="number"
                placeholder="Contoh: 25000"
                value={nominalKas}
                onChange={(e) => setNominalKas(e.target.value)}
                className="h-10 text-sm font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kategori</Label>
              <div className="flex flex-wrap gap-1.5">
                {KATEGORI_KAS_KECIL.map((kat) => (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setKategoriKas(kat)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                      kategoriKas === kat
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {kat}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="keterangan-kas" className="text-xs font-semibold">Keterangan / Keperluan</Label>
              <Input
                id="keterangan-kas"
                placeholder="Contoh: Beli es batu kristal 2 karung"
                value={keteranganKas}
                onChange={(e) => setKeteranganKas(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setKasKeluarBuka(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loadingKas}
              onClick={simpanKasKeluar}
            >
              {loadingKas ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Kas Keluar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG STRUK ===== */}
      <DialogStruk
        buka={strukBuka}
        onClose={() => setStrukBuka(false)}
        data={strukData}
      />
    </div>
  );
}

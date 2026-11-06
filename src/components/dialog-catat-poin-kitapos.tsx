"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { normalisasiWhatsapp, formatWhatsapp } from "@/lib/pelanggan";
import { toast } from "sonner";
import { ReceiptText, Sparkles, Search, User, TicketMinus, Wallet } from "lucide-react";

interface PelangganSimple {
  id: string;
  nama: string;
  whatsapp: string;
  poin?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pelangganAwal?: PelangganSimple | null;
  onBerhasil?: () => void;
}

const POIN_PER_RUPIAH = 20000;
const NILAI_PER_POIN = 1000;

export function DialogCatatPoinKitapos({
  open,
  onOpenChange,
  pelangganAwal,
  onBerhasil,
}: Props) {
  const supabase = createClient();
  const [daftarPelanggan, setDaftarPelanggan] = useState<PelangganSimple[]>([]);
  const [cari, setCari] = useState("");
  const [pelangganTerpilih, setPelangganTerpilih] = useState<PelangganSimple | null>(
    pelangganAwal ?? null,
  );
  const [nominalStr, setNominalStr] = useState("");
  const [noStruk, setNoStruk] = useState("");
  const [poinTukar, setPoinTukar] = useState(0);
  const [menyimpan, setMenyimpan] = useState(false);
  const [activeTab, setActiveTab] = useState<"earn" | "redeem">("earn");

  // Refresh pelanggan saat tab redeem dibuka (supaya poin terbaru)
  const pelangganTerpilihId = pelangganTerpilih?.id;
  const refreshPelanggan = useCallback(async () => {
    if (!pelangganTerpilihId) return;
    const { data } = await supabase
      .from("pelanggan")
      .select("id, nama, whatsapp, poin")
      .eq("id", pelangganTerpilihId)
      .maybeSingle();
    if (data) {
      setPelangganTerpilih((saatIni) =>
        saatIni?.id === pelangganTerpilihId
          ? { ...saatIni, poin: data.poin ?? 0 }
          : saatIni,
      );
    }
  }, [pelangganTerpilihId, supabase]);

  useEffect(() => {
    if (!open) return;
    let aktif = true;
    (async () => {
      const { data } = await supabase
        .from("pelanggan")
        .select("id, nama, whatsapp, poin")
        .order("nama", { ascending: true })
        .limit(100);
      if (aktif && data) setDaftarPelanggan(data);
    })();
    return () => {
      aktif = false;
    };
  }, [open, supabase]);

  // Refresh poin saat buka tab redeem - gunakan timeout untuk avoid cascading renders
  useEffect(() => {
    if (activeTab === "redeem" && pelangganTerpilihId) {
      const timer = setTimeout(() => {
        refreshPelanggan();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, pelangganTerpilihId, refreshPelanggan]);

  const hasilCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftarPelanggan.slice(0, 5);
    const qWa = normalisasiWhatsapp(q);
    return daftarPelanggan.filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        (qWa && p.whatsapp.includes(qWa)) ||
        p.whatsapp.includes(q),
    ).slice(0, 5);
  }, [daftarPelanggan, cari]);

  const nominal = parseInt(nominalStr.replace(/\D/g, ""), 10) || 0;
  const poinDidapat = Math.floor(nominal / POIN_PER_RUPIAH);
  const nilaiRupiahPoin = poinDidapat * NILAI_PER_POIN;

  const poinTersedia = pelangganTerpilih?.poin ?? 0;
  const nilaiRupiahTukar = poinTukar * NILAI_PER_POIN;

  function tambahNominal(n: number) {
    setNominalStr(String(nominal + n));
  }

  async function simpanEarn() {
    if (!pelangganTerpilih) {
      toast.error("Pilih pelanggan terlebih dahulu.");
      return;
    }
    if (nominal <= 0) {
      toast.error("Masukkan total belanja dari struk KITAPOS.");
      return;
    }

    setMenyimpan(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profil } = user
        ? await supabase
            .from("profile")
            .select("nama")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null };

      const externalRef =
        noStruk.trim() || `KITAPOS/${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.from("transaksi").insert({
        pelanggan_id: pelangganTerpilih.id,
        subtotal: nominal,
        diskon: 0,
        ppn: 0,
        biaya_layanan: 0,
        total: nominal,
        poin_didapat: poinDidapat,
        poin_dipakai: 0,
        source: "crm_pos",
        metode_bayar: "qris",
        external_ref: externalRef,
        items: [
          {
            nama: "Transaksi KITAPOS",
            qty: 1,
            harga_satuan: nominal,
            subtotal: nominal,
          },
        ],
        dicatat_oleh: user?.id ?? null,
        dicatat_oleh_nama: profil?.nama ?? null,
        dicatat_pada: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(
        `Berhasil mencatat transaksi KITAPOS! +${poinDidapat} poin ditambahkan ke ${pelangganTerpilih.nama}.`,
      );
      onOpenChange(false);
      if (onBerhasil) onBerhasil();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan transaksi.";
      toast.error(msg);
    } finally {
      setMenyimpan(false);
    }
  }

  async function simpanRedeem() {
    if (!pelangganTerpilih) {
      toast.error("Pilih pelanggan terlebih dahulu.");
      return;
    }
    if (poinTukar <= 0) {
      toast.error("Masukkan jumlah poin yang ingin ditukar (minimal 5 poin).");
      return;
    }
    if (poinTukar < 5) {
      toast.error("Minimal tukar poin adalah 5 poin.");
      return;
    }
    if (poinTukar > poinTersedia) {
      toast.error(`Poin tidak cukup. Tersedia: ${poinTersedia} poin.`);
      return;
    }

    setMenyimpan(true);
    try {
      const response = await fetch("/api/poin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pelanggan_id: pelangganTerpilih.id, poin: poinTukar }),
      });
      const hasil = (await response.json()) as {
        ok?: boolean;
        error?: string;
        saldo_poin?: number | null;
      };
      if (!response.ok || !hasil.ok) {
        throw new Error(hasil.error ?? "Penukaran poin gagal diproses.");
      }
      if (typeof hasil.saldo_poin === "number") {
        setPelangganTerpilih((saatIni) =>
          saatIni?.id === pelangganTerpilih.id
            ? { ...saatIni, poin: hasil.saldo_poin! }
            : saatIni,
        );
      }

      toast.success(
        `Berhasil menukar ${poinTukar} poin! Potongan Rp ${nilaiRupiahTukar.toLocaleString("id-ID")} untuk ${pelangganTerpilih.nama}.`,
      );
      onOpenChange(false);
      if (onBerhasil) onBerhasil();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menukar poin.";
      toast.error(msg);
    } finally {
      setMenyimpan(false);
    }
  }

  const pelangganCard = pelangganTerpilih ? (
    <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-foreground">
            {pelangganTerpilih.nama}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatWhatsapp(pelangganTerpilih.whatsapp)}
          </p>
        </div>
      </div>
      {!pelangganAwal && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setPelangganTerpilih(null)}
        >
          Ganti
        </Button>
      )}
    </div>
  ) : null;

  const cariPelangganUI = (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-8 text-xs"
          placeholder="Cari nama atau nomor WhatsApp..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>
      <div className="max-h-36 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
        {hasilCari.length === 0 ? (
          <p className="p-2.5 text-center text-xs text-muted-foreground">
            Pelanggan tidak ditemukan.
          </p>
        ) : (
          hasilCari.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between p-2 text-left text-xs transition-colors hover:bg-muted"
              onClick={() => setPelangganTerpilih(p)}
            >
              <span className="font-semibold">{p.nama}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatWhatsapp(p.whatsapp)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Poin Pelanggan</DialogTitle>
              <DialogDescription className="text-xs">
                Catat belanja untuk tambah poin, atau tukar poin untuk potongan belanja.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "earn" | "redeem")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="earn">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Catat Poin
            </TabsTrigger>
            <TabsTrigger value="redeem">
              <TicketMinus className="mr-1.5 h-3.5 w-3.5" />
              Tukar Poin
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB CATAT POIN (EARN) ===== */}
          <TabsContent value="earn" className="space-y-4 py-2">
            {/* Pilih Pelanggan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pelanggan</Label>
              {pelangganTerpilih ? pelangganCard : cariPelangganUI}
            </div>

            {/* Nominal Belanja */}
            <div className="space-y-1.5">
              <Label htmlFor="nominal" className="text-xs font-semibold">
                Total Belanja Struk KITAPOS (Rp)
              </Label>
              <Input
                id="nominal"
                className="h-11 text-base font-bold tabular-nums"
                placeholder="0"
                value={nominal ? nominal.toLocaleString("id-ID") : ""}
                onChange={(e) => setNominalStr(e.target.value)}
              />
              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[20000, 40000, 50000, 100000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
                    onClick={() => tambahNominal(val)}
                  >
                    +{val / 1000}rb
                  </button>
                ))}
              </div>
            </div>

            {/* Nomor Struk KITAPOS (Opsional) */}
            <div className="space-y-1.5">
              <Label htmlFor="struk" className="text-xs font-semibold text-muted-foreground">
                No. Struk KITAPOS (Opsional)
              </Label>
              <Input
                id="struk"
                className="h-11 text-xs font-mono"
                placeholder="cth. KP-261105-001"
                value={noStruk}
                onChange={(e) => setNoStruk(e.target.value)}
              />
            </div>

            {/* Kotak Perhitungan Poin */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Poin Didapat
                </span>
                <span className="text-base font-black text-primary tabular-nums">
                  +{poinDidapat} Poin
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {poinDidapat > 0
                  ? `Setara potongan belanja Rp ${nilaiRupiahPoin.toLocaleString("id-ID")} (Rp 20.000 = 1 poin).`
                  : "Minimal belanja Rp 20.000 untuk mendapatkan poin."}
              </p>
            </div>
          </TabsContent>

          {/* ===== TAB TUKAR POIN (REDEEM) ===== */}
          <TabsContent value="redeem" className="space-y-4 py-2">
            {/* Pilih Pelanggan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pelanggan</Label>
              {pelangganTerpilih ? pelangganCard : cariPelangganUI}
            </div>

            {/* Info Poin Tersedia */}
            {pelangganTerpilih && (
              <div className="rounded-lg border border-green/20 bg-green/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green">
                    <Wallet className="h-3.5 w-3.5" /> Poin Tersedia
                  </span>
                  <span className="text-base font-black text-green tabular-nums">
                    {poinTersedia} Poin
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  1 poin = Rp 1.000 · Minimal tukar 5 poin · Maksimal {poinTersedia} poin
                </p>
              </div>
            )}

            {/* Input Jumlah Poin Ditukar */}
            <div className="space-y-1.5">
              <Label htmlFor="poin-tukar" className="text-xs font-semibold">
                Jumlah Poin Ditukar
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 p-0"
                  onClick={() => setPoinTukar(Math.max(0, poinTukar - 1))}
                  disabled={poinTukar <= 0 || menyimpan}
                >
                  <TicketMinus className="h-4 w-4" />
                </Button>
                <Input
                  id="poin-tukar"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="h-11 flex-1 text-center text-base font-bold tabular-nums"
                  value={poinTukar === 0 ? "" : String(poinTukar)}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setPoinTukar(0);
                      return;
                    }
                    if (!/^[0-9]+$/.test(raw)) return;
                    const val = Number(raw);
                    if (Number.isSafeInteger(val)) setPoinTukar(val);
                  }}
                  aria-label="Jumlah poin ditukar"
                  disabled={menyimpan}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 p-0"
                  onClick={() => {
                    if (!pelangganTerpilih) return;
                    setPoinTukar(Math.min(pelangganTerpilih.poin ?? 0, poinTukar + 1));
                  }}
                  disabled={!pelangganTerpilih || poinTukar >= (pelangganTerpilih.poin ?? 0) || menyimpan}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
              {/* Quick chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[5, 10, 20, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
                    onClick={() => setPoinTukar(Math.min(val, poinTersedia))}
                    disabled={val > poinTersedia || menyimpan}
                  >
                    {val} poin
                  </button>
                ))}
              </div>
            </div>

            {/* Kotak Perhitungan Tukar */}
            {pelangganTerpilih && poinTukar > 0 && (
              <div className="rounded-lg border border-amber/20 bg-amber/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber">
                    <TicketMinus className="h-3.5 w-3.5" /> Nilai Tukar
                  </span>
                  <span className="text-base font-black text-amber tabular-nums">
                    Rp {nilaiRupiahTukar.toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Poin akan dikurangi (FIFO: yang paling tua hangusnya didahulukan). Sisa poin: {poinTersedia - poinTukar} poin.
                </p>
              </div>
            )}

            {pelangganTerpilih && poinTersedia < 5 && (
              <p className="text-center text-[11px] text-muted-foreground">
                Poin tidak cukup untuk ditukar (minimal 5 poin). Saat ini: {poinTersedia} poin.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={menyimpan}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={activeTab === "earn" ? simpanEarn : simpanRedeem}
            disabled={
              menyimpan ||
              (activeTab === "earn"
                ? !pelangganTerpilih || nominal <= 0
                : !pelangganTerpilih || poinTukar <= 0 || poinTukar < 5 || poinTukar > poinTersedia)
            }
          >
            {menyimpan
              ? "Menyimpan…"
              : activeTab === "earn"
              ? "Simpan & Tambah Poin"
              : "Tukar Poin & Potong Tagihan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { ReceiptText, Sparkles, TicketMinus, Wallet, ArrowDownRight, ArrowUpRight, Hash } from "lucide-react";
import { KitaposPemilihPelanggan, type PelangganSimple } from "@/components/kitapos-pemilih-pelanggan";

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
      const ditukar = poinTukar;
      const nilaiDitukar = nilaiRupiahTukar;
      const nama = pelangganTerpilih.nama;
      const response = await fetch("/api/poin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pelanggan_id: pelangganTerpilih.id, poin: ditukar }),
      });
      const hasil = (await response.json()) as {
        ok?: boolean;
        error?: string;
        saldo_poin?: number | null;
      };
      if (!response.ok || !hasil.ok) {
        throw new Error(hasil.error ?? "Penukaran poin gagal diproses.");
      }
      if (typeof hasil.saldo_poin !== "number") {
        throw new Error("Poin sudah tercatat, tapi saldo belum berhasil dibaca ulang. Muat ulang data pelanggan.");
      }
      setPelangganTerpilih((saatIni) =>
        saatIni?.id === pelangganTerpilih.id
          ? { ...saatIni, poin: hasil.saldo_poin! }
          : saatIni,
      );
      setDaftarPelanggan((saatIni) =>
        saatIni.map((p) => p.id === pelangganTerpilih.id
          ? { ...p, poin: hasil.saldo_poin! }
          : p),
      );
      setPoinTukar(0);
      await refreshPelanggan();

      toast.success(
        `${ditukar} poin ditukar, potongan Rp ${nilaiDitukar.toLocaleString("id-ID")}. Saldo ${nama} sekarang ${hasil.saldo_poin} poin.`,
      );
      if (onBerhasil) onBerhasil();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menukar poin.";
      toast.error(msg);
    } finally {
      setMenyimpan(false);
    }
  }

  function pilihPelanggan(p: PelangganSimple) {
    setPelangganTerpilih(p);
    setPoinTukar(0);
  }

  function lepasPelanggan() {
    setPelangganTerpilih(null);
    setPoinTukar(0);
  }

  function inputPelangganUI() {
    return (
      <KitaposPemilihPelanggan
        daftar={daftarPelanggan}
        terpilih={pelangganTerpilih}
        onPilih={pilihPelanggan}
        onLepas={lepasPelanggan}
        bolehLepas={!pelangganAwal}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88dvh,760px)] overflow-y-auto border-border bg-background p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ReceiptText className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold tracking-tight">Poin KITAPOS</DialogTitle>
              <DialogDescription className="mt-1 text-[13px] leading-relaxed">
                Catat transaksi KITAPOS atau tukarkan poin pelanggan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "earn" | "redeem")} className="w-full px-6 pt-4">
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg bg-secondary/70 p-1">
            <TabsTrigger value="earn">
              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Catat Poin
            </TabsTrigger>
            <TabsTrigger value="redeem">
              <ArrowDownRight className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Tukar Poin
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB CATAT POIN (EARN) ===== */}
          <TabsContent value="earn" className="space-y-5 pb-6 pt-5">
            {/* Pilih Pelanggan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pelanggan</Label>
              {inputPelangganUI()}
            </div>

            {/* Nominal Belanja */}
            <div className="space-y-1.5">
              <Label htmlFor="nominal" className="text-xs font-semibold">
                Total Belanja Struk KITAPOS (Rp)
              </Label>
              <Input
                id="nominal"
                className="h-12 text-lg font-bold tabular-nums"
                inputMode="numeric"
                aria-label="Total belanja struk KITAPOS dalam rupiah"
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
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
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
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Hash className="h-3.5 w-3.5" aria-hidden /> Poin didapat
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
          <TabsContent value="redeem" className="space-y-5 pb-6 pt-5">
            {/* Pilih Pelanggan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pelanggan</Label>
              {inputPelangganUI()}
            </div>

            {/* Info Poin Tersedia */}
            {pelangganTerpilih && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" /> Poin Tersedia
                  </span>
                  <span className="text-lg font-bold text-foreground tabular-nums">
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
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
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
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                    <TicketMinus className="h-3.5 w-3.5" /> Nilai Tukar
                  </span>
                  <span className="text-lg font-bold text-primary tabular-nums">
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

        <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background px-6 py-4 sm:gap-0">
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
              : "Tukar Poin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { normalisasiWhatsapp, formatWhatsapp } from "@/lib/pelanggan";
import { toast } from "sonner";
import { ReceiptText, Sparkles, Search, User } from "lucide-react";

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
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Ambil daftar pelanggan untuk pencarian cepat. setState hanya terjadi
    // setelah await, bukan sinkron di body effect.
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

  function tambahNominal(n: number) {
    setNominalStr(String(nominal + n));
  }

  async function simpan() {
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
        poin_dipakai: 0,
        source: "kitapos",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Catat Poin Belanja KITAPOS</DialogTitle>
              <DialogDescription className="text-xs">
                Masukkan total belanja dari struk kasir KITAPOS untuk menambahkan poin pelanggan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pilih Pelanggan */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Pelanggan</Label>
            {pelangganTerpilih ? (
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
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8 text-xs"
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
            )}
          </div>

          {/* Nominal Belanja */}
          <div className="space-y-1.5">
            <Label htmlFor="nominal" className="text-xs font-semibold">
              Total Belanja Struk KITAPOS (Rp)
            </Label>
            <Input
              id="nominal"
              className="h-10 text-base font-bold tabular-nums"
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
              className="h-8 text-xs font-mono"
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
        </div>

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
            onClick={simpan}
            disabled={menyimpan || !pelangganTerpilih || nominal <= 0}
          >
            {menyimpan ? "Menyimpan…" : "Simpan & Tambah Poin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

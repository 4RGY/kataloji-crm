"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";

export interface ItemStruk {
  nama: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

export interface DataStruk {
  no_nota: string;
  waktu: string;
  items: ItemStruk[];
  subtotal: number;
  diskon: number;
  ppn: number;
  biaya_layanan: number;
  potongan_poin: number;
  total: number;
  metode_bayar: string;
  jumlah_bayar: number;
  kembalian: number;
  poin_didapat: number;
  poin_dipakai: number;
  nama_pelanggan: string | null;
  // Info struk dari settings
  struk_nama: string;
  struk_alamat: string;
  struk_wifi_nama: string;
  struk_wifi_pass: string;
  struk_instagram: string;
  struk_footer: string;
}

function formatRupiah(n: number): string {
  return n.toLocaleString("id-ID");
}

function formatMetode(m: string): string {
  if (m === "tunai") return "Tunai";
  if (m === "debit") return "Kartu Debit";
  if (m === "qris") return "QRIS";
  return m;
}

function rataKanan(kiri: string, kanan: string, lebar: number): string {
  const spasi = Math.max(1, lebar - kiri.length - kanan.length);
  return kiri + " ".repeat(spasi) + kanan;
}

function buatTeksStruk(d: DataStruk): string {
  const W = 36;
  const garis = "=".repeat(W);
  const garisTipis = "-".repeat(W);
  const baris: string[] = [];

  baris.push(garis);
  baris.push(d.struk_nama);
  baris.push(d.struk_alamat);
  baris.push(garis);
  baris.push(rataKanan("No Nota :", d.no_nota, W));
  baris.push(rataKanan("Waktu :", d.waktu, W));
  baris.push(garisTipis);

  for (const item of d.items) {
    baris.push(`${item.qty} ${item.nama}`);
    baris.push(rataKanan("", formatRupiah(item.subtotal), W));
  }

  baris.push(garisTipis);
  baris.push(rataKanan(`Subtotal ${d.items.length} Produk`, formatRupiah(d.subtotal), W));
  if (d.diskon > 0) {
    baris.push(rataKanan("Diskon", formatRupiah(d.diskon), W));
  }
  if (d.biaya_layanan > 0) {
    baris.push(rataKanan("Biaya Pelayanan", formatRupiah(d.biaya_layanan), W));
  }
  if (d.ppn > 0) {
    baris.push(rataKanan("Pajak", formatRupiah(d.ppn), W));
  }
  if (d.potongan_poin > 0) {
    baris.push(rataKanan("Potongan Poin", formatRupiah(d.potongan_poin), W));
  }
  baris.push(rataKanan("Total", formatRupiah(d.total), W));
  baris.push(garisTipis);
  baris.push(rataKanan(formatMetode(d.metode_bayar), formatRupiah(d.jumlah_bayar), W));
  if (d.kembalian > 0) {
    baris.push(rataKanan("Kembalian", formatRupiah(d.kembalian), W));
  }
  baris.push(garis);
  baris.push(`Wifi : ${d.struk_wifi_nama}`);
  baris.push(`Pass : ${d.struk_wifi_pass}`);
  baris.push("");
  baris.push(`Instagram : ${d.struk_instagram}`);
  baris.push("");
  baris.push(d.struk_footer);

  return baris.join("\n");
}

interface Props {
  buka: boolean;
  onClose: () => void;
  data: DataStruk | null;
}

export function DialogStruk({ buka, onClose, data }: Props) {
  const refPre = useRef<HTMLPreElement>(null);

  if (!data) return null;

  const teks = buatTeksStruk(data);

  function cetak() {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>Struk ${data!.no_nota}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: "Courier New", monospace;
            font-size: 12px;
            white-space: pre;
            margin: 0;
            padding: 4px;
            width: 72mm;
          }
        </style>
      </head>
      <body>${teks.replace(/</g, "&lt;")}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Struk {data.no_nota}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <pre
            ref={refPre}
            className="whitespace-pre font-mono text-[11px] leading-tight text-foreground"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {teks}
          </pre>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11"
          >
            <X className="mr-1.5 h-4 w-4" />
            Tutup
          </Button>
          <Button onClick={cetak} className="h-11">
            <Printer className="mr-1.5 h-4 w-4" />
            Cetak struk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

/**
 * Rata kanan: label di kiri, nilai di kanan, dengan spasi pengisi.
 * Lebar tetap 32 karakter (80mm thermal printer ~ 32 char monospace).
 */
function rataKanan(kiri: string, kanan: string, lebar: number): string {
  const spasi = Math.max(1, lebar - kiri.length - kanan.length);
  return kiri + " ".repeat(spasi) + kanan;
}

/** Pusat teks dalam lebar kolom tertentu. */
function tengah(teks: string, lebar: number): string {
  const len = teks.length;
  if (len >= lebar) return teks;
  const kiri = Math.floor((lebar - len) / 2);
  const kanan = lebar - len - kiri;
  return " ".repeat(kiri) + teks + " ".repeat(kanan);
}

function buatTeksStruk(d: DataStruk): string {
  const W = 32;
  const garis = "=".repeat(W);
  const garisTipis = "-".repeat(W);
  const baris: string[] = [];

  // Header: nama brand di tengah, alamat per baris di tengah
  baris.push(garis);
  baris.push(tengah(d.struk_nama, W));
  // Alamat bisa multiline (\n) dari settings, tiap baris di-center
  for (const line of d.struk_alamat.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) baris.push(tengah(trimmed, W));
  }
  baris.push(garis);

  // No Nota & Waktu: label rata kanan dengan nilai
  baris.push(rataKanan("No Nota", d.no_nota, W));
  baris.push(rataKanan("Waktu", d.waktu, W));
  baris.push(garisTipis);

  // Items: qty + nama di kiri, subtotal di kanan
  for (const item of d.items) {
    const namaItem = `${item.qty}x  ${item.nama}`;
    baris.push(namaItem);
    baris.push(rataKanan("", formatRupiah(item.subtotal), W));
  }

  baris.push(garisTipis);

  // Ringkasan: label kiri, nilai kanan
  baris.push(rataKanan("Subtotal", formatRupiah(d.subtotal), W));
  if (d.diskon > 0) {
    baris.push(rataKanan("Diskon", formatRupiah(d.diskon), W));
  }
  if (d.biaya_layanan > 0) {
    baris.push(rataKanan("Biaya Layanan", formatRupiah(d.biaya_layanan), W));
  }
  if (d.ppn > 0) {
    baris.push(rataKanan("Pajak (PPN)", formatRupiah(d.ppn), W));
  }
  if (d.potongan_poin > 0) {
    baris.push(rataKanan("Potongan Poin", formatRupiah(d.potongan_poin), W));
  }
  baris.push(rataKanan("TOTAL", formatRupiah(d.total), W));
  baris.push(garisTipis);
  baris.push(rataKanan(formatMetode(d.metode_bayar), formatRupiah(d.jumlah_bayar), W));
  if (d.kembalian > 0) {
    baris.push(rataKanan("Kembalian", formatRupiah(d.kembalian), W));
  }

  // Poin info
  if (d.poin_didapat > 0 || d.poin_dipakai > 0) {
    baris.push(garisTipis);
    if (d.poin_didapat > 0) {
      baris.push(rataKanan("Poin didapat", `+${d.poin_didapat}`, W));
    }
    if (d.poin_dipakai > 0) {
      baris.push(rataKanan("Poin dipakai", `-${d.poin_dipakai}`, W));
    }
  }

  baris.push(garis);

  // Footer info: center
  if (d.struk_wifi_nama) {
    baris.push(tengah(`WiFi: ${d.struk_wifi_nama}`, W));
  }
  if (d.struk_wifi_pass) {
    baris.push(tengah(`Pass: ${d.struk_wifi_pass}`, W));
  }
  if (d.struk_instagram) {
    baris.push(tengah(`IG: @${d.struk_instagram}`, W));
  }
  baris.push("");
  if (d.struk_footer) {
    baris.push(tengah(d.struk_footer, W));
  }

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
          {/* Logo Kataloji di tengah atas struk */}
          <div className="mb-3 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.jpeg"
              alt="Kataloji"
              className="h-16 w-16 rounded-full object-cover"
            />
          </div>
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

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
import { Printer, X, Download } from "lucide-react";

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

/** Lebar 42 karakter untuk Epson Moka 80mm (font standar). */
const W = 42;

function rataKanan(kiri: string, kanan: string): string {
  const spasi = Math.max(1, W - kiri.length - kanan.length);
  return kiri + " ".repeat(spasi) + kanan;
}

function tengah(teks: string): string {
  const len = teks.length;
  if (len >= W) return teks;
  const kiri = Math.floor((W - len) / 2);
  const kanan = W - len - kiri;
  return " ".repeat(kiri) + teks + " ".repeat(kanan);
}

const GARIS = "-".repeat(W);
const GARIS_TEBAL = "=".repeat(W);

function buatTeksStruk(d: DataStruk): string {
  const baris: string[] = [];

  // Header brand + alamat
  baris.push(tengah(d.struk_nama));
  for (const line of d.struk_alamat.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) baris.push(tengah(trimmed));
  }
  baris.push(GARIS);

  // Info nota
  baris.push(rataKanan("No Nota", d.no_nota));
  baris.push(rataKanan("Waktu", d.waktu));
  if (d.nama_pelanggan) {
    baris.push(rataKanan("Pelanggan", d.nama_pelanggan));
  }
  baris.push(GARIS);

  // Items
  for (const item of d.items) {
    baris.push(`${item.qty}x  ${item.nama}`);
    baris.push(rataKanan("", formatRupiah(item.subtotal)));
  }
  baris.push(GARIS);

  // Ringkasan
  baris.push(rataKanan("Subtotal", formatRupiah(d.subtotal)));
  if (d.diskon > 0) {
    baris.push(rataKanan("Diskon", "-" + formatRupiah(d.diskon)));
  }
  if (d.biaya_layanan > 0) {
    baris.push(rataKanan("Biaya Layanan", formatRupiah(d.biaya_layanan)));
  }
  if (d.ppn > 0) {
    baris.push(rataKanan("Pajak (PPN)", formatRupiah(d.ppn)));
  }
  if (d.potongan_poin > 0) {
    baris.push(rataKanan("Potongan Poin", "-" + formatRupiah(d.potongan_poin)));
  }
  baris.push(GARIS_TEBAL);
  baris.push(rataKanan("TOTAL", formatRupiah(d.total)));
  baris.push(GARIS);

  // Pembayaran
  baris.push(rataKanan(formatMetode(d.metode_bayar), formatRupiah(d.jumlah_bayar)));
  if (d.kembalian > 0) {
    baris.push(rataKanan("Kembalian", formatRupiah(d.kembalian)));
  }

  // Poin info
  if (d.poin_didapat > 0 || d.poin_dipakai > 0) {
    baris.push(GARIS);
    if (d.poin_didapat > 0) {
      baris.push(rataKanan("Poin didapat", "+" + d.poin_didapat));
    }
    if (d.poin_dipakai > 0) {
      baris.push(rataKanan("Poin dipakai", "-" + d.poin_dipakai));
    }
  }

  baris.push(GARIS);

  // Footer
  if (d.struk_wifi_nama) {
    baris.push(tengah(`WiFi: ${d.struk_wifi_nama}`));
  }
  if (d.struk_wifi_pass) {
    baris.push(tengah(`Pass: ${d.struk_wifi_pass}`));
  }
  if (d.struk_instagram) {
    baris.push(tengah(`IG: @${d.struk_instagram}`));
  }
  baris.push("");
  if (d.struk_footer) {
    const footerLines = d.struk_footer.split("\n");
    for (const fl of footerLines) {
      const trimmed = fl.trim();
      if (trimmed) baris.push(tengah(trimmed));
    }
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

    const logoUrl = window.location.origin + "/brand/logo-removebg.png";

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk ${data!.no_nota}</title>
  <style>
    @page { margin: 4mm; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Courier New", monospace;
      font-size: 11px;
      line-height: 1.35;
      width: 72mm;
      margin: 0 auto;
      color: #000;
    }
    .logo-wrap {
      text-align: center;
      margin-bottom: 4px;
    }
    .logo-circle {
      display: inline-block;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #2A1D14;
      line-height: 36px;
      text-align: center;
    }
    .logo-circle img {
      width: 24px;
      height: 24px;
      vertical-align: middle;
      object-fit: contain;
    }
    .brand-name {
      text-align: center;
      font-weight: bold;
      font-size: 13px;
      margin-top: 2px;
    }
    .alamat {
      text-align: center;
      font-size: 10px;
      white-space: pre-wrap;
    }
    .separator {
      border-top: 1px dashed #000;
      margin: 2px 0;
    }
    .separator-tebal {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      height: 3px;
      margin: 2px 0;
    }
    .item-nama { font-weight: bold; }
    .total-line { font-weight: bold; }
    .footer-info { text-align: center; margin-top: 2px; }
    .thank-you { text-align: center; margin-top: 4px; font-style: italic; }
  </style>
</head>
<body>
  <div class="logo-wrap">
    <div class="logo-circle">
      <img src="${logoUrl}" alt="Kataloji" />
    </div>
  </div>
  <div class="brand-name">${data!.struk_nama}</div>
  <div class="alamat">${data!.struk_alamat.replace(/\n/g, "<br/>")}</div>
  <div class="separator"></div>
  <div>No Nota       : ${data!.no_nota}</div>
  <div>Waktu         : ${data!.waktu}</div>
  ${data!.nama_pelanggan ? `<div>Pelanggan     : ${data!.nama_pelanggan}</div>` : ""}
  <div class="separator"></div>
  ${data!.items.map((item) => `
  <div class="item-nama">${item.qty}x  ${item.nama}</div>
  <div style="text-align: right;">${formatRupiah(item.subtotal)}</div>
  `).join("")}
  <div class="separator"></div>
  <div style="display: flex; justify-content: space-between;"><span>Subtotal</span><span>${formatRupiah(data!.subtotal)}</span></div>
  ${data!.diskon > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Diskon</span><span>-${formatRupiah(data!.diskon)}</span></div>` : ""}
  ${data!.biaya_layanan > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Biaya Layanan</span><span>${formatRupiah(data!.biaya_layanan)}</span></div>` : ""}
  ${data!.ppn > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Pajak (PPN)</span><span>${formatRupiah(data!.ppn)}</span></div>` : ""}
  ${data!.potongan_poin > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Potongan Poin</span><span>-${formatRupiah(data!.potongan_poin)}</span></div>` : ""}
  <div class="separator-tebal"></div>
  <div class="total-line" style="display: flex; justify-content: space-between;"><span>TOTAL</span><span>${formatRupiah(data!.total)}</span></div>
  <div class="separator"></div>
  <div style="display: flex; justify-content: space-between;"><span>${formatMetode(data!.metode_bayar)}</span><span>${formatRupiah(data!.jumlah_bayar)}</span></div>
  ${data!.kembalian > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Kembalian</span><span>${formatRupiah(data!.kembalian)}</span></div>` : ""}
  ${(data!.poin_didapat > 0 || data!.poin_dipakai > 0) ? `
  <div class="separator"></div>
  ${data!.poin_didapat > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Poin didapat</span><span>+${data!.poin_didapat}</span></div>` : ""}
  ${data!.poin_dipakai > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Poin dipakai</span><span>-${data!.poin_dipakai}</span></div>` : ""}
  ` : ""}
  <div class="separator"></div>
  ${data!.struk_wifi_nama ? `<div class="footer-info">WiFi: ${data!.struk_wifi_nama}</div>` : ""}
  ${data!.struk_wifi_pass ? `<div class="footer-info">Pass: ${data!.struk_wifi_pass}</div>` : ""}
  ${data!.struk_instagram ? `<div class="footer-info">IG: @${data!.struk_instagram}</div>` : ""}
  ${data!.struk_footer ? `<div class="thank-you">${data!.struk_footer.replace(/\n/g, "<br/>")}</div>` : ""}
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  }

  function downloadStruk() {
    const blob = new Blob([teks], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `struk-${data!.no_nota || "kataloji"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Struk {data.no_nota}</DialogTitle>
        </DialogHeader>
        {/* Preview struk: tampilan mirip hasil cetak */}
        <div className="rounded-lg border border-border bg-white p-4 shadow-inner">
          {/* Logo dengan dark circle (logo putih butuh background gelap) */}
          <div className="mb-2 flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2A1D14]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-removebg.png"
                alt="Kataloji"
                className="h-6 w-6 object-contain"
              />
            </div>
          </div>
          <p className="text-center text-[13px] font-bold leading-tight">
            {data.struk_nama}
          </p>
          {data.struk_alamat && (
            <p className="text-center text-[10px] leading-tight text-gray-600">
              {data.struk_alamat}
            </p>
          )}
          <div className="my-1.5 border-t border-dashed border-gray-300" />
          <pre
            ref={refPre}
            className="whitespace-pre font-mono text-[11px] leading-[1.35] text-gray-900"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {teks.split("\n").slice(teks.split("\n").findIndex((l) => l.includes("No Nota"))).join("\n")}
          </pre>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11"
          >
            <X className="mr-1.5 h-4 w-4" />
            Tutup
          </Button>
          <Button
            variant="outline"
            onClick={downloadStruk}
            className="h-11"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Unduh
          </Button>
          <Button onClick={cetak} className="h-11">
            <Printer className="mr-1.5 h-4 w-4" />
            Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

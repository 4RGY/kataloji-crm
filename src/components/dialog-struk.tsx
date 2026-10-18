"use client";

import { useRef, useState } from "react";
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

/** Bagian header struk (brand + alamat) sebagai teks. */
function teksHeader(d: DataStruk): string {
  const baris: string[] = [];
  baris.push(tengah(d.struk_nama));
  for (const line of d.struk_alamat.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) baris.push(tengah(trimmed));
  }
  return baris.join("\n");
}

/** Bagian body struk (info nota sampai footer) sebagai teks. */
function teksBody(d: DataStruk): string {
  const baris: string[] = [];

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
    for (const fl of d.struk_footer.split("\n")) {
      const trimmed = fl.trim();
      if (trimmed) baris.push(tengah(trimmed));
    }
  }

  return baris.join("\n");
}

function teksStruk(d: DataStruk): string {
  return teksHeader(d) + "\n" + GARIS + "\n" + teksBody(d);
}

/**
 * Fetch logo sebagai base64 data URL supaya print window self-contained.
 * Print window di window.open baru ga selalu punya akses ke origin yang sama.
 */
async function logoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/brand/logo-removebg.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface Props {
  buka: boolean;
  onClose: () => void;
  data: DataStruk | null;
}

export function DialogStruk({ buka, onClose, data }: Props) {
  const [mencetak, setMencetak] = useState(false);
  const refPre = useRef<HTMLPreElement>(null);

  if (!data) return null;

  const header = teksHeader(data);
  const body = teksBody(data);
  const teks = teksStruk(data);

  async function cetak() {
    setMencetak(true);
    try {
      const logo = await logoBase64();
      const win = window.open("", "_blank", "width=400,height=600");
      if (!win) return;

      const logoHtml = logo
        ? `<div class="logo-wrap"><div class="logo-circle"><img src="${logo}" alt="Kataloji" /></div></div>`
        : "";

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
      line-height: 1.4;
      width: 72mm;
      margin: 0 auto;
      color: #000;
    }
    .logo-wrap { text-align: center; margin-bottom: 4px; }
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
    .brand-name { text-align: center; font-weight: bold; font-size: 13px; margin-top: 2px; }
    .alamat { text-align: center; font-size: 10px; white-space: pre-wrap; line-height: 1.3; }
    .sep { border-top: 1px dashed #000; margin: 3px 0; }
    .sep-tebal { border-top: 2px solid #000; border-bottom: 1px solid #000; height: 4px; margin: 3px 0; }
    .row { display: flex; justify-content: space-between; }
    .item-nama { font-weight: bold; }
    .item-sub { text-align: right; }
    .total { font-weight: bold; font-size: 12px; }
    .footer-info { text-align: center; margin-top: 2px; }
    .thank { text-align: center; margin-top: 6px; font-style: italic; white-space: pre-wrap; }
  </style>
</head>
<body>
  ${logoHtml}
  <div class="brand-name">${data!.struk_nama}</div>
  <div class="alamat">${data!.struk_alamat.replace(/\n/g, "<br/>")}</div>
  <div class="sep"></div>
  <div class="row"><span>No Nota</span><span>${data!.no_nota}</span></div>
  <div class="row"><span>Waktu</span><span>${data!.waktu}</span></div>
  ${data!.nama_pelanggan ? `<div class="row"><span>Pelanggan</span><span>${data!.nama_pelanggan}</span></div>` : ""}
  <div class="sep"></div>
  ${data!.items.map((item) => `
  <div class="item-nama">${item.qty}x  ${item.nama}</div>
  <div class="item-sub">${formatRupiah(item.subtotal)}</div>
  `).join("")}
  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${formatRupiah(data!.subtotal)}</span></div>
  ${data!.diskon > 0 ? `<div class="row"><span>Diskon</span><span>-${formatRupiah(data!.diskon)}</span></div>` : ""}
  ${data!.biaya_layanan > 0 ? `<div class="row"><span>Biaya Layanan</span><span>${formatRupiah(data!.biaya_layanan)}</span></div>` : ""}
  ${data!.ppn > 0 ? `<div class="row"><span>Pajak (PPN)</span><span>${formatRupiah(data!.ppn)}</span></div>` : ""}
  ${data!.potongan_poin > 0 ? `<div class="row"><span>Potongan Poin</span><span>-${formatRupiah(data!.potongan_poin)}</span></div>` : ""}
  <div class="sep-tebal"></div>
  <div class="row total"><span>TOTAL</span><span>${formatRupiah(data!.total)}</span></div>
  <div class="sep"></div>
  <div class="row"><span>${formatMetode(data!.metode_bayar)}</span><span>${formatRupiah(data!.jumlah_bayar)}</span></div>
  ${data!.kembalian > 0 ? `<div class="row"><span>Kembalian</span><span>${formatRupiah(data!.kembalian)}</span></div>` : ""}
  ${(data!.poin_didapat > 0 || data!.poin_dipakai > 0) ? `
  <div class="sep"></div>
  ${data!.poin_didapat > 0 ? `<div class="row"><span>Poin didapat</span><span>+${data!.poin_didapat}</span></div>` : ""}
  ${data!.poin_dipakai > 0 ? `<div class="row"><span>Poin dipakai</span><span>-${data!.poin_dipakai}</span></div>` : ""}
  ` : ""}
  <div class="sep"></div>
  ${data!.struk_wifi_nama ? `<div class="footer-info">WiFi: ${data!.struk_wifi_nama}</div>` : ""}
  ${data!.struk_wifi_pass ? `<div class="footer-info">Pass: ${data!.struk_wifi_pass}</div>` : ""}
  ${data!.struk_instagram ? `<div class="footer-info">IG: @${data!.struk_instagram}</div>` : ""}
  ${data!.struk_footer ? `<div class="thank">${data!.struk_footer.replace(/\n/g, "<br/>")}</div>` : ""}
</body>
</html>`);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 400);
    } finally {
      setMencetak(false);
    }
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
        {/* Preview struk: styled mirip hasil cetak thermal */}
        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          {/* Logo dengan dark circle */}
          <div className="mb-2 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A1D14] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-removebg.png"
                alt="Kataloji"
                className="h-7 w-7 object-contain"
              />
            </div>
          </div>
          {/* Header: brand + alamat */}
          <pre
            className="whitespace-pre text-center font-mono text-[12px] font-bold leading-tight text-gray-900"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {header}
          </pre>
          <div className="my-2 border-t border-dashed border-gray-300" />
          {/* Body: nota info + items + summary + footer */}
          <pre
            ref={refPre}
            className="whitespace-pre font-mono text-[11px] leading-[1.45] text-gray-900"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {body}
          </pre>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            <X className="mr-1.5 h-4 w-4" />
            Tutup
          </Button>
          <Button variant="outline" onClick={downloadStruk} className="h-11">
            <Download className="mr-1.5 h-4 w-4" />
            Unduh
          </Button>
          <Button onClick={cetak} disabled={mencetak} className="h-11">
            <Printer className="mr-1.5 h-4 w-4" />
            {mencetak ? "Membuka..." : "Cetak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

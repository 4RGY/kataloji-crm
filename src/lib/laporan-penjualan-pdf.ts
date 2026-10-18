/**
 * Pembuat PDF laporan penjualan - Kataloji CRM
 *
 * Layout premium A4 dengan brand identity Kataloji:
 * header bermerek, ringkasan kartu, tabel bersih, footer halaman.
 * Angka masuk sudah dihitung halaman Laporan penjualan lewat
 * `ringkasPenjualan`, jadi PDF memakai angka yang sama dengan layar.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PerbandinganPenjualan, RingkasanPenjualan } from "@/lib/laporan-penjualan";
import { LOGO_PDF_BASE64 } from "@/lib/logo-pdf";

export interface DataPdfPenjualan {
  periodeLabel: string;
  dibuatPada: string;
  ringkas: RingkasanPenjualan;
  banding?: PerbandinganPenjualan | null;
}

// Warna brand Kataloji (RGB untuk jsPDF)
const W = {
  terracotta: [200, 143, 123] as [number, number, number],
  espresso: [74, 56, 43] as [number, number, number],
  coffeeInk: [42, 29, 20] as [number, number, number],
  cream: [250, 245, 238] as [number, number, number],
  sage: [131, 154, 102] as [number, number, number],
  mustard: [217, 204, 76] as [number, number, number],
  muted: [120, 110, 100] as [number, number, number],
  border: [220, 210, 200] as [number, number, number],
  lightBg: [245, 240, 233] as [number, number, number],
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const rupiahSelisih = (n: number) =>
  n < 0 ? `-Rp ${Math.round(Math.abs(n)).toLocaleString("id-ID")}` : `+Rp ${Math.round(n).toLocaleString("id-ID")}`;

type TabelTerakhir = { lastAutoTable: { finalY: number } };
function posisiAkhir(doc: jsPDF): number {
  return (doc as unknown as TabelTerakhir).lastAutoTable.finalY;
}

/** Gambar kotak kartu dengan sudut membulat. */
function kartu(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: [number, number, number],
) {
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
}

/** Teks dengan warna RGB. */
function teks(
  doc: jsPDF,
  teks: string,
  x: number,
  y: number,
  opts?: { size?: number; bold?: boolean; warna?: [number, number, number]; align?: "left" | "right" | "center" },
) {
  const size = opts?.size ?? 10;
  const bold = opts?.bold ?? false;
  const warna = opts?.warna ?? W.espresso;
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(warna[0], warna[1], warna[2]);
  doc.text(teks, x, y, { align: opts?.align ?? "left" });
}

export function buatPdfPenjualan(data: DataPdfPenjualan): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const margin = 18;
  const isiLebar = lebar - margin * 2;
  let y = 0;

  // ============ HEADER BERMEREK ============
  // Background coffee ink full-width
  doc.setFillColor(W.coffeeInk[0], W.coffeeInk[1], W.coffeeInk[2]);
  doc.rect(0, 0, lebar, 38, "F");

  // Accent terracotta strip
  doc.setFillColor(W.terracotta[0], W.terracotta[1], W.terracotta[2]);
  doc.rect(0, 38, lebar, 1.5, "F");

  // Logo asli (base64 PNG 64x64) di lingkaran coffee ink
  const lx = margin;
  const ly = 12;
  doc.addImage(LOGO_PDF_BASE64, "PNG", lx + 1, ly + 1, 12, 12);

  // Brand name
  teks(doc, "Kataloji Coffee and Eatery", lx + 20, ly + 5, {
    size: 15,
    bold: true,
    warna: W.cream,
  });
  teks(doc, "Laporan Penjualan", lx + 20, ly + 12, {
    size: 10,
    warna: [180, 165, 150],
  });

  // Periode di kanan
  teks(doc, data.periodeLabel, lebar - margin, ly + 5, {
    size: 9,
    warna: [180, 165, 150],
    align: "right",
  });
  teks(doc, `Dibuat ${data.dibuatPada}`, lebar - margin, ly + 11, {
    size: 8,
    warna: [160, 145, 130],
    align: "right",
  });

  y = 50;
  const { ringkas } = data;

  // ============ KARTU RINGKASAN (4 kartu) ============
  const kartuW = (isiLebar - 9) / 4;
  const kartuH = 22;

  const kartuData = [
    { label: "Omzet Bersih", nilai: rupiah(ringkas.omzet), warna: W.terracotta },
    { label: "Transaksi", nilai: String(ringkas.jumlah), warna: W.sage },
    { label: "Rata per Struk", nilai: rupiah(ringkas.rataRata), warna: W.mustard },
    { label: "Hari Jualan", nilai: `${ringkas.hariJualan} hr`, warna: W.espresso },
  ];

  kartuData.forEach((k, i) => {
    const kx = margin + i * (kartuW + 3);
    kartu(doc, kx, y, kartuW, kartuH, W.cream);
    // Accent bar atas
    doc.setFillColor(k.warna[0], k.warna[1], k.warna[2]);
    doc.rect(kx, y, kartuW, 1.2, "F");
    teks(doc, k.label, kx + 3, y + 7, { size: 7.5, warna: W.muted });
    teks(doc, k.nilai, kx + 3, y + 15, { size: 12, bold: true, warna: W.espresso });
  });

  y += kartuH + 8;

  // ============ DETAIL RINGKASAN ============
  teks(doc, "Rincian Omzet", margin, y, { size: 11, bold: true, warna: W.coffeeInk });
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8, lineColor: W.border, lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { cellWidth: isiLebar - 45 }, 1: { halign: "right", cellWidth: 45 } },
    body: [
      ["Omzet kotor", rupiah(ringkas.bruto)],
      ["Diskon", ringkas.diskon > 0 ? `-${rupiah(ringkas.diskon)}` : rupiah(0)],
      ["Potongan poin", ringkas.potonganPoin > 0 ? `-${rupiah(ringkas.potonganPoin)}` : rupiah(0)],
      ["Omzet bersih", rupiah(ringkas.omzet)],
    ],
    didParseCell: (d) => {
      if (d.row.index === 3) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = W.terracotta;
      }
    },
  });
  y = posisiAkhir(doc) + 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8, lineColor: W.border, lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { cellWidth: isiLebar - 45 }, 1: { halign: "right", cellWidth: 45 } },
    body: [
      ["Jumlah transaksi", String(ringkas.jumlah)],
      ["Rata-rata per transaksi", rupiah(ringkas.rataRata)],
      ["Rata-rata per hari jualan", rupiah(ringkas.rataPerHariJualan)],
    ],
  });
  y = posisiAkhir(doc) + 8;

  // ============ PERBANDINGAN PERIODE ============
  const banding = data.banding;
  if (banding && !banding.tanpaData && banding.sebelumnya) {
    teks(doc, "Perbandingan Periode Sebelumnya", margin, y, {
      size: 11,
      bold: true,
      warna: W.coffeeInk,
    });
    y += 3;

    const arah =
      banding.selisih === null || banding.selisih === 0
        ? "sama"
        : banding.selisih > 0
          ? "naik"
          : "turun";
    const persenTeks =
      banding.persen !== null ? `${banding.persen > 0 ? "+" : ""}${banding.persen}%` : "tidak dihitung";

    // Kartu perbandingan
    kartu(doc, margin, y, isiLebar, 16, W.lightBg);
    teks(doc, banding.sebelumnya.label, margin + 4, y + 6, { size: 8.5, warna: W.muted });
    teks(
      doc,
      `${rupiah(banding.sebelumnya.omzet)} dari ${banding.sebelumnya.jumlah} transaksi`,
      margin + 4,
      y + 12,
      { size: 10, bold: true, warna: W.espresso },
    );

    // Selisih di kanan
    const selisihNilai = banding.selisih ?? 0;
    const selisihWarna = selisihNilai > 0 ? W.sage : selisihNilai < 0 ? W.terracotta : W.muted;
    teks(doc, `Selisih (${arah})`, lebar - margin - 4, y + 6, {
      size: 8.5,
      warna: W.muted,
      align: "right",
    });
    teks(doc, `${rupiahSelisih(selisihNilai)} (${persenTeks})`, lebar - margin - 4, y + 12, {
      size: 10,
      bold: true,
      warna: selisihWarna,
      align: "right",
    });

    y += 16 + 4;

    if (banding.belumSelesai) {
      teks(
        doc,
        "Catatan: periode ini belum selesai, jadi angkanya belum bisa dibanding setara dengan periode sebelumnya yang sudah penuh.",
        margin,
        y,
        { size: 8, warna: W.muted },
      );
      y += 5;
    }
    y += 6;
  }

  // ============ TABEL PER HARI ============
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  teks(doc, "Rincian per Hari", margin, y, { size: 11, bold: true, warna: W.coffeeInk });
  y += 3;

  const barisHarian = ringkas.harian.map((h) => [
    h.tglLabel + (h.terbaik ? " (terbaik)" : ""),
    String(h.jumlah),
    rupiah(h.omzet),
  ]);

  if (barisHarian.length === 0) {
    teks(doc, "Belum ada transaksi di periode ini.", margin, y + 6, {
      size: 10,
      warna: W.muted,
    });
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      headStyles: {
        fillColor: W.coffeeInk,
        textColor: 255,
        fontSize: 8.5,
        fontStyle: "bold",
      },
      styles: { fontSize: 9, cellPadding: 1.8, lineColor: W.border },
      alternateRowStyles: { fillColor: W.lightBg },
      head: [["Tanggal", "Transaksi", "Omzet"]],
      body: barisHarian,
      foot: [["Total", String(ringkas.jumlah), rupiah(ringkas.omzet)]],
      footStyles: {
        fillColor: W.terracotta,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: isiLebar - 60 },
        1: { halign: "right", cellWidth: 25 },
        2: { halign: "right", cellWidth: 35 },
      },
    });
    y = posisiAkhir(doc) + 8;
  }

  // ============ FOOTER ============
  const halaman = doc.getNumberOfPages();
  for (let i = 1; i <= halaman; i++) {
    doc.setPage(i);
    const tinggiPage = doc.internal.pageSize.getHeight();
    // Garis footer
    doc.setDrawColor(W.border[0], W.border[1], W.border[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, tinggiPage - 14, lebar - margin, tinggiPage - 14);
    // Brand
    teks(doc, "Kataloji Coffee and Eatery - Laporan Penjualan", margin, tinggiPage - 9, {
      size: 7.5,
      warna: W.muted,
    });
    teks(doc, `Halaman ${i} dari ${halaman}`, lebar - margin, tinggiPage - 9, {
      size: 7.5,
      warna: W.muted,
      align: "right",
    });
  }

  // Catatan akhir
  if (y < 260) {
    teks(
      doc,
      "Omzet bersih dihitung setelah diskon promo dan potongan poin, jadi angkanya sama dengan yang masuk laci.",
      margin,
      y,
      { size: 8, warna: W.muted },
    );
  }

  return doc.output("blob");
}

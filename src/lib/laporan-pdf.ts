/**
 * Pembuat PDF laporan analitik - Kataloji CRM
 *
 * Layout premium A4 dengan brand identity Kataloji.
 * Format direset total: header bermerek, kartu ringkasan,
 * tabel bersih dengan warna brand, footer halaman.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const AMBANG_MENU_LAPORAN = 20;
export const AMBANG_SETIA_LAPORAN = 3;

export interface DataPdf {
  periodeLabel: string;
  dibuatPada: string;
  jumlahTransaksi: number;
  omzet: number;
  jam: { jam: number; jumlah: number }[];
  hari: { nama: string; omzet: number }[];
  menu: { nama: string; qty: number; persen: number }[];
  totalItemTerjual: number;
  setia: { nama: string; kunjungan: number; omzet: number }[];
  jumlahPelangganDatang: number;
}

// Warna brand
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
const jamLabel = (j: number) => `${String(j).padStart(2, "0")}.00`;

type TabelTerakhir = { lastAutoTable: { finalY: number } };
function posisiAkhir(doc: jsPDF): number {
  return (doc as unknown as TabelTerakhir).lastAutoTable.finalY;
}

function kartu(doc: jsPDF, x: number, y: number, w: number, h: number, bg: [number, number, number]) {
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
}

function teks(
  doc: jsPDF,
  teksStr: string,
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
  doc.text(teksStr, x, y, { align: opts?.align ?? "left" });
}

export function buatPdfLaporan(data: DataPdf): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const margin = 18;
  const isiLebar = lebar - margin * 2;
  let y = 0;

  // ============ HEADER BERMEREK ============
  doc.setFillColor(W.coffeeInk[0], W.coffeeInk[1], W.coffeeInk[2]);
  doc.rect(0, 0, lebar, 38, "F");
  doc.setFillColor(W.terracotta[0], W.terracotta[1], W.terracotta[2]);
  doc.rect(0, 38, lebar, 1.5, "F");

  // Logo monogram
  const lx = margin;
  const ly = 12;
  doc.setFillColor(W.terracotta[0], W.terracotta[1], W.terracotta[2]);
  doc.circle(lx + 7, ly + 7, 7, "F");
  teks(doc, "K", lx + 7, ly + 10, { size: 16, bold: true, warna: W.cream, align: "center" });

  teks(doc, "Kataloji Coffee and Eatery", lx + 20, ly + 5, { size: 15, bold: true, warna: W.cream });
  teks(doc, "Laporan Analitik", lx + 20, ly + 12, { size: 10, warna: [180, 165, 150] });

  teks(doc, data.periodeLabel, lebar - margin, ly + 5, { size: 9, warna: [180, 165, 150], align: "right" });
  teks(doc, `Dibuat ${data.dibuatPada}`, lebar - margin, ly + 11, { size: 8, warna: [160, 145, 130], align: "right" });

  y = 50;

  // ============ KARTU RINGKASAN ============
  const kartuW = (isiLebar - 6) / 2;
  const kartuH = 20;

  kartu(doc, margin, y, kartuW, kartuH, W.cream);
  doc.setFillColor(W.terracotta[0], W.terracotta[1], W.terracotta[2]);
  doc.rect(margin, y, kartuW, 1.2, "F");
  teks(doc, "Total Transaksi", margin + 4, y + 7, { size: 7.5, warna: W.muted });
  teks(doc, String(data.jumlahTransaksi), margin + 4, y + 15, { size: 14, bold: true, warna: W.terracotta });

  const kx2 = margin + kartuW + 6;
  kartu(doc, kx2, y, kartuW, kartuH, W.cream);
  doc.setFillColor(W.sage[0], W.sage[1], W.sage[2]);
  doc.rect(kx2, y, kartuW, 1.2, "F");
  teks(doc, "Omzet Bersih", kx2 + 4, y + 7, { size: 7.5, warna: W.muted });
  teks(doc, rupiah(data.omzet), kx2 + 4, y + 15, { size: 14, bold: true, warna: W.sage });

  y += kartuH + 10;

  // ============ BAGIAN TABEL ============
  function bagianTabel(judul: string, bangun: () => Isi): number {
    let posisi = y;
    if (posisi > 235) {
      doc.addPage();
      posisi = 20;
    }
    teks(doc, judul, margin, posisi, { size: 10.5, bold: true, warna: W.coffeeInk });
    posisi += 3;

    const isi = bangun();
    if ("teks" in isi) {
      kartu(doc, margin, posisi, isiLebar, 14, W.lightBg);
      const baris = doc.splitTextToSize(isi.teks, isiLebar - 8);
      teks(doc, baris.join(" "), margin + 4, posisi + 9, { size: 9, warna: W.muted });
      return posisi + 14 + 6;
    }

    autoTable(doc, {
      startY: posisi,
      margin: { left: margin, right: margin },
      head: isi.head,
      body: isi.body,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8, lineColor: W.border },
      headStyles: { fillColor: W.coffeeInk, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: W.lightBg },
      columnStyles: Object.fromEntries(
        isi.head[0].map((_, i) => [i, { halign: new Set(isi.kanan).has(i) ? "right" : "left" }]),
      ),
    });
    return posisiAkhir(doc) + 8;
  }

  // Jam ramai
  y = bagianTabel("Jam Ramai", () => {
    const aktif = data.jam.filter((j) => j.jumlah > 0);
    if (aktif.length === 0) return { teks: "Belum ada transaksi pada jam buka." };
    return {
      head: [["Jam", "Transaksi"]],
      body: data.jam.map((j) => [jamLabel(j.jam), String(j.jumlah)]),
      kanan: [1],
    };
  });

  // Omzet per hari
  y = bagianTabel("Omzet per Hari", () => ({
    head: [["Hari", "Omzet Bersih"]],
    body: data.hari.map((h) => [h.nama, rupiah(h.omzet)]),
    kanan: [1],
  }));

  // Menu terlaris
  y = bagianTabel("Menu Terlaris", () => {
    if (data.totalItemTerjual < AMBANG_MENU_LAPORAN) {
      return {
        teks: `Ditahan: baru ${data.totalItemTerjual} item terjual. Peringkat menu baru bisa dipercaya setelah ${AMBANG_MENU_LAPORAN} item terjual.`,
      };
    }
    return {
      head: [["No", "Menu", "Terjual", "Porsi"]],
      body: data.menu.map((m, i) => [String(i + 1), m.nama, String(m.qty), `${m.persen}%`]),
      kanan: [2, 3],
    };
  });

  // Pelanggan setia
  y = bagianTabel("Pelanggan Paling Sering Datang", () => {
    if (data.jumlahPelangganDatang < AMBANG_SETIA_LAPORAN) {
      return {
        teks: `Ditahan: baru ${data.jumlahPelangganDatang} pelanggan datang. Peringkat baru bisa dipercaya setelah ${AMBANG_SETIA_LAPORAN} pelanggan datang.`,
      };
    }
    return {
      head: [["No", "Pelanggan", "Kunjungan", "Omzet"]],
      body: data.setia.map((s, i) => [String(i + 1), s.nama, `${s.kunjungan} hari`, rupiah(s.omzet)]),
      kanan: [2, 3],
    };
  });

  // ============ FOOTER ============
  const halaman = doc.getNumberOfPages();
  for (let i = 1; i <= halaman; i++) {
    doc.setPage(i);
    const tinggiPage = doc.internal.pageSize.getHeight();
    doc.setDrawColor(W.border[0], W.border[1], W.border[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, tinggiPage - 14, lebar - margin, tinggiPage - 14);
    teks(doc, "Kataloji Coffee and Eatery - Laporan Analitik", margin, tinggiPage - 9, {
      size: 7.5,
      warna: W.muted,
    });
    teks(doc, `Halaman ${i} dari ${halaman}`, lebar - margin, tinggiPage - 9, {
      size: 7.5,
      warna: W.muted,
      align: "right",
    });
  }

  return doc.output("blob");
}

type Isi = { teks: string } | { head: string[][]; body: string[][]; kanan: number[] };

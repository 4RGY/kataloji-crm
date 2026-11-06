/**
 * Pembuat PDF laporan loyalitas - Kataloji CRM
 *
 * Layout premium A4 dengan brand identity Kataloji.
 * Isinya sengaja diarahkan ke program loyalitas: siapa yang datang lagi,
 * berapa poin yang beredar, siapa yang mendekati hadiah, dan siapa yang
 * poinnya berisiko hangus. Bagian operasional kedai (jam ramai, menu
 * terlaris) tidak lagi dilaporkan di sini karena bukan tujuan CRM.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_PDF_BASE64 } from "@/lib/logo-pdf";

export const AMBANG_MENU_LAPORAN = 20;
export const AMBANG_SETIA_LAPORAN = 3;

export interface DataPdf {
  periodeLabel: string;
  dibuatPada: string;
  jumlahTransaksi: number;
  omzet: number;
  hari: { nama: string; omzet: number }[];

  // ---- Bagian loyalitas ----
  /** Berapa transaksi yang tertaut ke pelanggan terdaftar. */
  tertaut: number;
  /** Berapa transaksi yang tidak diketahui siapa pelakunya. */
  tanpaPelanggan: number;
  /** Persen transaksi tertaut, 0 sampai 100. */
  persenTertaut: number;
  /** Pelanggan yang tercatat pada periode ini. */
  jumlahPelangganAktif: number;
  /** Saldo poin seluruh pelanggan saat laporan dibuat. */
  poinBeredar: number;
  /** Nilai rupiah dari poin beredar. */
  nilaiPoinBeredar: number;
  /** Jumlah pelanggan terdaftar seluruhnya. */
  jumlahPelanggan: number;
  /** Sebaran pelanggan menurut saldo poin. */
  sebaranPoin: { label: string; jumlah: number }[];
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

  // Logo asli (base64 PNG 64x64)
  const lx = margin;
  const ly = 12;
  doc.addImage(LOGO_PDF_BASE64, "PNG", lx + 1, ly + 1, 12, 12);

  teks(doc, "Kataloji Coffee and Eatery", lx + 20, ly + 5, { size: 15, bold: true, warna: W.cream });
  teks(doc, "Laporan Loyalitas Pelanggan", lx + 20, ly + 12, { size: 10, warna: [180, 165, 150] });

  teks(doc, data.periodeLabel, lebar - margin, ly + 5, { size: 9, warna: [180, 165, 150], align: "right" });
  teks(doc, `Dibuat ${data.dibuatPada}`, lebar - margin, ly + 11, { size: 8, warna: [160, 145, 130], align: "right" });

  y = 50;

  // ============ KARTU RINGKASAN ============
  // Empat kartu dua baris. Ukuran dan posisinya dihitung dari lebar isi
  // supaya tetap rapi kalau margin diubah, bukan dari angka tetap.
  const kolom = 2;
  const jeda = 6;
  const kartuW = (isiLebar - jeda * (kolom - 1)) / kolom;
  const kartuH = 20;

  const kartuRingkas: { label: string; nilai: string; warna: [number, number, number] }[] = [
    { label: "Transaksi Tertaut", nilai: `${data.tertaut}`, warna: W.terracotta },
    { label: "Pelanggan Aktif", nilai: `${data.jumlahPelangganAktif}`, warna: W.sage },
    { label: "Poin Beredar", nilai: data.poinBeredar.toLocaleString("id-ID"), warna: W.mustard },
    { label: "Nilai Poin Beredar", nilai: rupiah(data.nilaiPoinBeredar), warna: W.espresso },
  ];

  kartuRingkas.forEach((k, i) => {
    const kolomKe = i % kolom;
    const barisKe = Math.floor(i / kolom);
    const x = margin + kolomKe * (kartuW + jeda);
    const ky = y + barisKe * (kartuH + jeda);

    kartu(doc, x, ky, kartuW, kartuH, W.cream);
    doc.setFillColor(k.warna[0], k.warna[1], k.warna[2]);
    doc.rect(x, ky, kartuW, 1.2, "F");
    teks(doc, k.label.toUpperCase(), x + 4, ky + 7, { size: 7.5, warna: W.muted });
    teks(doc, k.nilai, x + 4, ky + 15, { size: 14, bold: true, warna: k.warna });
  });

  y += kartuH * 2 + jeda + 10;

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

  // Keterikatan transaksi ke pelanggan. Ini angka paling menentukan di
  // program loyalitas: transaksi tanpa identitas tidak menghasilkan data
  // apa pun tentang siapa yang datang.
  y = bagianTabel("Transaksi Beridentitas", () => ({
    head: [["Keterangan", "Transaksi", "Porsi"]],
    body: [
      ["Tertaut ke pelanggan", `${data.tertaut}`, `${data.persenTertaut}%`],
      ["Tanpa identitas", `${data.tanpaPelanggan}`, `${100 - data.persenTertaut}%`],
      ["Total", `${data.jumlahTransaksi}`, "100%"],
    ],
    kanan: [1, 2],
  }));

  // Sebaran saldo poin
  y = bagianTabel("Sebaran Saldo Poin", () => {
    if (data.jumlahPelanggan === 0) {
      return { teks: "Belum ada pelanggan terdaftar." };
    }
    return {
      head: [["Rentang Poin", "Pelanggan", "Porsi"]],
      body: data.sebaranPoin.map((s) => [
        s.label,
        `${s.jumlah}`,
        `${Math.round((s.jumlah / Math.max(1, data.jumlahPelanggan)) * 100)}%`,
      ]),
      kanan: [1, 2],
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

  // Omzet per hari
  y = bagianTabel("Omzet per Hari", () => {
    if (data.hari.length === 0) {
      return { teks: "Belum ada omzet pada periode ini." };
    }
    return {
      head: [["Hari", "Omzet Bersih"]],
      body: data.hari.map((h) => [h.nama, rupiah(h.omzet)]),
      kanan: [1],
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
    teks(doc, "Kataloji Coffee and Eatery - Laporan Loyalitas Pelanggan", margin, tinggiPage - 9, {
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

/**
 * Pembuat PDF laporan penjualan.
 *
 * Angka yang masuk sudah dihitung halaman Laporan penjualan lewat
 * `ringkasPenjualan`, jadi PDF memakai angka yang sama persis dengan layar,
 * termasuk rumus omzet bersih yang sama dengan Dashboard dan Analitik.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PerbandinganPenjualan, RingkasanPenjualan } from "@/lib/laporan-penjualan";

export interface DataPdfPenjualan {
  /** Judul periode, contoh "1 Okt 2026 s.d. 31 Okt 2026". */
  periodeLabel: string;
  /** Waktu pembuatan laporan, sudah diformat. */
  dibuatPada: string;
  ringkas: RingkasanPenjualan;
  /** Perbandingan periode sebelumnya, bila ada. */
  banding?: PerbandinganPenjualan | null;
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/** Selisih bisa negatif: tandanya di depan "Rp", bukan menempel angkanya. */
const rupiahSelisih = (n: number) =>
  n < 0
    ? `-Rp ${Math.round(Math.abs(n)).toLocaleString("id-ID")}`
    : `+Rp ${Math.round(n).toLocaleString("id-ID")}`;

/** Posisi akhir tabel terakhir yang digambar autoTable. */
type TabelTerakhir = { lastAutoTable: { finalY: number } };

function posisiAkhirTabel(doc: jsPDF): number {
  return (doc as unknown as TabelTerakhir).lastAutoTable.finalY;
}

/** Susun PDF laporan penjualan dan kembalikan sebagai Blob. */
export function buatPdfPenjualan(data: DataPdfPenjualan): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;
  const { ringkas } = data;

  // Judul
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Penjualan Kataloji", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(data.periodeLabel, margin, y);
  y += 5;
  doc.text(`Dibuat ${data.dibuatPada}`, margin, y);
  doc.setTextColor(0);
  y += 8;

  // Ringkasan
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ringkasan", margin, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.4 },
    columnStyles: { 0: { cellWidth: lebar - margin * 2 - 40 }, 1: { halign: "right" } },
    body: [
      ["Omzet kotor", rupiah(ringkas.bruto)],
      ["Diskon", ringkas.diskon > 0 ? `-${rupiah(ringkas.diskon)}` : rupiah(0)],
      [
        "Potongan poin",
        ringkas.potonganPoin > 0 ? `-${rupiah(ringkas.potonganPoin)}` : rupiah(0),
      ],
      ["Omzet bersih", rupiah(ringkas.omzet)],
    ],
  });
  y = posisiAkhirTabel(doc) + 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.4 },
    columnStyles: { 0: { cellWidth: lebar - margin * 2 - 40 }, 1: { halign: "right" } },
    body: [
      ["Jumlah transaksi", String(ringkas.jumlah)],
      ["Rata-rata per transaksi", rupiah(ringkas.rataRata)],
      ["Hari jualan", `${ringkas.hariJualan} hari`],
      ["Rata-rata per hari jualan", rupiah(ringkas.rataPerHariJualan)],
    ],
  });
  y = posisiAkhirTabel(doc) + 10;

  // Perbandingan periode sebelumnya, kalau ada datanya. Kalimat ragu ikut
  // dicetak supaya pembaca PDF tidak menyimpulkan penurunan padahal periode
  // pembandingnya belum selesai.
  const banding = data.banding;
  if (banding && !banding.tanpaData && banding.sebelumnya) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Dibanding periode sebelumnya", margin, y);
    y += 2;

    const arah =
      banding.selisih === null || banding.selisih === 0
        ? "sama"
        : banding.selisih > 0
          ? "naik"
          : "turun";
    const persenTeks =
      banding.persen !== null
        ? `${banding.persen > 0 ? "+" : ""}${banding.persen}%`
        : "tidak dihitung";

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 1.4 },
      columnStyles: { 0: { cellWidth: lebar - margin * 2 - 40 }, 1: { halign: "right" } },
      body: [
        [banding.sebelumnya.label, `${rupiah(banding.sebelumnya.omzet)} dari ${banding.sebelumnya.jumlah} transaksi`],
        [
          `Selisih (${arah})`,
          `${rupiahSelisih(banding.selisih ?? 0)}  (${persenTeks})`,
        ],
      ],
    });
    y = posisiAkhirTabel(doc) + 4;

    if (banding.belumSelesai) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      const ragu = doc.splitTextToSize(
        "Catatan: periode ini belum selesai, jadi angkanya belum bisa dibanding setara dengan periode sebelumnya yang sudah penuh.",
        lebar - margin * 2,
      );
      doc.text(ragu, margin, y);
      doc.setTextColor(0);
      y += ragu.length * 4;
    }
    y += 6;
  }

  // Rincian per hari
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Per hari", margin, y);
  y += 2;

  const barisHarian = ringkas.harian.map((h) => [
    h.tglLabel + (h.terbaik ? "  (terbaik)" : ""),
    String(h.jumlah),
    rupiah(h.omzet),
  ]);

  if (barisHarian.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Belum ada transaksi di periode ini.", margin, y + 6);
    doc.setTextColor(0);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "striped",
      headStyles: { fillColor: [40, 40, 40], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 1.6 },
      head: [["Tanggal", "Transaksi", "Omzet"]],
      body: barisHarian,
      foot: [["Total", String(ringkas.jumlah), rupiah(ringkas.omzet)]],
      footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: lebar - margin * 2 - 60 },
        1: { halign: "right", cellWidth: 26 },
        2: { halign: "right", cellWidth: 34 },
      },
    });
    y = posisiAkhirTabel(doc) + 8;
  }

  // Catatan
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  const catatan = doc.splitTextToSize(
    "Omzet bersih dihitung setelah diskon promo dan potongan poin, jadi angkanya sama dengan yang masuk laci. " +
      "Transaksi yang tanggal laporannya tidak terbaca tetap dihitung di total, tetapi tidak muncul di rincian per hari.",
    lebar - margin * 2,
  );
  doc.text(catatan, margin, y);
  doc.setTextColor(0);

  return doc.output("blob");
}

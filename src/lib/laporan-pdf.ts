/**
 * Pembuat PDF laporan analitik.
 *
 * Data masuk sudah disaring periode dan sudah dihitung halaman Analitik,
 * jadi PDF memakai angka yang sama dengan layar. Bagian yang di layar
 * ditahan (data terlalu sedikit) juga ditahan di PDF, dengan kalimat
 * penjelasan, bukan diisi angka.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
/** Ambang sama dengan halaman Analitik: menu ditahan di bawah 20 item, setia di bawah 3 pelanggan. */
export const AMBANG_MENU_LAPORAN = 20;
export const AMBANG_SETIA_LAPORAN = 3;

export interface DataPdf {
  /** Judul periode, contoh "Minggu ini, 12 Okt 2026 sampai 18 Okt 2026". */
  periodeLabel: string;
  /** Waktu pembuatan laporan, sudah diformat. */
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

const rupiah = (n: number) =>
  `Rp ${Math.round(n).toLocaleString("id-ID")}`;

const jamLabel = (j: number) => `${String(j).padStart(2, "0")}.00`;

/** Posisi akhir tabel terakhir yang digambar autoTable. Paket tidak menyediakan tipenya. */
type TabelTerakhir = { lastAutoTable: { finalY: number } };

function posisiAkhirTabel(doc: jsPDF): number {
  return (doc as unknown as TabelTerakhir).lastAutoTable.finalY;
}

/** Susun PDF dan kembalikan sebagai Blob. */
export function buatPdfLaporan(data: DataPdf): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  // Judul
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Analitik Kataloji", margin, y);
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
    head: [["Transaksi", "Omzet bersih"]],
    body: [[String(data.jumlahTransaksi), rupiah(data.omzet)]],
    styles: { font: "helvetica", fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: { 0: { halign: "right" }, 1: { halign: "right" } },
  });
  y = posisiAkhirTabel(doc) + 8;

  // Jam ramai
  y = bagianTabel(doc, y, margin, "Jam ramai", () => {
    const aktif = data.jam.filter((j) => j.jumlah > 0);
    if (aktif.length === 0) return { teks: "Belum ada transaksi pada jam buka." };
    return {
      head: [["Jam", "Transaksi"]],
      body: data.jam.map((j) => [jamLabel(j.jam), String(j.jumlah)]),
      kanan: [1],
    };
  });

  // Hari
  y = bagianTabel(doc, y, margin, "Omzet per hari", () => ({
    head: [["Hari", "Omzet bersih"]],
    body: data.hari.map((h) => [h.nama, rupiah(h.omzet)]),
    kanan: [1],
  }));

  // Menu terlaris (ditahan bila item di bawah ambang)
  y = bagianTabel(doc, y, margin, "Menu terlaris", () => {
    if (data.totalItemTerjual < AMBANG_MENU_LAPORAN) {
      return {
        teks: `Ditahan: baru ${data.totalItemTerjual} item terjual. Peringkat menu baru bisa dipercaya setelah ${AMBANG_MENU_LAPORAN} item terjual.`,
      };
    }
    return {
      head: [["No", "Menu", "Terjual", "Porsi (%)"]],
      body: data.menu.map((m, i) => [String(i + 1), m.nama, String(m.qty), String(m.persen)]),
      kanan: [2, 3],
    };
  });

  // Pelanggan setia (ditahan bila pelanggan datang di bawah ambang)
  y = bagianTabel(doc, y, margin, "Pelanggan paling sering datang", () => {
    if (data.jumlahPelangganDatang < AMBANG_SETIA_LAPORAN) {
      return {
        teks: `Ditahan: baru ${data.jumlahPelangganDatang} pelanggan datang. Peringkat baru bisa dipercaya setelah ${AMBANG_SETIA_LAPORAN} pelanggan datang.`,
      };
    }
    return {
      head: [["No", "Pelanggan", "Kunjungan (hari)", "Omzet bersih"]],
      body: data.setia.map((s, i) => [String(i + 1), s.nama, String(s.kunjungan), rupiah(s.omzet)]),
      kanan: [2, 3],
    };
  });

  // Nomor halaman
  const halaman = doc.getNumberOfPages();
  for (let i = 1; i <= halaman; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Halaman ${i} dari ${halaman}`, lebar - margin, 290, { align: "right" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}

type Isi =
  | { teks: string }
  | { head: string[][]; body: string[][]; kanan: number[] };

/** Gambar satu bagian: judul, lalu tabel atau kalimat penjelasan. */
function bagianTabel(
  doc: jsPDF,
  y: number,
  margin: number,
  judul: string,
  bangun: () => Isi,
): number {
  let posisi = y;
  // Pindah halaman bila judul + sedikit isi tidak muat, supaya tabel tidak terpotong di tepi.
  if (posisi > 230) {
    doc.addPage();
    posisi = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(judul, margin, posisi);
  posisi += 3;

  const isi = bangun();
  if ("teks" in isi) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    const baris = doc.splitTextToSize(isi.teks, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(baris, margin, posisi + 5);
    doc.setTextColor(0);
    return posisi + 5 + baris.length * 5 + 6;
  }

  const kolomKanan = new Set(isi.kanan);
  autoTable(doc, {
    startY: posisi,
    margin: { left: margin, right: margin },
    head: isi.head,
    body: isi.body,
    styles: { font: "helvetica", fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: Object.fromEntries(
      isi.head[0].map((_, i) => [i, { halign: kolomKanan.has(i) ? "right" : "left" }]),
    ),
  });
  return posisiAkhirTabel(doc) + 8;
}

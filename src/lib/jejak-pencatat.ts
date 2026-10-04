/**
 * Logika tampilan jejak pencatat transaksi.
 *
 * Dipisah dari komponen React supaya bisa diuji tanpa merender halaman.
 * Isinya murni: menerima data baris transaksi, mengembalikan teks siap
 * tampil. Tidak ada permintaan jaringan dan tidak ada keadaan.
 *
 * LATAR BELAKANG
 * Kolom `dicatat_oleh_nama` berisi nama staf yang mencatat transaksi, tetapi
 * ada beberapa nilai khusus yang bukan nama orang:
 *
 *   "Sebelum fitur jejak pencatat"  transaksi lama yang dibuat sebelum fitur
 *                                   ini ada. Namanya tidak diketahui dan
 *                                   sengaja TIDAK ditebak, karena catatan
 *                                   audit yang berisi tebakan lebih
 *                                   menyesatkan daripada yang jujur kosong.
 *   "Sistem (tanpa sesi staf)"      jalur tanpa sesi seperti impor data.
 *
 * Nilai khusus itu diperlakukan berbeda di tampilan: ditulis lebih redup
 * dan dengan kalimat yang jelas bahwa itu bukan nama orang. Tujuannya supaya
 * saat audit tidak ada yang salah membaca keduanya sebagai nama staf.
 */

import { kunciHariLaporanAtauNull } from "./hari-laporan";

/** Nilai penanda dari database. Ditulis sekali agar tidak salah ketik. */
export const LABEL_SEBELUM_FITUR = "Sebelum fitur jejak pencatat";
export const LABEL_SISTEM = "Sistem (tanpa sesi staf)";

/** Nilai yang dianggap bukan nama orang. */
export function bukanNamaOrang(nama: string | null | undefined): boolean {
  if (!nama) return true;
  return nama === LABEL_SEBELUM_FITUR || nama.startsWith("Sistem (tanpa sesi");
}

/**
 * Teks siap tampil untuk baris "dicatat oleh".
 *
 * Mengembalikan kalimat lengkap, bukan potongan, supaya pemanggil tidak
 * perlu tahu aturan pembentukan kalimatnya.
 */
export function labelPencatat(nama: string | null | undefined): string {
  if (!nama || !nama.trim()) return "Tanpa jejak pencatat";
  if (nama === LABEL_SEBELUM_FITUR) return "Sebelum fitur ini ada";
  if (nama.startsWith("Sistem (tanpa sesi")) return "Dicatat sistem (impor)";
  return `Dicatat oleh ${nama}`;
}

/**
 * Nama pendek untuk ditampilkan di tempat sempit, misalnya lencana rekap.
 * Untuk nilai bukan nama orang, mengembalikan sebutan yang tetap jujur.
 */
export function namaPendekPencatat(nama: string | null | undefined): string {
  if (!nama || !nama.trim()) return "Tanpa jejak";
  if (nama === LABEL_SEBELUM_FITUR) return "Sebelum fitur ini";
  if (nama.startsWith("Sistem (tanpa sesi")) return "Sistem";
  // Nama orang bisa berupa email kalau akunnya belum punya baris profil.
  // Ambil bagian depannya supaya lencana tidak melebar.
  if (nama.includes("@")) return nama.split("@")[0];
  return nama;
}

/** Inisial untuk avatar kecil pada rekap pencatat. */
export function inisialPencatat(nama: string | null | undefined): string {
  if (!nama || !nama.trim()) return "?";
  if (bukanNamaOrang(nama)) return "?";
  const bersih = nama.includes("@") ? nama.split("@")[0] : nama;
  const bagian = bersih
    .split(/[\s._-]+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (bagian.length === 0) return "?";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

/** Satu baris rekap pencatat, sesuai bentuk view `rekap_pencatat_transaksi`. */
export interface BarisRekapPencatat {
  staf_id: string | null;
  nama: string | null;
  jumlah_transaksi: number;
  total_omzet: number;
  terakhir_mencatat: string | null;
}

/**
 * Urutkan rekap dari yang paling banyak mencatat.
 *
 * Baris "sebelum fitur ini" selalu diletakkan paling bawah meskipun
 * jumlahnya besar. Alasannya: baris itu bukan seorang staf, dan kalau
 * berada di atas justru menutupi bagian yang sedang ditelusuri saat audit.
 */
export function urutkanRekap(
  baris: BarisRekapPencatat[],
): BarisRekapPencatat[] {
  return [...baris].sort((a, b) => {
    const aKhusus = bukanNamaOrang(a.nama) ? 1 : 0;
    const bKhusus = bukanNamaOrang(b.nama) ? 1 : 0;
    if (aKhusus !== bKhusus) return aKhusus - bKhusus;
    if (b.jumlah_transaksi !== a.jumlah_transaksi) {
      return b.jumlah_transaksi - a.jumlah_transaksi;
    }
    return (a.nama ?? "").localeCompare(b.nama ?? "", "id-ID");
  });
}

/**
 * Ringkas rekap menjadi satu kalimat untuk kepala panel.
 * Menyebutkan berapa staf yang tercatat, dan berapa transaksi tanpa jejak.
 */
export function ringkasRekap(baris: BarisRekapPencatat[]): string {
  if (baris.length === 0) return "Belum ada transaksi tercatat.";
  const staf = baris.filter((b) => !bukanNamaOrang(b.nama));
  const tanpaJejak = baris
    .filter((b) => bukanNamaOrang(b.nama))
    .reduce((n, b) => n + b.jumlah_transaksi, 0);

  const bagianStaf =
    staf.length === 0
      ? "Belum ada transaksi yang jejaknya tercatat."
      : `${staf.length} staf sudah tercatat mencatat transaksi.`;

  if (tanpaJejak === 0) return bagianStaf;
  return `${bagianStaf} ${tanpaJejak} transaksi lama belum punya nama pencatat.`;
}

/** Pilihan periode pada halaman rekap. `hari` null berarti sepanjang waktu. */
export const PERIODE_REKAP: { kunci: string; label: string; hari: number | null }[] = [
  { kunci: "7d", label: "7 hari", hari: 7 },
  { kunci: "30d", label: "30 hari", hari: 30 },
  { kunci: "all", label: "Semua", hari: null },
];

/** Satu baris transaksi seperlunya untuk menyusun rekap sendiri. */
export interface BarisTransaksiRekap {
  total: number;
  dicatat_oleh: string | null;
  dicatat_oleh_nama: string | null;
  created_at: string;
  /** Tanggal transaksi di Majoo (H+1), null untuk transaksi manual. */
  tanggal_majoo?: string | null;
}

/**
 * Susun rekap dari daftar transaksi, dengan batas periode.
 *
 * View `rekap_pencatat_transaksi` di database TIDAK bisa disaring periode
 * karena sudah teragregasi. Menyaring per periode harus dilakukan dari baris
 * transaksinya, dan itu sebabnya rekap dihitung ulang di sini alih-alih
 * membaca view tersebut. Hasil dengan `hari = null` harus sama persis
 * dengan isi view, dan itu diuji di harness.
 *
 * Pengelompokan memakai `dicatat_oleh` (id staf) kalau ada. Kalau kosong,
 * barulah namanya dipakai sebagai kunci, supaya baris "sebelum fitur ini"
 * tidak pecah menjadi banyak baris.
 *
 * Batas periode dibandingkan sebagai HARI (kunci YYYY-MM-DD), dengan basis
 * hariLaporan: impor H+1 yang dicatat hari ini untuk transaksi kemarin masuk
 * ke periode berdasarkan tanggal transaksinya, bukan waktu catatnya.
 */
export function susunRekap(
  transaksi: BarisTransaksiRekap[],
  hari: number | null,
  sekarang: Date,
): BarisRekapPencatat[] {
  let batasKunci: string | null = null;
  if (hari !== null) {
    const d = new Date(sekarang);
    d.setDate(d.getDate() - (hari - 1));
    const p = (n: number) => String(n).padStart(2, "0");
    batasKunci = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const peta = new Map<string, BarisRekapPencatat>();

  for (const t of transaksi || []) {
    const kunciLaporan = kunciHariLaporanAtauNull(t);
    // Data tanggal rusak dilewati, tidak dibuatkan hari (prinsip audit:
    // yang tidak valid jangan ditebak). Ini sama dengan perilaku lama
    // "waktu tak terbaca -> skip".
    if (kunciLaporan === null) continue;
    if (batasKunci !== null && kunciLaporan < batasKunci) continue;

    const nama = t.dicatat_oleh_nama ?? LABEL_SEBELUM_FITUR;
    const kunci = t.dicatat_oleh ?? `nama:${nama}`;
    const ada = peta.get(kunci);

    if (ada) {
      ada.jumlah_transaksi += 1;
      ada.total_omzet += Math.max(0, Number(t.total) || 0);
      if (!ada.terakhir_mencatat || t.created_at > ada.terakhir_mencatat) {
        ada.terakhir_mencatat = t.created_at;
      }
    } else {
      peta.set(kunci, {
        staf_id: t.dicatat_oleh,
        nama,
        jumlah_transaksi: 1,
        total_omzet: Math.max(0, Number(t.total) || 0),
        terakhir_mencatat: t.created_at,
      });
    }
  }

  return urutkanRekap([...peta.values()]);
}

/** Rata-rata nilai per struk. Nol transaksi menghasilkan nol, bukan NaN. */
export function rataPerStrukStaf(totalOmzet: number, jumlah: number): number {
  const n = Number(jumlah) || 0;
  if (n <= 0) return 0;
  const o = Number(totalOmzet) || 0;
  return Math.round(o / n);
}

/**
 * Bagian omzet seorang staf terhadap seluruh omzet pada periode itu,
 * dalam persen bulat 0 sampai 100. Dipakai sebagai panjang batang.
 */
export function bagianOmzet(omzetStaf: number, omzetSemua: number): number {
  const semua = Number(omzetSemua) || 0;
  if (semua <= 0) return 0;
  const bagian = Math.round(((Number(omzetStaf) || 0) / semua) * 100);
  return Math.min(100, Math.max(0, bagian));
}

/** Total seluruh baris rekap, untuk baris penutup tabel. */
export function totalRekap(baris: BarisRekapPencatat[]): {
  transaksi: number;
  omzet: number;
} {
  return (baris || []).reduce(
    (a, b) => ({
      transaksi: a.transaksi + (Number(b.jumlah_transaksi) || 0),
      omzet: a.omzet + (Number(b.total_omzet) || 0),
    }),
    { transaksi: 0, omzet: 0 },
  );
}

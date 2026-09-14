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

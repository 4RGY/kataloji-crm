/**
 * Notifikasi yang dihitung dari data yang sudah ada, bukan dari tabel
 * notifikasi tersendiri.
 *
 * Alasannya: tabel notifikasi harus diisi oleh sesuatu, dan kalau pengisinya
 * lupa berjalan, lonceng menjadi sunyi padahal keadaannya mendesak. Dengan
 * menghitung ulang dari pelanggan dan poin, lonceng tidak bisa ketinggalan
 * informasi karena sumbernya sama dengan yang ditampilkan halaman lain.
 *
 * Yang ditandai sudah dibaca disimpan di localStorage, bukan di database.
 * Ini keputusan sadar: statusnya per perangkat, dan kalau kasir berganti
 * iPad, tandanya ikut hilang. Pilihan itu diambil karena notifikasi ini
 * hanya pengingat, bukan catatan yang perlu dipertanggungjawabkan.
 */

import { selisihHari, lencanaPelanggan, type DataLencana } from "./pelanggan-tampilan";
import { AMBANG_HANGUS_HARI } from "./campaign";

export type JenisNotif = "hangus" | "sepi" | "ultah";

export interface Notif {
  /** Tetap sama selama keadaannya belum berubah, supaya tanda dibaca melekat. */
  id: string;
  jenis: JenisNotif;
  judul: string;
  isi: string;
  /** Halaman yang dibuka saat notifikasi ditekan. */
  tautan: string;
  /** Makin kecil makin mendesak. */
  urutan: number;
}

export interface SumberNotif extends DataLencana {
  id: string;
  nama: string;
  poin: number;
  hangusPada?: string | null;
}

/**
 * Susun daftar notifikasi.
 *
 * Notifikasi dikelompokkan, bukan satu baris per pelanggan. Lonceng berisi
 * tiga puluh baris "poin Budi hangus" tidak terbaca dan berakhir diabaikan,
 * sehingga yang benar-benar mendesak justru tenggelam.
 */
export function susunNotifikasi(daftar: SumberNotif[], hariIni: Date): Notif[] {
  const hasil: Notif[] = [];

  const hangus = daftar.filter((p) => {
    if (!p.hangusPada || p.poin <= 0) return false;
    const hari = selisihHari(p.hangusPada, hariIni);
    if (hari === null || hari >= 0) return false;
    return Math.abs(hari) <= AMBANG_HANGUS_HARI;
  });

  if (hangus.length > 0) {
    // Yang paling dekat hangus menentukan kalimatnya: itu yang menjelaskan
    // seberapa mendesak, bukan jumlah orangnya.
    const hariTerdekat = Math.min(
      ...hangus.map((p) => Math.abs(selisihHari(p.hangusPada!, hariIni) ?? 999)),
    );
    const poinTotal = hangus.reduce((s, p) => s + (p.poin || 0), 0);
    hasil.push({
      id: `hangus-${hangus.length}-${hariTerdekat}`,
      jenis: "hangus",
      judul:
        hangus.length === 1
          ? `Poin ${hangus[0].nama} akan hangus`
          : `${hangus.length} pelanggan poinnya akan hangus`,
      isi:
        hariTerdekat === 0
          ? `Total ${poinTotal} poin hangus hari ini.`
          : `Total ${poinTotal} poin, paling cepat hangus ${hariTerdekat} hari lagi.`,
      tautan: "/campaign?segmen=hangus",
      urutan: hariTerdekat,
    });
  }

  const sepi = daftar.filter((p) => lencanaPelanggan(p, hariIni).jenis === "sepi");
  if (sepi.length > 0) {
    hasil.push({
      id: `sepi-${sepi.length}`,
      jenis: "sepi",
      judul: `${sepi.length} pelanggan sudah lama tidak datang`,
      isi: "Terakhir datang lebih dari 45 hari lalu.",
      tautan: "/campaign?segmen=sepi",
      urutan: 100,
    });
  }

  const ultah = daftar.filter((p) => lencanaPelanggan(p, hariIni).jenis === "ultah");
  if (ultah.length > 0) {
    hasil.push({
      id: `ultah-${ultah.length}-${hariIni.getMonth()}`,
      jenis: "ultah",
      judul:
        ultah.length === 1
          ? `${ultah[0].nama} ulang tahun bulan ini`
          : `${ultah.length} pelanggan ulang tahun bulan ini`,
      isi: "Kesempatan mengirim ucapan dan menawarkan sesuatu.",
      tautan: "/campaign?segmen=ultah",
      urutan: 200,
    });
  }

  return hasil.sort((a, b) => a.urutan - b.urutan);
}

/** Notifikasi yang belum ditandai dibaca. */
export function belumDibaca(semua: Notif[], dibaca: string[]): Notif[] {
  const set = new Set(dibaca);
  return semua.filter((n) => !set.has(n.id));
}

/**
 * Angka pada lonceng. Di atas 9 ditulis "9+" supaya lebarnya tidak berubah
 * dan tidak menggeser tata letak header saat angkanya bertambah.
 */
export function angkaLonceng(jumlah: number): string {
  if (jumlah <= 0) return "";
  return jumlah > 9 ? "9+" : String(jumlah);
}

export const KUNCI_SIMPAN = "kataloji.notif.dibaca";

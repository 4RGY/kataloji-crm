// ============================================================
// Hitungan grafik dashboard (murni, tanpa akses jaringan atau jam sistem).
// Dipisah dari halaman supaya bisa diuji dan angkanya tidak bergantung UI.
// ============================================================

/** Batas jumlah porsi sebelum ranking menu dianggap cukup kuat untuk dibaca. Sama dengan AMBANG_MENU di analitik. */
export const AMBANG_MENU_DASHBOARD = 20;

export interface TransaksiGrafik {
  total: number;
  diskon: number;
  metode_bayar: string | null;
  created_at: string;
  items?: unknown;
}

export interface BatangMenu {
  nama: string;
  qty: number;
  /** 0..1 terhadap menu paling laris, untuk lebar batang. */
  porsi: number;
}

/** Ambil nama dan jumlah item dari kolom `items` (array `{nama, qty}`). */
function bacaItem(items: unknown): { nama: string; qty: number }[] {
  if (!Array.isArray(items)) return [];
  const hasil: { nama: string; qty: number }[] = [];
  for (const raw of items as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as { nama?: unknown; qty?: unknown };
    const nama = typeof it.nama === "string" ? it.nama.trim().replace(/\s+/g, " ") : "";
    const qty = Number(it.qty);
    if (!nama || !Number.isFinite(qty) || qty <= 0) continue;
    hasil.push({ nama, qty });
  }
  return hasil;
}

/**
 * Menu terlaris untuk dashboard. Nama dinormalkan supaya "Kopi Susu" dan
 * "kopi susu " dihitung satu. Mengembalikan paling banyak `batas` menu.
 */
export function menuTeratas(transaksi: TransaksiGrafik[], batas = 5): {
  daftar: BatangMenu[];
  totalPorsi: number;
  cukupData: boolean;
} {
  const peta = new Map<string, { nama: string; qty: number }>();
  let totalPorsi = 0;
  for (const t of transaksi) {
    for (const it of bacaItem(t.items)) {
      const kunci = it.nama.toLowerCase();
      const ada = peta.get(kunci);
      if (ada) ada.qty += it.qty;
      else peta.set(kunci, { nama: it.nama, qty: it.qty });
      totalPorsi += it.qty;
    }
  }
  const urut = [...peta.values()].sort((a, b) => b.qty - a.qty).slice(0, batas);
  const tertinggi = urut[0]?.qty ?? 0;
  return {
    daftar: urut.map((m) => ({
      nama: m.nama,
      qty: m.qty,
      porsi: tertinggi > 0 ? m.qty / tertinggi : 0,
    })),
    totalPorsi,
    cukupData: totalPorsi >= AMBANG_MENU_DASHBOARD,
  };
}

export interface IrisanMetode {
  label: string;
  jumlah: number;
  /** 0..1 dari seluruh transaksi di periode. */
  bagian: number;
  /** true untuk transaksi yang belum punya metode tercatat. */
  belumTercatat: boolean;
}

/**
 * Komposisi metode bayar. Transaksi tanpa metode tidak dibuang dan tidak
 * ditebak: dikelompokkan sebagai "Belum tercatat" supaya totalnya tetap utuh.
 */
export function komposisiMetode(transaksi: TransaksiGrafik[]): IrisanMetode[] {
  const peta = new Map<string, number>();
  let belum = 0;
  for (const t of transaksi) {
    const m = (t.metode_bayar ?? "").trim();
    if (!m) {
      belum++;
      continue;
    }
    peta.set(m, (peta.get(m) ?? 0) + 1);
  }
  const total = transaksi.length;
  const hasil: IrisanMetode[] = [...peta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, jumlah]) => ({
      label,
      jumlah,
      bagian: total > 0 ? jumlah / total : 0,
      belumTercatat: false,
    }));
  if (belum > 0) {
    hasil.push({
      label: "Belum tercatat",
      jumlah: belum,
      bagian: total > 0 ? belum / total : 0,
      belumTercatat: true,
    });
  }
  return hasil;
}

export interface TitikTren {
  hari: string;
  nilai: number;
}

/**
 * Tren omzet harian bersih. Hari tanpa transaksi diisi nol agar garis tren
 * jujur soal jeda waktu, bukan melompat dari hari ramai ke hari ramai.
 * `hariAwal` dan `hariAkhir` berbentuk YYYY-MM-DD (lokal).
 */
export function trenOmzet(
  transaksi: { nilai: number; hari: string }[],
  hariAwal: string,
  hariAkhir: string,
): TitikTren[] {
  const peta = new Map<string, number>();
  for (const t of transaksi) {
    peta.set(t.hari, (peta.get(t.hari) ?? 0) + t.nilai);
  }
  const hasil: TitikTren[] = [];
  const cur = new Date(hariAwal + "T00:00:00");
  const akhir = new Date(hariAkhir + "T00:00:00");
  while (cur.getTime() <= akhir.getTime()) {
    const p = (n: number) => String(n).padStart(2, "0");
    const kunci = `${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`;
    hasil.push({ hari: kunci, nilai: peta.get(kunci) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return hasil;
}

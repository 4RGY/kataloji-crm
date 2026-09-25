// ============================================================
// Modul Tulis Impor Majoo, Kataloji CRM
// ============================================================
// Menulis baris hasil parseMajoo() ke Supabase dengan aman dan idempoten:
// mengimpor file yang sama dua kali tidak menghasilkan data ganda.
//
// Kunci dedup:
//   - pelanggan.kode_majoo  (unique partial index, WHERE NOT NULL)
//   - transaksi.external_ref (unique partial index, WHERE NOT NULL)
//
// Kenapa UPSERT manual, bukan .upsert() dari supabase-js: kedua indeks unik
// di atas adalah indeks PARTIAL (hanya berlaku untuk baris non-NULL), dan
// .upsert() mengandalkan pelanggaran unik untuk tahu kapan harus update.
// Indeks partial + kolom nullable membuat .upsert() tidak bisa diandalkan,
// jadi kita SELECT dulu per kunci, lalu INSERT atau UPDATE secara eksplisit.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type BarisPelangganMajoo,
  type BarisTransaksiMajoo,
  cekWhatsappImpor,
} from "./impor-majoo";

// ---------- Tipe hasil ----------

export interface RingkasanImpor {
  pelanggan: {
    dibuat: number;
    diperbarui: number;
    dilewati: number;
    gagal: number;
  };
  transaksi: {
    dibuat: number;
    diperbarui: number;
    dilewati: number;
    gagal: number;
  };
  galat: { baris: number; pesan: string }[];
}

const kosong = () => ({
  pelanggan: { dibuat: 0, diperbarui: 0, dilewati: 0, gagal: 0 },
  transaksi: { dibuat: 0, diperbarui: 0, dilewati: 0, gagal: 0 },
  galat: [] as { baris: number; pesan: string }[],
});

/** Label pencatat untuk jejak audit: jelas bahwa baris berasal dari impor. */
const PENCATAT_IMPOR = "Impor Majoo";

// ---------- Bantuan ambil id pelanggan yang sudah ada ----------

async function cariPelangganByKode(
  admin: SupabaseClient,
  kode: string,
): Promise<string | null> {
  const { data } = await admin
    .from("pelanggan")
    .select("id")
    .eq("kode_majoo", kode)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function cariTransaksiByRef(
  admin: SupabaseClient,
  ref: string,
): Promise<string | null> {
  const { data } = await admin
    .from("transaksi")
    .select("id")
    .eq("external_ref", ref)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// ---------- Tulis pelanggan ----------

async function tulisPelanggan(
  admin: SupabaseClient,
  b: BarisPelangganMajoo,
): Promise<"dibuat" | "diperbarui" | "dilewati" | "gagal"> {
  // Validasi WhatsApp (NOT NULL + CHECK di database). Nomor yang tidak lolos
  // dilewati dengan alasan, bukan di-insert memakai nilai palsu.
  const wa = cekWhatsappImpor(b.whatsapp);
  if (!wa.ok) {
    return "dilewati";
  }

  const kolom = {
    kode_majoo: b.kode_majoo,
    nama: b.nama,
    whatsapp: wa.normal,
    tgl_lahir: b.tgl_lahir || null,
    jenis_kelamin: b.jenis_kelamin || null,
    email: b.email || null,
    alamat: b.alamat || null,
  };

  const sudahAda = await cariPelangganByKode(admin, b.kode_majoo);
  if (sudahAda) {
    const { error } = await admin.from("pelanggan").update(kolom).eq("id", sudahAda);
    return error ? "gagal" : "diperbarui";
  }

  const { error } = await admin.from("pelanggan").insert(kolom);
  return error ? "gagal" : "dibuat";
}

// ---------- Tulis transaksi ----------

async function tulisTransaksi(
  admin: SupabaseClient,
  b: BarisTransaksiMajoo,
): Promise<"dibuat" | "diperbarui" | "dilewati" | "gagal"> {
  // Total wajib (kolom NOT NULL tanpa default). Tanpa nomor transaksi pun
  // sudah disaring di parser, tapi total masih bisa 0 bila sel rusak.
  if (b.total <= 0) {
    return "dilewati";
  }

  const kolom = {
    external_ref: b.external_ref,
    total: b.total,
    metode_bayar: b.metode_bayar || null,
    // items disimpan sebagai jsonb array [{nama, qty}], bentuk yang sama
    // dengan kolom items milik transaksi manual.
    items: b.items.length ? b.items : [],
    // pelanggan_id sengaja NULL: ekspor transaksi Majoo tidak memuat
    // pengenal pelanggan, dan trigger poin otomatis menghasilkan 0 poin
    // untuk transaksi tanpa pelanggan (tidak menyentuh ledger).
    source: "majoo_import",
    dicatat_oleh_nama: PENCATAT_IMPOR,
  };

  const sudahAda = await cariTransaksiByRef(admin, b.external_ref);
  if (sudahAda) {
    const { error } = await admin.from("transaksi").update(kolom).eq("id", sudahAda);
    return error ? "gagal" : "diperbarui";
  }

  const { error } = await admin.from("transaksi").insert(kolom);
  return error ? "gagal" : "dibuat";
}

// ---------- Fungsi utama ----------

export async function tulisImporMajoo(
  admin: SupabaseClient,
  pelanggan: BarisPelangganMajoo[],
  transaksi: BarisTransaksiMajoo[],
): Promise<RingkasanImpor> {
  const ringkas = kosong();

  // Pelanggan dulu, supaya bila suatu saat ekspor transaksi memuat kode
  // pelanggan, relasinya sudah tersedia. Untuk sekarang relasi tetap NULL.
  for (const b of pelanggan) {
    const hasil = await tulisPelanggan(admin, b);
    ringkas.pelanggan[hasil]++;
    if (hasil === "dilewati") {
      const wa = cekWhatsappImpor(b.whatsapp);
      ringkas.galat.push({
        baris: b.baris,
        pesan: `Pelanggan "${b.nama}" dilewati: ${wa.alasan}`,
      });
    } else if (hasil === "gagal") {
      ringkas.galat.push({
        baris: b.baris,
        pesan: `Pelanggan "${b.nama}" gagal ditulis ke database.`,
      });
    }
  }

  for (const b of transaksi) {
    const hasil = await tulisTransaksi(admin, b);
    ringkas.transaksi[hasil]++;
    if (hasil === "dilewati") {
      ringkas.galat.push({
        baris: b.baris,
        pesan: `Transaksi "${b.external_ref}" dilewati: total tidak valid.`,
      });
    } else if (hasil === "gagal") {
      ringkas.galat.push({
        baris: b.baris,
        pesan: `Transaksi "${b.external_ref}" gagal ditulis ke database.`,
      });
    }
  }

  return ringkas;
}

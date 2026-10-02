// ============================================================
// Battery uji aturan poin end-to-end di DB SANGAT SUNGGUHAN.
// Membuktikan perilaku trigger hitung_poin_aturan untuk SEMUA mode,
// penjaga tumpang, dan alur poin-tertahan -> pencocokan.
// Jalankan: npx tsx --env-file=.env.local scripts/uji-aturan-poin-db.mts
// AMAN: try/finally + pre-cleanup marker uji, jadi walau crash pun
// tidak ninggalin sampah di produksi. Semua baris uji bermuatan
// marker "D#####-" (kode_majoo/external_ref) dan nama "Uji D#####".
// ============================================================
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();
let gagal = 0;
const MARK = "D" + String(Date.now()).slice(-5); // "D#####", unik per-jalan.
const PEL = "Uji " + MARK;                        // nama pelanggan uji.

// Pencatatan baris utk cleanup (dibersihkan pasti di finally).
const pelangganIds: string[] = [];
const transaksiIds: string[] = [];
const aturanIds: string[] = [];

function cek(nama: string, kondisi: boolean, detail = "") {
  console.log(`${kondisi ? "PASS" : "FAIL"}  ${nama}${detail ? " -> " + detail : ""}`);
  if (!kondisi) gagal++;
}

/** Hapus semua baris uji yang cocok dengan pola marker (aman utk pre + post). */
async function bersihkanPola() {
  const pel = await admin.from("pelanggan").select("id").ilike("nama", "Uji D____%");
  if (pel.data?.length) {
    await admin.from("point_ledger").delete().in("pelanggan_id", pel.data.map((p) => p.id));
    await admin.from("pelanggan").delete().in("id", pel.data.map((p) => p.id));
  }
  const trx = await admin.from("transaksi").select("id").ilike("external_ref", "D____-%");
  if (trx.data?.length) await admin.from("transaksi").delete().in("id", trx.data.map((t) => t.id));
  const at = await admin.from("aturan_poin").select("id").ilike("keterangan", `uji ${MARK}`);
  if (at.data?.length) await admin.from("aturan_poin").delete().in("id", at.data.map((a) => a.id));
}

async function buatPelanggan() {
  const { data, error } = await admin
    .from("pelanggan")
    .insert({
      kode_majoo: `${MARK}-P${Math.floor(Math.random() * 1e6)}`,
      nama: PEL,
      whatsapp: "0812" + String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 90) + 10),
      tgl_lahir: "2000-01-01",
      jenis_kelamin: "L",
      email: `${MARK}@uji.local`,
    })
    .select("id")
    .single();
  if (error) throw new Error("buat pelanggan: " + error.message);
  pelangganIds.push(data.id as string);
  return data.id as string;
}

async function buatTransaksi(pelangganId: string | null, total: number, tgl: string, source = "crm_manual", kodeMajoo?: string) {
  const { data, error } = await admin
    .from("transaksi")
    .insert({
      pelanggan_id: pelangganId,
      total,
      items: [],
      external_ref: `${MARK}-${Math.random().toString(36).slice(2, 10)}`,
      source,
      tanggal_majoo: tgl,
      ...(kodeMajoo ? { kode_pelanggan_majoo: kodeMajoo, nama_pelanggan_majoo: "Tahan Uji" } : {}),
    })
    .select("id, poin_didapat, status_pencocokan, pelanggan_id")
    .single();
  if (error) throw new Error("buat transaksi: " + error.message);
  transaksiIds.push(data.id as string);
  return data;
}

async function buatAturan(row: {
  mode: string;
  mulai: string;
  selesai: string | null;
  nominal?: number;
}) {
  const { data, error } = await admin
    .from("aturan_poin")
    .insert({ ...row, dibuat_oleh: null, keterangan: `uji ${MARK}` })
    .select("id")
    .single();
  if (error) throw error;
  aturanIds.push(data.id as string);
  return data.id as string;
}

async function run() {
  // ============ A. per_kunjungan ============
  console.log("\n--- A. MODE per_kunjungan ---");
  {
    const p1 = await buatPelanggan();
    await buatAturan({ mode: "per_kunjungan", mulai: "2026-09-01", selesai: "2026-09-30" });
    const TGL = "2026-09-15";
    const t1 = await buatTransaksi(p1, 50000, TGL);
    cek("A1 kunjungan pertama -> 1 poin", t1.poin_didapat === 1, String(t1.poin_didapat));
    const t2 = await buatTransaksi(p1, 50000, TGL);
    cek("A2 repeat order tanggal sama -> 0 poin", t2.poin_didapat === 0, String(t2.poin_didapat));
    const t3 = await buatTransaksi(p1, 50000, "2026-09-20");
    cek("A3 kunjungan tanggal beda -> 1 poin", t3.poin_didapat === 1, String(t3.poin_didapat));
    const tw = await buatTransaksi(null, 50000, TGL);
    cek("A4 walk-in -> 0 poin + status anonim", tw.poin_didapat === 0 && tw.status_pencocokan === "anonim", `${tw.poin_didapat}/${tw.status_pencocokan}`);
    // Hapus aturan -> transaksi baru pakai fallback model lama.
    await admin.from("aturan_poin").delete().eq("id", aturanIds[aturanIds.length - 1]);
    aturanIds.pop();
    const t4 = await buatTransaksi(p1, 40000, "2026-10-10");
    cek("A5 aturan tak berlaku -> fallback 20rb (40000/20000=2)", t4.poin_didapat === 2, String(t4.poin_didapat));
  }

  // ============ B. per_transaksi ============
  console.log("\n--- B. MODE per_transaksi ---");
  {
    const p2 = await buatPelanggan();
    await buatAturan({ mode: "per_transaksi", mulai: "2026-08-01", selesai: "2026-08-31" });
    const t1 = await buatTransaksi(p2, 10000, "2026-08-10");
    cek("B1 transaksi 10rb -> 1 poin (tidak peduli nominal)", t1.poin_didapat === 1, String(t1.poin_didapat));
    const t2 = await buatTransaksi(p2, 500000, "2026-08-11");
    cek("B2 transaksi 500rb -> 1 poin juga", t2.poin_didapat === 1, String(t2.poin_didapat));
    await admin.from("aturan_poin").delete().eq("id", aturanIds[aturanIds.length - 1]);
    aturanIds.pop();
  }

  // ============ C. per_nominal ============
  console.log("\n--- C. MODE per_nominal ---");
  {
    const p3 = await buatPelanggan();
    await buatAturan({ mode: "per_nominal", nominal: 10000, mulai: "2026-07-01", selesai: "2026-07-31" });
    const t1 = await buatTransaksi(p3, 25000, "2026-07-15");
    cek("C1 25000 dgn nominal 10000 -> 2 poin (floor 2.5)", t1.poin_didapat === 2, String(t1.poin_didapat));
    await admin.from("aturan_poin").delete().eq("id", aturanIds[aturanIds.length - 1]);
    aturanIds.pop();
  }

  // ============ D. Penjaga tumpang ============
  console.log("\n--- D. PENJAGA TUMPAING ---");
  {
    const a1 = await buatAturan({ mode: "per_transaksi", mulai: "2026-06-01", selesai: "2026-06-30" });
    const { error: eOv } = await admin
      .from("aturan_poin")
      .insert({ mode: "per_transaksi", mulai: "2026-06-15", selesai: "2026-07-05", dibuat_oleh: null, keterangan: `uji ${MARK}` });
    cek("D1 periode tumpang -> ditolak trigger", !!eOv, eOv ? eOv.message.slice(0, 50) : "seharusnya gagal");
    // Bersebelahan tanpa overlap (06-30 akhir, 07-01 awal) -> boleh.
    const a2 = await buatAturan({ mode: "per_nominal", nominal: 20000, mulai: "2026-07-01", selesai: "2026-07-31" });
    cek("D2 periode bersebelahan (tanpa overlap) -> diterima", true, `a2=${a2.slice(0, 8)}`);
    await admin.from("aturan_poin").delete().in("id", [a1, a2]);
    aturanIds.pop(); aturanIds.pop();
  }

  // ============ E. Alur poin-tertahan -> pencocokan ============
    console.log("\n--- E. POIN TERTAHAN -> PENCOCOKAN ---");
    {
      await buatAturan({ mode: "per_kunjungan", mulai: "2026-05-01", selesai: "2026-05-31" });
      const kodeBaru = `${MARK}-E1`;
      // WAJIB ikut mengoper kode_pelanggan_majoo: tanpa itu statusnya
      // 'anonim' (walk-in), bukan 'menunggu_pencocokan'. Kode ini yang
      // dipakai trigger untuk mencocokkan saat pelanggan menyusul.
      const trxTahan = await buatTransaksi(null, 30000, "2026-05-10", "majoo_import", kodeBaru);
      cek("E1 transaksi impor tanpa pelanggan dikenal -> menunggu_pencocokan", trxTahan.status_pencocokan === "menunggu_pencocokan", String(trxTahan.status_pencocokan));
      cek("E2 poin ditahan (0) sebelum pelanggan ada", trxTahan.poin_didapat === 0, String(trxTahan.poin_didapat));
      // Pelanggan dengan kode_majoo itu datang -> auto-link + hitung poin.
      const { data: pel, error: ePel } = await admin
        .from("pelanggan")
        .insert({ kode_majoo: kodeBaru, nama: PEL, whatsapp: "0812" + String(Date.now()).slice(-6) + "07", tgl_lahir: "2000-01-01", jenis_kelamin: "L", email: `${MARK}-E@uji.local` })
        .select("id, poin")
        .single();
      if (ePel) {
        cek("E3 insert pelanggan", false, ePel.message);
      } else {
        pelangganIds.push(pel.id as string);
        const { data: trxNow } = await admin.from("transaksi").select("status_pencocokan, poin_didapat, pelanggan_id").eq("id", trxTahan.id).single();
        cek("E3 setelah pelanggan masuk -> terhubung", trxNow?.status_pencocokan === "terhubung", String(trxNow?.status_pencocokan));
        cek("E4 poin dihitung saat pencocokan (per_kunjungan=1)", trxNow?.poin_didapat === 1, String(trxNow?.poin_didapat));
        const { data: pelNow } = await admin.from("pelanggan").select("poin").eq("id", pel.id).single();
        cek("E5 cache pelanggan.poin sinkron (1)", pelNow?.poin === 1, String(pelNow?.poin));
      }
      await admin.from("aturan_poin").delete().eq("id", aturanIds[aturanIds.length - 1]);
      aturanIds.pop();
    }
  }

try {
  await bersihkanPola(); // bersihkan sisa dari crash sebelumnya.
  await run();
} catch (e) {
  console.error("ERROR saat uji:", (e as Error).message);
  gagal++;
} finally {
  // CLEANUP PASTI: aturan -> ledger -> transaksi -> pelanggan.
  if (aturanIds.length) await admin.from("aturan_poin").delete().in("id", aturanIds);
  if (pelangganIds.length) await admin.from("point_ledger").delete().in("pelanggan_id", pelangganIds);
  if (transaksiIds.length) await admin.from("transaksi").delete().in("id", transaksiIds);
  if (pelangganIds.length) await admin.from("pelanggan").delete().in("id", pelangganIds);
  await bersihkanPola(); // tangkap apa pun yang lolos pola.
}

// Verifikasi final: tidak ada sisa marker.
const fPel = await admin.from("pelanggan").select("id", { count: "exact", head: true }).ilike("nama", "Uji D____%");
const fTrx = await admin.from("transaksi").select("id", { count: "exact", head: true }).ilike("external_ref", "D____-%");
const fAt = await admin.from("aturan_poin").select("id", { count: "exact", head: true }).ilike("keterangan", `uji ${MARK}`);
console.log(`\nsisa -> pelanggan:${fPel.count} transaksi:${fTrx.count} aturan:${fAt.count}`);
console.log(`\n=== ${gagal === 0 ? "SEMUA LULUS" : gagal + " GAGAL"} (${pelangganIds.length} pelanggan, ${transaksiIds.length} transaksi diuji) ===`);
process.exit(gagal === 0 ? 0 : 1);

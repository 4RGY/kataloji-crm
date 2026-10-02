/**
 * Uji fungsi murni di src/lib/aturan-poin.ts.
 * Tidak butuh database: cukup logika.
 * Jalankan: npx tsx scripts/uji-aturan-poin.mts
 */
import {
  aturanAktif,
  deskripsiMode,
  hitungPoinLokal,
  labelMode,
  validasiInputAturan,
  type BarisAturanPoin,
  type InputAturanBaru,
} from "../src/lib/aturan-poin.ts";

let gagal = 0;
let lulus = 0;
function sama(label: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (ok) lulus++;
  else {
    gagal++;
    console.log(
      "FAIL " + label + "\n  dapat : " + JSON.stringify(dapat) +
        "\n  harus : " + JSON.stringify(harus),
    );
  }
}

const kunjungan: BarisAturanPoin = {
  id: "a",
  mode: "per_kunjungan",
  nominal: null,
  mulai: "2026-10-01",
  selesai: null,
  keterangan: null,
};
const perNominal: BarisAturanPoin = {
  id: "b",
  mode: "per_nominal",
  nominal: 20000,
  mulai: "2026-09-01",
  selesai: "2026-09-30",
  keterangan: null,
};
const perTransaksi: BarisAturanPoin = {
  id: "c",
  mode: "per_transaksi",
  nominal: null,
  mulai: "2026-08-01",
  selesai: "2026-08-31",
  keterangan: null,
};

// ---------- aturanAktif: pilih aturan yang periodenya memuat tanggal ----------
sama(
  "01 Okt jatuh di aturan kunjungan (open-ended)",
  aturanAktif([kunjungan, perNominal], "2026-10-01")?.id,
  "a",
);
sama(
  "15 Sep jatuh di aturan per_nominal",
  aturanAktif([kunjungan, perNominal], "2026-09-15")?.id,
  "b",
);
sama(
  "15 Agu jatuh di aturan per_transaksi",
  aturanAktif([kunjungan, perNominal, perTransaksi], "2026-08-15")?.id,
  "c",
);
sama(
  "tanpa aturan cocok = null (fallback model lama)",
  aturanAktif([], "2026-10-01"),
  null,
);

// ---------- hitungPoinLokal ----------
// Model lama (tanpa aturan): floor(basis/20000), hanya kalau ada pelanggan.
sama(
  "fallback: 80rb dengan pelanggan = 4 poin",
  hitungPoinLokal({ aturan: null, basis: 80000, punyaPelanggan: true, kunjunganKedua: false }),
  4,
);
sama(
  "fallback: 80rb tanpa pelanggan = 0 poin",
  hitungPoinLokal({ aturan: null, basis: 80000, punyaPelanggan: false, kunjunganKedua: false }),
  0,
);

// per_kunjungan: kunjungan pertama = 1, susulan = 0, selalu butuh pelanggan.
sama(
  "per_kunjungan: kunjungan pertama = 1",
  hitungPoinLokal({ aturan: kunjungan, basis: 45000, punyaPelanggan: true, kunjunganKedua: false }),
  1,
);
sama(
  "per_kunjungan: kunjungan kedua = 0",
  hitungPoinLokal({ aturan: kunjungan, basis: 45000, punyaPelanggan: true, kunjunganKedua: true }),
  0,
);
sama(
  "per_kunjungan: walk-in = 0",
  hitungPoinLokal({ aturan: kunjungan, basis: 45000, punyaPelanggan: false, kunjunganKedua: false }),
  0,
);

// per_transaksi: 1 per transaksi, butuh pelanggan, mengabaikan nominal.
sama(
  "per_transaksi: transaksi kecil tetap 1 poin",
  hitungPoinLokal({ aturan: perTransaksi, basis: 12000, punyaPelanggan: true, kunjunganKedua: false }),
  1,
);

// per_nominal: pakai nominal aturan (bukan fallback), butuh pelanggan.
sama(
  "per_nominal 20rb: 45000 = 2 poin",
  hitungPoinLokal({ aturan: perNominal, basis: 45000, punyaPelanggan: true, kunjunganKedua: false }),
  2,
);

// ---------- validasiInputAturan ----------
const dasar: InputAturanBaru = {
  mode: "per_kunjungan",
  mulai: "2026-10-01",
  selesai: "",
  nominal: "",
  keterangan: "",
};
sama("valid: per_kunjungan tanpa nominal", validasiInputAturan(dasar), []);
sama(
  "invalid: per_nominal tanpa nominal",
  validasiInputAturan({ ...dasar, mode: "per_nominal" }).some((e) =>
    e.includes("Nominal"),
  ),
  true,
);
sama(
  "invalid: selesai sebelum mulai",
  validasiInputAturan({ ...dasar, selesai: "2026-09-25" }).some((e) =>
    e.includes("selesai"),
  ),
  true,
);
sama(
  "invalid: tumpang tindih periode",
  validasiInputAturan(
    { ...dasar, mulai: "2026-08-15", selesai: "2026-08-31" },
    [perTransaksi],
  ).some((e) => e.includes("tumpang")),
  true,
);
sama(
  "invalid: mode tidak dikenal",
  validasiInputAturan({ ...dasar, mode: "acak" }).some((e) =>
    e.includes("mode"),
  ),
  true,
);

// ---------- label & deskripsi ----------
sama("label per_kunjungan", labelMode("per_kunjungan"), "Per kunjungan");
sama(
  "deskripsi per_kunjungan menyebut repeat order",
  deskripsiMode(kunjungan).toLowerCase().includes("susulan"),
  true,
);

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal > 0 ? 1 : 0;

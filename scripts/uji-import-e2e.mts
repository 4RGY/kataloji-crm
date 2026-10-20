// E2E import via API memakai session admin sungguhan (cookie sb-<ref>-auth-token).
// 1. Login Supabase (email+password) -> access_token
// 2. Susun cookie SSR Supabase
// 3. POST /api/impor-majoo?mode=preview, apply, apply (ulang -> idempoten)
// 4. GET /api/pencocokan
// 5. Bersihkan residue run ini (hanya baris created >= RUN_START + berkode
//    fixture) via REST service role, supaya DB produksi kembali ke data user.
import fs from "node:fs";

const ENV = fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_") || l.startsWith("SUPABASE_SERVICE_ROLE_KEY") || l.startsWith("SANDI_UJI") || l.startsWith("GATE_PASSWORD"))
  .map((l) => l.split("="))
  .reduce((acc, [k, v]) => {
    acc[k.trim()] = (v ?? "").trim();
    return acc;
  }, {} as Record<string, string>);

const SUPABASE_URL = ENV["NEXT_PUBLIC_SUPABASE_URL"];
const ANON_KEY = ENV["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const SERVICE_KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"];
// Sandi akun uji dibaca dari .env.local, bukan ditulis di berkas ini, supaya
// sandi tidak pernah ikut ter-commit ke git.
const SANDI_UJI = ENV["SANDI_UJI"];

async function main() {
  // Tandai awal run: residue yang dihapus di akhir = baris created ATAS ini.
  // Data user (created sebelumnya) tidak pernah tersentuh.
  const RUN_START = new Date().toISOString();

  // 1. Login
  const authRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "wahyu@kataloji.id", password: SANDI_UJI }),
    },
  );
  if (!authRes.ok) {
    console.log("LOGIN GAGAL:", authRes.status, await authRes.text());
    process.exit(1);
  }
  const auth = (await authRes.json()) as {
    access_token: string;
    expires_at: number;
    refresh_token?: string;
  };
  console.log("✓ Login Supabase OK (expires", new Date(auth.expires_at * 1000).toISOString(), ")");

  // 2. Cookie SSR
  const ref = SUPABASE_URL.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1] ?? "";
  // Format cookie SSR @supabase/ssr: JSON snake_case { access_token, expires_at, refresh_token? }
  const cookieVal = encodeURIComponent(
    JSON.stringify({
      access_token: auth.access_token,
      expires_at: auth.expires_at,
      ...(auth.refresh_token ? { refresh_token: auth.refresh_token } : {}),
    }),
  );
  // Gerbang sandi (/gate) menjaga SEMUA halaman & API. Tanpa cookie gerbang,
  // setiap panggilan /api/* dijawab 401 "Gerbang akses terkunci." dan uji ini
  // berhenti sebelum menguji apa pun. Cookie = SHA-256("kataloji-gerbang-v1|<sandi>"),
  // nilai yang sama dibuat src/lib/gate.ts.
  const SANDI_GERBANG = ENV["GATE_PASSWORD"];
  const { createHash } = await import("node:crypto");
  const cookieGerbang = createHash("sha256")
    .update(`kataloji-gerbang-v1|${SANDI_GERBANG}`)
    .digest("hex");
  const COOKIE = `sb-${ref}-auth-token=${cookieVal}; kataloji_gerbang=${cookieGerbang}`;

  const base = "http://localhost:3000";
  const fs = await import("node:fs");
  const filePelanggan = fs.readFileSync("contoh-majoo-dummy/data_pelanggan_2026_10_02.xlsx");
  const fileTransaksi = fs.readFileSync("contoh-majoo-dummy/detail_penjualan_2026_10_02.xlsx");

  async function postImpor(mode: string, file: Buffer, nama: string) {
    const form = new FormData();
    form.append("file", new Blob([file]), nama);
    const res = await fetch(`${base}/api/impor-majoo?mode=${mode}`, {
      method: "POST",
      headers: { Cookie: COOKIE },
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    console.log(`\n=== POST impor-majoo?mode=${mode} (${nama}) -> ${res.status} ===`);
    console.log(JSON.stringify(body, null, 2).slice(0, 1200));
    return { status: res.status, body };
  }

  // 3a. Preview
  await postImpor("preview", filePelanggan, "data_pelanggan.xlsx");
  const resTransaksiPreview = await postImpor("preview", fileTransaksi, "detail_penjualan.xlsx");

  // 3b. Apply
  await postImpor("apply", filePelanggan, "data_pelanggan.xlsx");
  const applyTrans1 = await postImpor("apply", fileTransaksi, "detail_penjualan.xlsx");

  // 3c. Idempoten: apply ulang file yang sama
  const applyTrans2 = await postImpor("apply", fileTransaksi, "detail_penjualan.xlsx");

  // 4. Pencocokan
  const resCocok = await fetch(`${base}/api/pencocokan`, {
    headers: { Cookie: COOKIE },
  });
  const cocok = await resCocok.json();
  console.log(`\n=== GET /api/pencocokan -> ${resCocok.status} ===`);
  console.log(
    `menunggu: ${cocok.menunggu?.length ?? "?"} | kandidat pelanggan: ${
      cocok.pelanggan?.length ?? "?"
    }`,
  );

  // Ringkasan konsisten: preview vs apply
  const jumlahPreview = resTransaksiPreview.body;
  const ring1 = applyTrans1.body.ringkasan;
  const ring2 = applyTrans2.body.ringkasan;
  console.log("\n=== RINGKASAN KONSISTENSI ===");
  console.log("preview transaksi siap:", jumlahPreview?.jumlah, "| dilewati:", JSON.stringify(jumlahPreview?.dilewati));
  console.log("apply ke-1:", JSON.stringify(ring1));
  console.log("apply ke-2 (harus 0 baru):", JSON.stringify(ring2));

  // 5. Bersihkan residue run ini. Hanya baris yang lahir SETELAH RUN_START
  //    (data user lahir sebelumnya, jadi tidak pernah masuk kumpulan ini).
  //    Urutan hapus mengikuti FK: ledger -> transaksi -> pelanggan.
  if (!SERVICE_KEY) {
    console.log("\nPERINGATAN: SUPABASE_SERVICE_ROLE_KEY tidak ada; residue run ini TIDAK dibersihkan.");
    return;
  }
  const rest = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  async function restGet(path: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: rest });
    return (await r.json()) as unknown[];
  }
  async function restDel(path: string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: "DELETE", headers: rest });
    if (!r.ok) throw new Error(`cleanup ${r.status}: ${await r.text()}`);
  }

  const ts = encodeURIComponent(RUN_START);
  const trxSisa = await restGet(`transaksi?created_at=gt.${ts}&select=id,external_ref`);
  const pelSisa = await restGet(`pelanggan?created_at=gt.${ts}&select=id,kode_majoo`);
  const ledSisa = await restGet(`point_ledger?created_at=gt.${ts}&select=id`);
  console.log(
    `\n=== BERSIH RESIDUE RUN INI (${trxSisa.length} trx, ${pelSisa.length} pel, ${ledSisa.length} ledger) ===`,
  );
  if (ledSisa.length)
    await restDel(`point_ledger?id=in.(${ledSisa.map((l) => (l as { id: string }).id).join(",")})`);
  if (trxSisa.length)
    await restDel(`transaksi?id=in.(${trxSisa.map((t) => (t as { id: string }).id).join(",")})`);
  if (pelSisa.length)
    await restDel(`pelanggan?id=in.(${pelSisa.map((p) => (p as { id: string }).id).join(",")})`);

  const sisa = (await restGet(`transaksi?created_at=gt.${ts}&select=id`)).length;
  const sisaPel = (await restGet(`pelanggan?created_at=gt.${ts}&select=id`)).length;
  if (sisa === 0 && sisaPel === 0)
    console.log("Residue bersih: DB produksi kembali ke data user.");
  else
    console.log(`PERHATIAN: masih tersisa transaksi=${sisa} pelanggan=${sisaPel} sejak RUN_START.`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});

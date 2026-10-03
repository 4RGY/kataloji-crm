// E2E import via API memakai session admin sungguhan (cookie sb-<ref>-auth-token).
// 1. Login Supabase (email+password) -> access_token
// 2. Susun cookie SSR Supabase
// 3. POST /api/impor-majoo?mode=preview, apply, apply (ulang -> idempoten)
// 4. GET /api/pencocokan
import fs from "node:fs";

const ENV = fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_"))
  .map((l) => l.split("="))
  .reduce((acc, [k, v]) => {
    acc[k.trim()] = (v ?? "").trim();
    return acc;
  }, {} as Record<string, string>);

const SUPABASE_URL = ENV["NEXT_PUBLIC_SUPABASE_URL"];
const ANON_KEY = ENV["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

async function main() {
  // 1. Login
  const authRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "wahyu@kataloji.id", password: "kataloji123" }),
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
  const COOKIE = `sb-${ref}-auth-token=${cookieVal}`;

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
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});

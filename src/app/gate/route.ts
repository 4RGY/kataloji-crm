import { NextResponse, type NextRequest } from "next/server";
import {
  NAMA_COOKIE_GATE,
  samaAman,
  sandiGerbang,
  tokenGerbang,
} from "@/lib/gate";

// Halaman gerbang ditulis sebagai HTML polos, sengaja tanpa React/komponen
// aplikasi: halaman ini tampil sebelum apa pun dari aplikasi boleh dimuat.

const HALAMAN = (pesan = "") => `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Kataloji CRM</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center;
    background: #0b0d10; color: #e8e6e1;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  form {
    width: min(360px, 90vw); display: grid; gap: 12px;
    padding: 28px; border-radius: 14px;
    background: #14171c; border: 1px solid #23272e;
  }
  h1 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
  p { margin: 0; color: #9a9da4; font-size: 13px; }
  input {
    padding: 10px 12px; border-radius: 8px; font: inherit;
    background: #0b0d10; color: inherit; border: 1px solid #2c3139;
  }
  input:focus { outline: 2px solid #d9a441; outline-offset: 1px; }
  button {
    padding: 10px 12px; border: 0; border-radius: 8px; font: inherit; font-weight: 600;
    background: #d9a441; color: #0b0d10; cursor: pointer;
  }
  .galat { color: #ff8a80; font-size: 13px; min-height: 1em; }
</style>
</head>
<body>
<form method="post" action="/gate">
  <h1>Kataloji CRM</h1>
  <p>Masukkan sandi akses untuk melanjutkan.</p>
  <input type="password" name="sandi" autocomplete="current-password" required autofocus />
  <button type="submit">Masuk</button>
  <div class="galat">${pesan}</div>
</form>
</body>
</html>`;

function html(isi: string, status = 200) {
  return new NextResponse(isi, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function GET() {
  if (!sandiGerbang()) {
    return html(HALAMAN("Gerbang belum dikonfigurasi (GATE_PASSWORD)."), 503);
  }
  return html(HALAMAN());
}

export async function POST(request: NextRequest) {
  const sandi = sandiGerbang();
  if (!sandi) {
    return html(HALAMAN("Gerbang belum dikonfigurasi (GATE_PASSWORD)."), 503);
  }

  const form = await request.formData();
  const diisi = String(form.get("sandi") ?? "");

  // Bandingkan hash, bukan sandi mentah, supaya panjang sandi tidak bocor
  // lewat selisih waktu.
  const benar = samaAman(await tokenGerbang(diisi), await tokenGerbang(sandi));
  if (!benar) {
    return html(HALAMAN("Sandi salah."), 401);
  }

  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(NAMA_COOKIE_GATE, await tokenGerbang(sandi), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

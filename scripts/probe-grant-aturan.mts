// Probe grant aturan_poin, non-destruktif: replika persis langkah
// panel-aturan-poin (login admin -> insert aturan uji -> bersihkan).
//
// Kalau INSERT gagal dengan permission denied -> BUG: migrasi hanya grant
// SELECT ke authenticated, panel tidak bisa menyimpan aturan baru.
// Semua baris uji dihapus di akhir; tidak menyentuh aturan asli.

import fs from "node:fs";

const ENV = fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_") || l.startsWith("SUPABASE_SERVICE_ROLE_KEY") || l.startsWith("SANDI_UJI"))
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
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.log("GAGAL: env belum lengkap. Jalankan dengan .env.local ter-load.");
  process.exit(1);
}

async function main() {
  // 1. Login admin (JWT authenticated)
  const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "wahyu@kataloji.id", password: SANDI_UJI }),
  });
  if (!login.ok) throw new Error(`login admin gagal: HTTP ${login.status}`);
  const { access_token: jwt } = (await login.json()) as { access_token: string };
  console.log("Login admin OK.");

  const MARK = "PROBE-GRANT-" + Date.now();

  async function rest(jwtOrService: string, path: string, init: { method: string; body?: unknown } = { method: "GET" }) {
    const pakaiService = jwtOrService === "service";
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: init.method,
      headers: {
        apikey: pakaiService ? SERVICE_KEY : ANON_KEY,
        Authorization: `Bearer ${pakaiService ? SERVICE_KEY : jwtOrService}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const teks = await r.text();
    let body: unknown = null;
    try {
      body = teks ? JSON.parse(teks) : null;
    } catch {
      body = teks;
    }
    return { status: r.status, body };
  }

  // 2. INSERT lewat JWT admin, persis seperti panel-aturan-poin.
  //    Periode sengaja jauh ke masa lalu (1900) agar tidak tumpang tindih
  //    aturan mana pun. Kalau grant/RLS kurang, PostgREST balas 401/403
  //    SEBELUM trigger jalan. Kalau balas 23514 = guard overlap = izinnya
  //    lewat, ditolak oleh aturan bisnis.
  console.log("Langkah 1: INSERT aturan_poin via JWT admin");
  const ins = await rest(jwt, "aturan_poin", {
    method: "POST",
    body: {
      mode: "per_transaksi",
      nominal: null,
      mulai: "1900-01-01",
      selesai: "1900-12-31",
      keterangan: MARK,
    },
  });
  console.log(`  HTTP ${ins.status} ${JSON.stringify(ins.body).slice(0, 300)}`);
  const ids: string[] = Array.isArray(ins.body)
    ? (ins.body as { id: string }[]).map((x) => x.id)
    : [];

  // 3. UPDATE + DELETE via JWT admin (kelengkapan tabel grant)
  if (ids.length) {
    const upd = await rest(jwt, `aturan_poin?id=eq.${ids[0]}`, {
      method: "PATCH",
      body: { keterangan: MARK + "-UPD" },
    });
    console.log(`Langkah 2: UPDATE via JWT admin -> HTTP ${upd.status}`);
    const del = await rest(jwt, `aturan_poin?keterangan=eq.${encodeURIComponent(MARK + "-UPD")}`, {
      method: "DELETE",
    });
    console.log(`Langkah 3: DELETE via JWT admin -> HTTP ${del.status}`);
  }

  // 4. Jaring pembersihan lewat service role
  const sisa = await rest("service", `aturan_poin?keterangan=like.${encodeURIComponent(MARK + "%")}`);
  let jumlahSisa = Array.isArray(sisa.body) ? (sisa.body as unknown[]).length : -1;
  if (jumlahSisa > 0) {
    const hapus = await rest("service", `aturan_poin?keterangan=like.${encodeURIComponent(MARK + "%")}`, {
      method: "DELETE",
    });
    console.log(`Pembersihan service role: DELETE HTTP ${hapus.status}`);
    jumlahSisa = 0;
  }
  console.log(`Baris uji ${MARK}* tersisa setelah pembersihan: ${jumlahSisa}`);

  // 5. Vonis
  //    2xx            = insert jalan
  //    403/401        = izin PostgREST/RLS kurang -> BUG grant
  //    400 kode 23514 = overlap guard = izin LEWAT, ditolak aturan bisnis
  const kode = (ins.body as { code?: string })?.code;
  const izinLewat = ins.status < 400 || kode === "23514";
  if (izinLewat) {
    if (ins.status >= 400) {
      console.log("(overlap guard 23514: izin tulis LEWAT RLS, hanya periode yang ditolak)");
    }
    console.log("\n=== VONIS: grant memadai, admin via klien boleh menulis aturan_poin ===");
  } else {
    console.log("\n=== VONIS: BUG GRANT TERBUKTI ===");
    console.log("authenticated TIDAK bisa INSERT aturan_poin.");
    console.log(
      "Panel-aturan-poin (insert dari klien) akan gagap saat admin menyimpan aturan baru.",
    );
    console.log(
      "Opsi fix: (a) grant insert/update/delete on aturan_poin to authenticated di SQL,\n" +
        "  atau (b) pindahkan simpan panel ke API route server dengan kunci service role.",
    );
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});

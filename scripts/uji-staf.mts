/**
 * Uji fungsi murni di src/lib/staf.ts.
 * Tidak butuh database maupun browser: cukup logika.
 *
 * Berkas ini dikecualikan dari tsconfig lewat "exclude": ["scripts"].
 * Alasannya: ini alat uji, bukan bagian aplikasi, dan mengimpor berkas
 * .ts langsung hanya boleh dijalankan tsx, bukan oleh build Next. Kalau
 * ikut diperiksa build, impor itu justru menggagalkan deploy.
 * Jalankan dengan: npx tsx scripts/uji-staf.mts
 */
import {
  validasiStafBaru,
  validasiUbahStaf,
  namaPanggilan,
  inisial,
  isRole,
} from "../src/lib/staf.ts";

let gagal = 0;
let lulus = 0;

function sama(label: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (ok) lulus++;
  else {
    gagal++;
    console.log("FAIL  " + label + "\n      dapat : " + JSON.stringify(dapat) +
      "\n      harus : " + JSON.stringify(harus));
  }
}

function benar(label: string, nilai: boolean) {
  sama(label, nilai, true);
}

// ---------- isRole ----------
benar("isRole admin", isRole("admin"));
benar("isRole manager", isRole("manager"));
benar("isRole kasir", isRole("kasir"));
sama("isRole owner ditolak", isRole("owner"), false);
sama("isRole kosong ditolak", isRole(""), false);
sama("isRole angka ditolak", isRole(1), false);
sama("isRole null ditolak", isRole(null), false);
sama("isRole huruf besar ditolak (peran harus huruf kecil)", isRole("Admin"), false);

// ---------- validasiStafBaru: valid ----------
sama(
  "data lengkap dan benar tidak menghasilkan error",
  validasiStafBaru({
    nama: "Sinta",
    email: "sinta@kataloji.id",
    role: "kasir",
    password: "rahasia123",
  }),
  [],
);

// ---------- nama ----------
sama(
  "nama kosong ditolak",
  validasiStafBaru({ nama: "", email: "a@b.co", role: "kasir", password: "rahasia123" }),
  ["Nama staf wajib diisi."],
);
sama(
  "nama 1 huruf ditolak",
  validasiStafBaru({ nama: "A", email: "a@b.co", role: "kasir", password: "rahasia123" }),
  ["Nama staf minimal 2 karakter."],
);
sama(
  "nama 81 huruf ditolak",
  validasiStafBaru({ nama: "A".repeat(81), email: "a@b.co", role: "kasir", password: "rahasia123" }),
  ["Nama staf maksimal 80 karakter."],
);
sama(
  "nama 80 huruf diterima",
  validasiStafBaru({ nama: "A".repeat(80), email: "a@b.co", role: "kasir", password: "rahasia123" }),
  [],
);
sama(
  "nama berisi spasi saja ditolak (dianggap kosong)",
  validasiStafBaru({ nama: "   ", email: "a@b.co", role: "kasir", password: "rahasia123" }),
  ["Nama staf wajib diisi."],
);

// ---------- email ----------
sama(
  "email kosong ditolak",
  validasiStafBaru({ nama: "Sinta", email: "", role: "kasir", password: "rahasia123" }),
  ["Email wajib diisi."],
);
sama(
  "email tanpa @ ditolak",
  validasiStafBaru({ nama: "Sinta", email: "sinta.kataloji.id", role: "kasir", password: "rahasia123" }),
  ["Format email tidak dikenali."],
);
sama(
  "email tanpa domain ditolak",
  validasiStafBaru({ nama: "Sinta", email: "sinta@", role: "kasir", password: "rahasia123" }),
  ["Format email tidak dikenali."],
);
sama(
  "email tanpa titik di domain ditolak",
  validasiStafBaru({ nama: "Sinta", email: "sinta@kataloji", role: "kasir", password: "rahasia123" }),
  ["Format email tidak dikenali."],
);
sama(
  "email dengan spasi ditolak",
  validasiStafBaru({ nama: "Sinta", email: "sin ta@kataloji.id", role: "kasir", password: "rahasia123" }),
  ["Format email tidak dikenali."],
);
sama(
  "email TLD .id diterima",
  validasiStafBaru({ nama: "Sinta", email: "sinta@kataloji.id", role: "kasir", password: "rahasia123" }),
  [],
);
sama(
  "email dengan titik dan strip diterima",
  validasiStafBaru({ nama: "Sinta", email: "sinta.dewi-1@sub.kataloji.co.id", role: "kasir", password: "rahasia123" }),
  [],
);

// ---------- peran ----------
sama(
  "peran tidak dikenali ditolak",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "owner", password: "rahasia123" }),
  ["Peran staf tidak dikenali."],
);

// ---------- kata sandi ----------
sama(
  "sandi kosong ditolak",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "kasir", password: "" }),
  ["Kata sandi wajib diisi."],
);
sama(
  "sandi 7 karakter ditolak",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "kasir", password: "rahas12" }),
  ["Kata sandi minimal 8 karakter."],
);
sama(
  "sandi 8 huruf semua ditolak (harus ada angka)",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "kasir", password: "rahasiaaa" }),
  ["Kata sandi harus memuat huruf dan angka."],
);
sama(
  "sandi 8 angka semua ditolak (harus ada huruf)",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "kasir", password: "12345678" }),
  ["Kata sandi harus memuat huruf dan angka."],
);
sama(
  "sandi tepat 8 karakter huruf+angka diterima",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "kasir", password: "rahasia1" }),
  [],
);
sama(
  "sandi dengan simbol diterima",
  validasiStafBaru({ nama: "Sinta", email: "a@b.co", role: "kasir", password: "R4hasia!@#panjang" }),
  [],
);

// ---------- beberapa error sekaligus ----------
sama(
  "semua field kosong menghasilkan 4 pesan berurutan",
  validasiStafBaru({ nama: "", email: "", role: "", password: "" }),
  [
    "Nama staf wajib diisi.",
    "Email wajib diisi.",
    "Peran staf tidak dikenali.",
    "Kata sandi wajib diisi.",
  ],
);

// ---------- validasiUbahStaf ----------
sama(
  "ubah: data benar diterima",
  validasiUbahStaf({ nama: "Sinta Dewi", role: "manager" }),
  [],
);
sama(
  "ubah: tanpa sandi tetap valid (sandi tidak diubah)",
  validasiUbahStaf({ nama: "Sinta", role: "admin" }),
  [],
);
sama(
  "ubah: nama kosong ditolak",
  validasiUbahStaf({ nama: "", role: "kasir" }),
  ["Nama staf wajib diisi."],
);
sama(
  "ubah: peran ngawur ditolak",
  validasiUbahStaf({ nama: "Sinta", role: "superadmin" }),
  ["Peran staf tidak dikenali."],
);

// ---------- namaPanggilan ----------
sama("nama manusia dipakai apa adanya", namaPanggilan("Budi Santoso", "budi@x.id"), "Budi");
sama("nama manusia satu kata", namaPanggilan("Sinta", null), "Sinta");
sama("nama huruf kecil dibesarkan", namaPanggilan("sinta", null), "Sinta");
sama(
  "nama berisi email: pakai bagian depan email",
  namaPanggilan("wahyu@kataloji.id", "wahyu@kataloji.id"),
  "Wahyu",
);
sama(
  "nama kosong: jatuh ke email",
  namaPanggilan("", "anggara@kataloji.id"),
  "Anggara",
);
sama(
  "nama null: jatuh ke email",
  namaPanggilan(null, "anggara@kataloji.id"),
  "Anggara",
);
sama(
  "nama dan email kosong: jatuh ke Staf",
  namaPanggilan("", ""),
  "Staf",
);
sama(
  "nama null dan email null: jatuh ke Staf",
  namaPanggilan(null, null),
  "Staf",
);
sama(
  "nama spasi saja: jatuh ke email",
  namaPanggilan("   ", "budi@x.id"),
  "Budi",
);
sama(
  "nama dengan domain tetap utuh (bukan dipotong di titik)",
  namaPanggilan("Maria Goretti", "maria@x.id"),
  "Maria",
);

// ---------- inisial ----------
sama("inisial dua kata", inisial("Budi Santoso"), "BS");
sama("inisial satu kata", inisial("Sinta"), "SI");
sama("inisial tiga kata: ambil dua pertama", inisial("Rio Bagus Pratama"), "RB");
sama("inisial dari email", inisial("wahyu@kataloji.id"), "WA");
sama("inisial kosong", inisial(""), "?");
sama("inisial spasi saja", inisial("   "), "?");
sama("inisial dengan titik", inisial("sinta.dewi"), "SD");

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;

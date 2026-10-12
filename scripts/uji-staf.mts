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
  menuUntukPeran,
  bolehLihatRekap,
  bolehLihatPemasaran,
  bolehLihatLogTransaksi,
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

// ============ menuUntukPeran & bolehLihatRekap ============
// Latar: manajer sempat TIDAK melihat menu "Rekap kasir" padahal halamannya
// mengizinkan dia masuk dan menampilkan seluruh datanya. Menu yang hilang
// untuk halaman yang boleh dibuka membuat fiturnya seperti tidak ada.
// Syarat menu dan syarat halaman sekarang memakai fungsi yang sama.

// Catatan 12 Okt 2026: kunci "penjualan" (Laporan penjualan, omzet) masuk pada
// commit 245bf1a tapi harness ini belum ikut diperbarui, jadi enam asersi di
// bawah gagal sejak saat itu. Pelajaran: menambah kunci MenuKhusus WAJIB
// diikuti kunci yang sama di sini.
sama("admin melihat semua menu", menuUntukPeran("admin"), { rekap: true, penjualan: true, staf: true, impor: true, pencocokan: true, logTransaksi: true, pemasaran: true });
sama("manajer melihat rekap, penjualan, dan pemasaran tapi bukan kelola staf/impor", menuUntukPeran("manager"), { rekap: true, penjualan: true, staf: false, impor: false, pencocokan: false, logTransaksi: false, pemasaran: true });
sama("kasir tidak melihat satu pun menu khusus", menuUntukPeran("kasir"), { rekap: false, penjualan: false, staf: false, impor: false, pencocokan: false, logTransaksi: false, pemasaran: false });

sama("peran kosong tidak diberi menu khusus", menuUntukPeran(null), { rekap: false, penjualan: false, staf: false, impor: false, pencocokan: false, logTransaksi: false, pemasaran: false });
sama("peran tak dikenal tidak diberi menu khusus", menuUntukPeran("tukang_parkir"), { rekap: false, penjualan: false, staf: false, impor: false, pencocokan: false, logTransaksi: false, pemasaran: false });
sama("peran undefined aman", menuUntukPeran(undefined), { rekap: false, penjualan: false, staf: false, impor: false, pencocokan: false, logTransaksi: false, pemasaran: false });

// Laporan penjualan berisi omzet: kasir tidak boleh, sama seperti rekap.
// Halaman /laporan-penjualan memakai pagar yang sama dengan kunci ini.
sama("hanya admin dan manajer yang boleh lihat laporan penjualan",
  ["admin", "manager", "kasir", null].map((r) => menuUntukPeran(r).penjualan),
  [true, true, false, false]);

// Kelola akun staf adalah satu-satunya yang benar-benar khusus admin.
sama("hanya admin yang boleh kelola staf",
  ["admin", "manager", "kasir", null].map((r) => menuUntukPeran(r).staf),
  [true, false, false, false]);

// Inti perbaikannya: menu dan halaman WAJIB sepakat.
sama("syarat menu dan syarat halaman selalu sama",
  ["admin", "manager", "kasir", null, "aneh"].every(
    (r) => menuUntukPeran(r).rekap === bolehLihatRekap(r),
  ),
  true);

sama("bolehLihatRekap admin", bolehLihatRekap("admin"), true);
sama("bolehLihatRekap manajer", bolehLihatRekap("manager"), true);
sama("bolehLihatRekap kasir", bolehLihatRekap("kasir"), false);

// ============ bolehLihatPemasaran ============
// Campaign dan Analitik dikeluarkan dari kasir pada 16 Sep 2026. Alasannya
// beban perhatian, bukan kerahasiaan: kasir memakai layar ini sambil
// menghadapi antrean.
sama("admin boleh membuka pemasaran", bolehLihatPemasaran("admin"), true);
sama("manajer boleh membuka pemasaran", bolehLihatPemasaran("manager"), true);
sama("kasir tidak boleh membuka pemasaran", bolehLihatPemasaran("kasir"), false);
sama("peran kosong tidak boleh", bolehLihatPemasaran(null), false);
sama("peran tak dikenal tidak boleh", bolehLihatPemasaran("tukang_parkir"), false);

// Menu dan halaman WAJIB sepakat. Kalau berbeda, staf menekan menu yang
// mengantar ke pintu terkunci, atau halaman terbuka tanpa jalan menuju ke sana.
sama(
  "izin halaman sama persis dengan izin menu",
  ["admin", "manager", "kasir", "tukang_parkir", null].every(
    (r) => bolehLihatPemasaran(r) === menuUntukPeran(r).pemasaran,
  ),
  true,
);
sama(
  "izin rekap juga tetap sepakat dengan menunya",
  ["admin", "manager", "kasir", null].every(
    (r) => bolehLihatRekap(r) === menuUntukPeran(r).rekap,
  ),
  true,
);

// ============ bolehLihatLogTransaksi ============
// Log transaksi khusus admin (kelompok Sistem). Halaman /log-transaksi
// di-guard dengan bolehLihatLogTransaksi, WAJIB sepakat dengan menunya.
sama("bolehLihatLogTransaksi admin", bolehLihatLogTransaksi("admin"), true);
sama("bolehLihatLogTransaksi manajer", bolehLihatLogTransaksi("manager"), false);
sama("bolehLihatLogTransaksi kasir", bolehLihatLogTransaksi("kasir"), false);
sama("bolehLihatLogTransaksi peran kosong", bolehLihatLogTransaksi(null), false);
sama("bolehLihatLogTransaksi peran tak dikenal", bolehLihatLogTransaksi("tukang_parkir"), false);
sama(
  "izin log transaksi sepakat dengan menunya",
  ["admin", "manager", "kasir", "tukang_parkir", null].every(
    (r) => bolehLihatLogTransaksi(r) === menuUntukPeran(r).logTransaksi,
  ),
  true,
);

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;

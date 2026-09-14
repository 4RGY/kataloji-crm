import { NextResponse } from "next/server";
import { wajibAdmin } from "@/lib/supabase/izin-admin";
import { getKlienAdmin } from "@/lib/supabase/admin";
import { pesanGalat, teksGalat } from "@/lib/pesan-galat";
import {
  isRole,
  validasiStafBaru,
  validasiUbahStaf,
  type Role,
} from "@/lib/staf";

/**
 * Route kelola akun staf. Hanya admin yang boleh mengakses.
 *
 * Ini satunya-satunya tempat di aplikasi yang memakai kunci service role,
 * karena membuat dan menghapus user Supabase Auth tidak bisa dilakukan
 * dengan kunci anon. Setiap fungsi di sini memanggil `wajibAdmin()` lebih
 * dulu, jadi kunci tersebut tidak pernah dipakai tanpa pemeriksaan peran.
 */

/** Daftar staf: profil digabung dengan email dari Supabase Auth. */
export async function GET() {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  const admin = getKlienAdmin();

  const { data: profil, error } = await admin
    .from("profile")
    .select("id, nama, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Gagal memuat daftar staf." },
      { status: 500 },
    );
  }

  // Email hanya ada di Supabase Auth, tidak di tabel profile. Diambil
  // sekaligus (satu permintaan, bukan satu per staf) lalu dipetakan.
  const { data: halaman, error: galatAuth } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (galatAuth) {
    return NextResponse.json(
      { error: "Gagal memuat data akun staf." },
      { status: 500 },
    );
  }

  const emailPerId = new Map<string, string>();
  const konfirmasiPerId = new Map<string, boolean>();
  for (const u of halaman?.users ?? []) {
    if (u.email) emailPerId.set(u.id, u.email);
    konfirmasiPerId.set(u.id, Boolean(u.email_confirmed_at));
  }

  return NextResponse.json({
    data: (profil ?? []).map((p) => ({
      id: p.id as string,
      nama: p.nama as string,
      role: p.role as string,
      email: emailPerId.get(p.id as string) ?? "",
      email_terkonfirmasi: konfirmasiPerId.get(p.id as string) ?? false,
      created_at: p.created_at as string,
      diri_sendiri: p.id === izin.id,
    })),
  });
}

/** Tambah akun staf baru. */
export async function POST(request: Request) {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body harus JSON valid" }, { status: 400 });
  }

  const nama = String(body.nama ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "kasir");
  const password = String(body.password ?? "");

  const pesan = validasiStafBaru({ nama, email, role, password });
  if (pesan.length > 0) {
    return NextResponse.json({ error: pesan[0], pesan }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ error: "Peran staf tidak dikenali." }, { status: 400 });
  }

  const admin = getKlienAdmin();

  // Email sudah dipakai? Diperiksa lebih dulu supaya pesannya ramah,
  // bukan error mentah dari Supabase Auth.
  const { data: halaman } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const sudahAda = (halaman?.users ?? []).some(
    (u) => (u.email ?? "").toLowerCase() === email,
  );
  if (sudahAda) {
    return NextResponse.json(
      { error: "Email itu sudah dipakai akun lain. Gunakan email berbeda." },
      { status: 409 },
    );
  }

  // email_confirm: true supaya akun staf bisa langsung dipakai. Akun ini
  // dibuat oleh admin untuk pegawai toko, jadi tidak ada kotak masuk yang
  // perlu ditunggu.
  const { data: dibuat, error: galatBuat } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama },
  });

  if (galatBuat || !dibuat?.user) {
    // Pesan asli dicatat ke log server, yang dikirim ke klien versi Indonesia.
    console.error("[buat akun staf]", teksGalat(galatBuat));
    return NextResponse.json(
      {
        error: pesanGalat(
          galatBuat,
          "Akun gagal dibuat karena sebab di server. Coba lagi sebentar lagi.",
        ),
      },
      { status: 400 },
    );
  }

  // Trigger `handle_new_user` sudah membuat baris profile dengan peran
  // 'kasir'. Baris itu diperbarui sesuai pilihan admin.
  const { error: galatProfil } = await admin
    .from("profile")
    .upsert(
      { id: dibuat.user.id, nama, role },
      { onConflict: "id" },
    );

  if (galatProfil) {
    // Jangan tinggalkan user auth tanpa profil: itu persis penyebab
    // dashboard kosong. Kalau profil gagal, akunnya dibatalkan.
    await admin.auth.admin.deleteUser(dibuat.user.id);
    return NextResponse.json(
      { error: "Akun dibatalkan karena data staf gagal disimpan." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { id: dibuat.user.id, email, nama, role },
    { status: 201 },
  );
}

/** Ubah nama dan peran staf. */
export async function PATCH(request: Request) {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body harus JSON valid" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const nama = String(body.nama ?? "").trim();
  const role = String(body.role ?? "");

  if (!id) {
    return NextResponse.json({ error: "Staf yang diubah tidak dikenali." }, { status: 400 });
  }

  const pesan = validasiUbahStaf({ nama, role });
  if (pesan.length > 0) {
    return NextResponse.json({ error: pesan[0], pesan }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ error: "Peran staf tidak dikenali." }, { status: 400 });
  }

  // Penjaga penting: admin yang menurunkan perannya sendiri akan langsung
  // kehilangan akses ke halaman ini dan tidak bisa mengembalikannya.
  // Peran admin terakhir juga tidak boleh diturunkan, karena toko akan
  // terkunci tanpa satu pun admin.
  const admin = getKlienAdmin();

  const { data: target } = await admin
    .from("profile")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Staf tidak ditemukan." }, { status: 404 });
  }

  if (target.role === "admin" && role !== "admin") {
    const { count } = await admin
      .from("profile")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error:
            "Ini satu-satunya akun admin. Ubah dulu peran staf lain menjadi admin " +
            "sebelum menurunkan peran akun ini, supaya tidak ada yang terkunci.",
        },
        { status: 409 },
      );
    }
  }

  const { error } = await admin
    .from("profile")
    .update({ nama, role: role as Role })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Perubahan gagal disimpan." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id, nama, role });
}

/** Hapus akun staf beserta akses loginnya. */
export async function DELETE(request: Request) {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "Staf yang dihapus tidak dikenali." }, { status: 400 });
  }

  // Tidak boleh menghapus akun sendiri: sesi yang sedang dipakai akan
  // langsung mati dan admin bisa terkunci di luar aplikasi.
  if (id === izin.id) {
    return NextResponse.json(
      { error: "Anda tidak bisa menghapus akun yang sedang Anda pakai." },
      { status: 409 },
    );
  }

  const admin = getKlienAdmin();

  const { data: target } = await admin
    .from("profile")
    .select("role, nama")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Staf tidak ditemukan." }, { status: 404 });
  }

  if (target.role === "admin") {
    const { count } = await admin
      .from("profile")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          error:
            "Ini satu-satunya akun admin, tidak boleh dihapus. " +
            "Angkat staf lain menjadi admin lebih dulu.",
        },
        { status: 409 },
      );
    }
  }

  // Baris profile dihapus lebih dulu supaya niatnya jelas; kalau tidak,
  // aturan cascade dari auth.users yang akan menghapusnya.
  await admin.from("profile").delete().eq("id", id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("[hapus akun staf]", teksGalat(error));
    return NextResponse.json(
      {
        error: pesanGalat(
          error,
          "Akun gagal dihapus karena sebab di server. Coba lagi sebentar lagi.",
        ),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id });
}

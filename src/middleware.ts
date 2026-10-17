import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_COOKIE_GATE, gerbangTerbuka } from "@/lib/gate";

export async function middleware(request: NextRequest) {
  const { pathname: jalur } = request.nextUrl;

  // Halaman gerbang sendiri TIDAK boleh lewat logika login di bawah, kalau
  // tidak /gate akan ditendang ke / lalu / ditendang balik ke /gate (loop).
  if (jalur === "/gate") {
    return NextResponse.next({ request });
  }

  // Gerbang sandi di depan SEMUA halaman dan API. Kalau GATE_PASSWORD belum
  // diisi, sandiGerbang() null dan semuanya ditolak (gagal tertutup).
  const sudahLewat = await gerbangTerbuka(
    request.cookies.get(NAMA_COOKIE_GATE)?.value,
  );
  if (!sudahLewat) {
    if (jalur.startsWith("/api/")) {
      return NextResponse.json({ error: "Gerbang akses terkunci." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/gate";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // penting: jangan pakai `await supabase.auth.getSession()` di middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Jalur API TIDAK ikut ditendang ke halaman login. Kalau ditendang,
  // pemanggil yang mengharapkan JSON akan menerima HTML halaman login
  // dengan status 200 dan bingung kenapa datanya tidak ada. Biarkan
  // route handler yang menjawab, karena dia tahu cara mengembalikan
  // {"error": ...} dengan status 401 yang benar.
  const jalurApi = pathname.startsWith("/api/");

  if (!user && pathname !== "/" && !jalurApi) {
    // belum login → ke halaman login
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/") {
    // sudah login → langsung dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

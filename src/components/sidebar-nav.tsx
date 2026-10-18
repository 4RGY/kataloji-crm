"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { menuUntukPeran } from "@/lib/staf";
import {
  LayoutDashboard,
  Users,
  ReceiptText,
  Gift,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  ClipboardList,
  UserCog,
  Coffee,
  Tag,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LonceNotifikasi } from "@/components/lonceng-notifikasi";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Menu navigasi, dikelompokkan menurut jenis pekerjaannya.
 *
 * Dipisah supaya kasir tidak perlu menyisir tujuh menu untuk menemukan yang
 * dipakai sehari-hari. Kelompok Operasional adalah pekerjaan yang menyentuh
 * transaksi dan pelanggan langsung, Pemasaran yang sifatnya menawarkan dan
 * mengukur, dan Sistem yang menyangkut aturan serta akun.
 *
 * Urutan di dalam tiap kelompok disengaja mengikuti alur kerja harian:
 * mencatat transaksi dulu, baru melihat pelanggannya, lalu loyalitasnya.
 */
const KELOMPOK_NAV: {
  judul: string | null;
  menu: { href: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    judul: null,
    menu: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    judul: "Operasional",
    menu: [
      { href: "/transaksi", label: "Transaksi", icon: ReceiptText },
      { href: "/pelanggan", label: "Pelanggan", icon: Users },
      { href: "/loyalitas", label: "Loyalitas", icon: Gift },
      { href: "/menu", label: "Menu", icon: Coffee },
      { href: "/promo", label: "Promo", icon: Tag },
    ],
  },
  {
    judul: "Pemasaran",
    menu: [
      { href: "/campaign", label: "Campaign", icon: Megaphone },
      { href: "/analitik", label: "Analitik", icon: BarChart3 },
    ],
  },
  {
    judul: "Sistem",
    // Menu admin diselipkan ke kelompok Sistem supaya tidak perlu kelompok
    // tersendiri hanya untuk satu tautan.
    menu: [{ href: "/pengaturan", label: "Pengaturan", icon: Settings }],
  },
];

const MENU_REKAP = {
  href: "/rekap-kasir",
  label: "Rekap kasir",
  icon: ClipboardList,
};

const MENU_STAF = { href: "/staf", label: "Staf", icon: UserCog };

const MENU_LOG_TRANSAKSI = {
  href: "/log-transaksi",
  label: "Log Transaksi",
  icon: ScrollText,
};

const MENU_PENJUALAN = {
  href: "/laporan-penjualan",
  label: "Laporan penjualan",
  icon: BarChart3,
};

const LABEL_ROLE: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  kasir: "Kasir",
};

interface Profil {
  nama: string;
  role: string;
  email: string;
}

/** "Wahyu Admin" -> "WA"; satu kata -> dua huruf pertama */
function inisial(nama: string): string {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "?";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profil, setProfil] = useState<Profil | null>(null);

  // Identitas di sidebar diambil dari sesi yang sedang login, bukan
  // ditulis tetap. Sebelumnya nama dan peran hardcode "Wahyu / Admin",
  // sehingga kasir pun tampil sebagai Admin.
  const ambilProfil = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profile")
      .select("nama, role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      nama: data?.nama ?? user.email ?? "Staf",
      role: data?.role ?? "kasir",
      email: user.email ?? "",
    } as Profil;
  }, [supabase]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      const hasil = await ambilProfil();
      if (!aktif || !hasil) return;
      setProfil(hasil);
    })();
    return () => {
      aktif = false;
    };
  }, [ambilProfil]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const namaTampil = profil?.nama ?? "Memuat";
  const roleTampil = profil ? LABEL_ROLE[profil.role] ?? profil.role : "";

  // Peran dibaca dari hasil profil di database, bukan dari email atau
  // tebakan sesi, karena peran adalah data yang hanya boleh ditentukan
  // server. Aturan menu ada di src/lib/staf.ts supaya bisa diuji dan supaya
  // syaratnya sama persis dengan yang dipakai halamannya.
  const hakMenu = menuUntukPeran(profil?.role);

  return (
    <aside
      className="texture-grain fixed inset-y-4 left-4 z-40 flex w-16 flex-col rounded-2xl border border-sidebar-border bg-sidebar shadow-xl lg:w-60"
      aria-label="Navigasi utama"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 lg:px-5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <Image
            src="/brand/logo-removebg.png"
            alt="Kataloji Coffee and Eatery"
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
        </span>
        <span className="hidden font-heading text-base font-extrabold leading-tight tracking-tight text-sidebar-foreground lg:block">
          Kataloji
        </span>
      </div>

      <div className="mx-4 h-px bg-sidebar-border lg:mx-5" />

      {/* Nav utama. Rapat: tanpa judul kelompok, jarak antar item kecil.
          Tujuannya muat tanpa scroll di layar laptop biasa. */}
      <nav
        className="scrollbar-tersembunyi flex-1 space-y-2 overflow-y-auto px-3 py-3 lg:px-3"
        aria-label="Menu"
      >
        {KELOMPOK_NAV.map((kelompok, iKelompok) => {
          // Log Transaksi adalah pekerjaan harian yang menyentuh transaksi,
          // jadi ikut Operasional. Staf dan Rekap tetap di Sistem.
          const menu =
            kelompok.judul === "Operasional"
              ? [
                  ...kelompok.menu,
                  ...(hakMenu.penjualan ? [MENU_PENJUALAN] : []),
                  ...(hakMenu.logTransaksi ? [MENU_LOG_TRANSAKSI] : []),
                ]
              : kelompok.judul === "Sistem"
                ? [
                    ...kelompok.menu,
                    ...(hakMenu.rekap ? [MENU_REKAP] : []),
                    ...(hakMenu.staf ? [MENU_STAF] : []),
                  ]
                : kelompok.menu;

          // Kelompok Pemasaran disembunyikan seluruhnya dari kasir, bukan
          // disisakan sebagai judul tanpa isi. Judul kosong justru
          // memberitahu ada sesuatu yang tidak boleh dia buka, dan itu
          // mengganggu tanpa memberi manfaat.
          if (kelompok.judul === "Pemasaran" && !hakMenu.pemasaran) return null;

          return (
            <div key={kelompok.judul ?? "utama"}>
              {/* Judul kelompok dihapus (rapat). Pemisah tipis antar kelompok saja. */}
              {iKelompok > 0 && (
                <div className="mx-2 my-1 h-px bg-sidebar-border" />
              )}

              <div className="space-y-1">
                {menu.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "group relative flex h-8 items-center gap-3 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors",
                        active
                          ? "bg-sidebar-accent/60 text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                      )}
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Notifikasi + Tema + User */}
      <div className="space-y-3 border-t border-sidebar-border p-3 lg:p-4">
        <LonceNotifikasi />

        <ThemeToggle className="hidden lg:flex" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-sidebar-accent">
              <Avatar className="h-8 w-8 border border-sidebar-border">
                <AvatarFallback className="bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                  {inisial(namaTampil)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 flex-1 lg:block">
                <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                  {namaTampil}
                </span>
                <span className="block text-[11px] text-sidebar-foreground/70">
                  {roleTampil || "…"}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {profil?.email || "…"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/pengaturan")}>
              <Settings className="h-4 w-4" aria-hidden />
              Pengaturan akun
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                // Toast dipanggil setelah redirect supaya tidak hilang
                // saat halaman login selesai dimuat.
                handleLogout().then(() => {
                  toast.success("Sampai jumpa, sampai shift berikutnya!");
                });
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Keluar
            </DropdownMenuItem>
            <DropdownMenuSeparator className="lg:hidden" />
            <div className="p-1.5 lg:hidden">
              <ThemeToggle />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { menuUntukPeran, type MenuKhusus } from "@/lib/staf";
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
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LonceNotifikasi } from "@/components/lonceng-notifikasi";
import { DialogCatatPoinKitapos } from "@/components/dialog-catat-poin-kitapos";
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
 * Menu utama: FOKUS MURNI CRM & LOYALITAS.
 * Modul operasional POS kasir disembunyikan di dropdown cadangan.
 */
const KELOMPOK_CRM: {
  judul: string | null;
  menu: { href: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    judul: null,
    menu: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    judul: "CRM & Loyalitas",
    menu: [
      { href: "/pelanggan", label: "Pelanggan", icon: Users },
      { href: "/loyalitas", label: "Loyalitas & Poin", icon: Gift },
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
    menu: [{ href: "/pengaturan", label: "Pengaturan", icon: Settings }],
  },
];

interface ItemPosCadangan {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roleKey: keyof MenuKhusus | null;
}

const MENU_POS_CADANGAN: ItemPosCadangan[] = [
  { href: "/transaksi", label: "Kasir POS", icon: ReceiptText, roleKey: null },
  { href: "/menu", label: "Katalog Menu", icon: Coffee, roleKey: "menu" },
  { href: "/promo", label: "Promo POS", icon: Tag, roleKey: "promo" },
  {
    href: "/laporan-penjualan",
    label: "Laporan Penjualan",
    icon: BarChart3,
    roleKey: "penjualan",
  },
  {
    href: "/rekap-kasir",
    label: "Rekap Kasir",
    icon: ClipboardList,
    roleKey: "rekap",
  },
  {
    href: "/log-transaksi",
    label: "Log Transaksi",
    icon: ScrollText,
    roleKey: "logTransaksi",
  },
];

const MENU_STAF = { href: "/staf", label: "Staf", icon: UserCog };

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
  const sedangDiRutePos = MENU_POS_CADANGAN.some(
    (m) => pathname === m.href || pathname.startsWith(m.href),
  );
  const [bukaPosManual, setBukaPosManual] = useState<boolean | null>(null);
  const bukaPos = bukaPosManual !== null ? bukaPosManual : sedangDiRutePos;
  const [dialogPoinOpen, setDialogPoinOpen] = useState(false);

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
  const hakMenu = menuUntukPeran(profil?.role);

  return (
    <>
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
              loading="eager"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="hidden font-heading text-base font-extrabold leading-tight tracking-tight text-sidebar-foreground lg:block">
            Kataloji CRM
          </span>
        </div>

        <div className="mx-4 h-px bg-sidebar-border lg:mx-5" />

        {/* Tombol Cepat: Catat Poin KITAPOS */}
        <div className="px-3 pt-3 lg:px-4">
          <button
            type="button"
            onClick={() => setDialogPoinOpen(true)}
            title="Catat Poin KITAPOS"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] hover:opacity-95 lg:justify-start lg:px-3"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline truncate">Catat Poin KITAPOS</span>
          </button>
        </div>

        {/* Nav utama CRM */}
        <nav
          className="scrollbar-tersembunyi flex-1 space-y-2 overflow-y-auto px-3 py-3 lg:px-3"
          aria-label="Menu"
        >
          {KELOMPOK_CRM.map((kelompok, iKelompok) => {
            const menu =
              kelompok.judul === "Sistem" && hakMenu.staf
                ? [...kelompok.menu, MENU_STAF]
                : kelompok.menu;

            if (kelompok.judul === "Pemasaran" && !hakMenu.pemasaran) return null;

            return (
              <div key={kelompok.judul ?? "utama"}>
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

          {/* Pemisah ke Modul POS Cadangan */}
          <div className="mx-2 my-2 h-px bg-sidebar-border" />

          {/* Dropdown / Accordion POS Cadangan (Default Tutup) */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setBukaPosManual(!bukaPos)}
              title="Modul POS Cadangan"
              className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-xs font-semibold text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <span className="flex items-center gap-2.5">
                <ReceiptText className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                <span className="hidden lg:inline">POS Cadangan</span>
              </span>
              <ChevronDown
                className={cn(
                  "hidden h-3.5 w-3.5 transition-transform duration-200 lg:block",
                  bukaPos && "rotate-180",
                )}
              />
            </button>

            {bukaPos && (
              <div className="mt-1 space-y-1 pl-0 lg:pl-2 animate-in fade-in-50 duration-150">
                {MENU_POS_CADANGAN.filter(
                  (item) => item.roleKey === null || hakMenu[item.roleKey],
                ).map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "group relative flex h-7 items-center gap-2.5 rounded-md px-2 text-xs font-medium outline-none transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                      )}
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      <span className="hidden lg:inline truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* Dialog Shortcut: Catat Poin Belanja KITAPOS.
          `key` diikat ke state buka/tutup supaya isian form direset tiap kali
          dialog dibuka ulang, tanpa perlu setState di dalam useEffect. */}
      <DialogCatatPoinKitapos
        key={dialogPoinOpen ? "kitapos-buka" : "kitapos-tutup"}
        open={dialogPoinOpen}
        onOpenChange={setDialogPoinOpen}
        onBerhasil={() => router.refresh()}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  ReceiptText,
  Gift,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/transaksi", label: "Transaksi", icon: ReceiptText },
  { href: "/loyalitas", label: "Loyalitas", icon: Gift },
  { href: "/campaign", label: "Campaign", icon: Megaphone },
  { href: "/analitik", label: "Analitik", icon: BarChart3 },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <aside
      className="texture-grain fixed inset-y-4 left-4 z-40 flex w-16 flex-col rounded-2xl border border-[oklch(0.357_0.033_57.2)] bg-[oklch(0.244_0.026_55.8)] shadow-xl lg:w-60"
      aria-label="Navigasi utama"
    >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 lg:px-5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[oklch(0.701_0.076_40.2)]">
            <Image
              src="/brand/logo.jpeg"
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="hidden text-sm font-bold leading-tight tracking-tight text-[oklch(0.972_0.011_76.6)] lg:block">
            Kataloji
          </span>
        </div>

        <div className="mx-4 h-px bg-[oklch(0.357_0.033_57.2)] lg:mx-5" />

        {/* Nav utama */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:px-4">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors",
                  active
                    ? "text-[oklch(0.972_0.011_76.6)]"
                    : "text-[oklch(0.88_0.02_80/0.6)] hover:bg-[oklch(0.323_0.03_57)] hover:text-[oklch(0.972_0.011_76.6)]",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[oklch(0.701_0.076_40.2)]" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-[oklch(0.357_0.033_57.2)] p-3 lg:p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-[oklch(0.323_0.03_57)]">
                <Avatar className="h-8 w-8 border border-[oklch(0.357_0.033_57.2)]">
                  <AvatarFallback className="bg-[oklch(0.701_0.076_40.2)] text-xs font-bold text-[oklch(0.994_0.006_84.6)]">
                    WA
                  </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 flex-1 lg:block">
                  <span className="block truncate text-sm font-semibold text-[oklch(0.972_0.011_76.6)]">
                    Wahyu
                  </span>
                  <span className="block text-[11px] text-[oklch(0.88_0.02_80/0.5)]">
                    Admin
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                wahyu@kataloji.id
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4" aria-hidden />
                Pengaturan akun
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  handleLogout();
                  toast.success("Sampai jumpa, sampai shift berikutnya!");
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
  );
}

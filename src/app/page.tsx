"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email dan kata sandi wajib diisi.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      toast.error("Email atau kata sandi salah.", {
        description: error.message,
      });
      setLoading(false);
    } else {
      router.replace("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel brand kiri, kaya & hangat */}
      <section className="texture-grain relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* cincin terracotta dekoratif */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full border-[28px] border-primary/30"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-chart-2/15 blur-2xl"
        />

        <div className="relative">
          <Image
            src="/brand/logo-typograph-removebg.png"
            alt="Kataloji Coffee and Eatery"
            width={440}
            height={132}
            priority
            className="h-32 w-auto"
          />
        </div>

        <div className="relative max-w-md">
          <p className="text-4xl font-extrabold leading-tight tracking-tight text-sidebar-foreground">
            Setiap pelanggan,
            <br />
            <span className="text-sidebar-primary">cerita tersendiri.</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/70">
            Poin loyalitas, segmentasi RFM, dan campaign WhatsApp, semua
            rasa pelanggan Kataloji, dalam satu tempat.
          </p>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-sidebar-foreground/45">
          <span className="h-px w-10 bg-current" />
          <span>Kataloji Coffee and Eatery</span>
        </div>
      </section>

      {/* Panel form kanan, background gradient polos biar form bersih */}
      <section className="relative flex items-center justify-center bg-background p-6 sm:p-12">
        {/* Garis hangat tipis di tepi kiri, memisahkan panel brand dan form */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent via-border to-transparent lg:block"
        />

        {/* Toggle tema di pojok kanan atas, biar staf bisa pilih tampilan
            sejak halaman masuk tanpa harus login dulu */}
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/brand/logo-typograph-removebg.png"
              alt="Kataloji Coffee and Eatery"
              width={200}
              height={60}
              className="h-14 w-auto"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Selamat datang kembali</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Masuk untuk melanjutkan shift Anda.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@kataloji.id"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Kata sandi</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => toast.info("Hubungi Admin untuk reset kata sandi.")}
                >
                  Lupa kata sandi?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Memeriksa…
                </>
              ) : (
                "Masuk ke Dashboard"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Hanya untuk staf Kataloji. Akses per peran:
            <span className="mt-1 block font-medium text-foreground/70">
              Admin · Manager · Kasir
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}

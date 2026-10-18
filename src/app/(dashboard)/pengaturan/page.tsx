"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pesanGalat } from "@/lib/pesan-galat";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SettingRow {
  key: string;
  value: string;
  keterangan: string | null;
}

interface Profil {
  nama: string;
  role: string;
}

const SETTING_NUMERIC = [
  "ppn_persen",
  "biaya_layanan_persen",
  "poin_per_rupiah",
  "nilai_poin",
  "min_redeem",
  "max_redeem_persen",
  "masa_kadaluwarsa_poin_bulan",
];

const LABEL_SETTING: Record<string, string> = {
  ppn_persen: "PPN (%)",
  biaya_layanan_persen: "Biaya Layanan (%)",
  poin_per_rupiah: "Poin per Rupiah",
  nilai_poin: "Nilai Poin (Rp)",
  min_redeem: "Minimum Redeem (poin)",
  max_redeem_persen: "Maksimum Redeem (%)",
  masa_kadaluwarsa_poin_bulan: "Masa Kadaluwarsa Poin (bulan)",
  nota_prefix: "Prefix Nomor Nota",
  struk_nama: "Nama di Struk",
  struk_alamat: "Alamat di Struk",
  struk_wifi_nama: "Nama WiFi",
  struk_wifi_pass: "Password WiFi",
  struk_instagram: "Instagram",
  struk_footer: "Footer Struk",
};

const SETTING_TRANSAKSI = ["ppn_persen", "biaya_layanan_persen", "nota_prefix"];
const SETTING_LOYALITAS = [
  "poin_per_rupiah",
  "nilai_poin",
  "min_redeem",
  "max_redeem_persen",
  "masa_kadaluwarsa_poin_bulan",
];
const SETTING_STRUK = [
  "struk_nama",
  "struk_alamat",
  "struk_wifi_nama",
  "struk_wifi_pass",
  "struk_instagram",
  "struk_footer",
];

export default function HalamanPengaturan() {
  const supabase = createClient();
  
  const [bolehKelola, setBolehKelola] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Record<string, SettingRow>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  const muatProfil = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profilData } = await supabase
      .from("profile")
      .select("nama, role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profilData) {
      
      setBolehKelola((profilData as Profil).role === "admin");
    }
  }, [supabase]);

  const muatSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("settings")
      .select("key, value, keterangan")
      .order("key");
    if (error) {
      toast.error(pesanGalat(error, "Gagal memuat pengaturan"));
      setLoading(false);
      return;
    }
    const map: Record<string, SettingRow> = {};
    const origMap: Record<string, string> = {};
    for (const row of data || []) {
      map[row.key] = row;
      origMap[row.key] = row.value;
    }
    setSettings(map);
    setOriginal(origMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      await muatProfil();
      await muatSettings();
    })();
  }, [muatProfil, muatSettings]);

  function ubah(key: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  }

  const adaPerubahan = Object.keys(settings).some(
    (k) => settings[k]?.value !== original[k],
  );

  async function simpan() {
    const perubahan = Object.keys(settings).filter(
      (k) => settings[k]?.value !== original[k],
    );
    if (perubahan.length === 0) {
      toast.info("Tidak ada perubahan");
      return;
    }
    setMenyimpan(true);
    try {
      for (const key of perubahan) {
        const { error } = await supabase
          .from("settings")
          .update({ value: settings[key].value, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      }
      toast.success(`${perubahan.length} pengaturan disimpan`);
      await muatSettings();
    } catch (e) {
      toast.error(pesanGalat(e, "Gagal menyimpan pengaturan"));
    } finally {
      setMenyimpan(false);
    }
  }

  if (bolehKelola === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bolehKelola === false) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <p className="text-base font-bold">Halaman ini hanya untuk admin.</p>
        </div>
    );
  }

  function renderInput(key: string) {
    const row = settings[key];
    if (!row) return null;
    const isNumeric = SETTING_NUMERIC.includes(key);

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={`set-${key}`} className="text-sm font-semibold">
          {LABEL_SETTING[key] || key}
        </Label>
        <Input
          id={`set-${key}`}
          value={row.value}
          onChange={(e) => {
            const val = isNumeric
              ? e.target.value.replace(/[^0-9]/g, "")
              : e.target.value;
            ubah(key, val);
          }}
          inputMode={isNumeric ? "numeric" : "text"}
          className="h-11"
        />
        {row.keterangan && (
          <p className="text-[11px] text-muted-foreground">{row.keterangan}</p>
        )}
      </div>
    );
  }

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur PPN, biaya layanan, loyalitas, dan info struk. Perubahan langsung
          berlaku untuk transaksi baru.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pengaturan Transaksi */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold tracking-tight">Transaksi</h2>
            <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
              Pajak, biaya layanan, dan format nomor nota.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SETTING_TRANSAKSI.map(renderInput)}
            </div>
          </section>

          {/* Pengaturan Loyalitas */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold tracking-tight">Loyalitas</h2>
            <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
              Aturan poin: nilai, minimum tukar, masa kadaluwarsa.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SETTING_LOYALITAS.map(renderInput)}
            </div>
          </section>

          {/* Info Struk */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold tracking-tight">Info Struk</h2>
            <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
              Data yang tampil di struk cetak: nama, alamat, WiFi, Instagram.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {SETTING_STRUK.map(renderInput)}
            </div>
          </section>

          {/* Tombol simpan */}
          <div className="flex items-center gap-3">
            <Button
              onClick={simpan}
              disabled={menyimpan || !adaPerubahan}
              className="h-11"
            >
              {menyimpan ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Menyimpan
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4" />
                  Simpan perubahan
                </>
              )}
            </Button>
            {adaPerubahan && (
              <span className="text-sm text-muted-foreground">
                Ada perubahan belum disimpan
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

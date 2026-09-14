# Kataloji CRM

Sistem CRM berbasis web untuk **Kataloji Coffee and Eatery**: pencatatan transaksi, manajemen pelanggan, poin loyalitas, dan voucher dalam satu tempat.

> Proyek Kerja Praktek — *Perancangan dan Implementasi Company Profile dan Sistem CRM Berbasis Web Menggunakan Metode Scrum*.

## Fitur Saat Ini

| Fitur | Status | Keterangan |
| --- | --- | --- |
| Autentikasi | Selesai | Login Supabase Auth (SSR), middleware guard, logout |
| Dashboard | Tampilan | Empty-state design, data nyata menyusul setelah schema DB |
| Transaksi | Direncanakan | Quick entry ala kasir, sinkron paralel dengan POS majoo |
| Pelanggan | Direncanakan | Nama, nomor WhatsApp, tanggal lahir |
| Poin & Voucher | Direncanakan | 1 poin per Rp 20.000, voucher 12 bulan |
| Laporan | Direncanakan | Omzet harian/mingguan/bulanan |

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) (App Router, Turbopack)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL, RLS)
- **Font**: Plus Jakarta Sans
- **Bahasa UI**: Indonesia

## Menjalankan Secara Lokal

```bash
# 1. Install dependencies
npm install

# 2. Siapkan environment variables (lihat bagian di bawah)
cp .env.local.example .env.local

# 3. Jalankan development server
npm run dev
```

Buka <http://localhost:3000> di browser.

## Environment Variables

Buat file `.env.local` di root project:

```env
NEXT_PUBLIC_SUPABASE_URL=<url-project-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Nilainya bisa diambil dari **Project Settings → API** di dashboard Supabase. File ini tidak ikut ter-commit (sudah di `.gitignore`).

## Struktur Proyek

```
kataloji-crm/
├── mockups/              # Mockup HTML statis untuk diskusi desain
├── public/brand/         # Aset brand (logo, tipografi)
└── src/
    ├── app/
    │   ├── (dashboard)/  # Route group dengan sidebar (protected)
    │   │   └── dashboard/
    │   ├── globals.css   # Design tokens oklch + texture
    │   ├── layout.tsx    # Root layout, font, Toaster
    │   └── page.tsx      # Halaman login
    ├── components/
    │   ├── ui/           # Komponen shadcn/ui
    │   └── sidebar-nav.tsx
    ├── lib/supabase/     # Client & server Supabase (SSR)
    └── middleware.ts     # Auth guard
```

## Konvensi Commit

Menggunakan [Conventional Commits](https://www.conventionalcommits.org):

- `feat:` fitur baru
- `fix:` perbaikan bug
- `chore:` setup, dependency, aset
- `refactor:` perubahan kode tanpa perubahan perilaku

## Laporan Bug & Kontribusi

Ini proyek KP internal. Untuk bug atau usulan perubahan, hubungi tim pengembang melalui issue di repo ini.

---

**Kataloji Coffee and Eatery** · Dibuat dengan Next.js dan Supabase

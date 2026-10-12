# ERD Sistem Kataloji CRM

Sumber: skema nyata dari database (PostgREST OpenAPI) dan berkas SQL di `supabase/`. Tanggal pemeriksaan: 12 Okt 2026.

## Diagram relasi

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILE : "1 akun = 1 profil"
    PROFILE ||--o{ ATURAN_POIN : "membuat (dibuat_oleh)"
    PROFILE ||--o{ CAMPAIGN_KIRIM : "mengirim (dikirim_oleh)"
    PROFILE ||--o{ PELANGGAN : "mengarsipkan (diarsipkan_oleh)"
    AUTH_USERS ||--o{ TRANSAKSI : "mencatat (dicatat_oleh)"
    PELANGGAN ||--o{ TRANSAKSI : "melakukan"
    PELANGGAN ||--o{ POINT_LEDGER : "memiliki"
    PELANGGAN ||--o{ CAMPAIGN_KIRIM : "menerima"
    TRANSAKSI ||--o{ POINT_LEDGER : "menerbitkan / memakai"

    PROFILE {
        uuid id PK "FK ke auth.users.id"
        text nama
        text role "admin | manager | kasir"
        timestamptz created_at
        timestamptz updated_at
    }

    PELANGGAN {
        uuid id PK
        text nama
        text whatsapp "unik, dinormalisasi"
        date tgl_lahir
        text jenis_kelamin
        text email
        text alamat
        text catatan
        integer poin "saldo, turunan dari ledger"
        text kode_majoo "kunci impor Majoo"
        timestamptz diarsipkan_pada
        uuid diarsipkan_oleh FK
        text alasan_arsip
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSAKSI {
        uuid id PK
        uuid pelanggan_id FK "nullable: transaksi anonim"
        integer total
        integer diskon
        integer poin_dipakai
        integer poin_didapat
        jsonb items "array {nama, qty}"
        text metode_bayar
        text source "manual | majoo_import"
        text external_ref "kunci impor Majoo, unik"
        text kode_pelanggan_majoo
        text nama_pelanggan_majoo
        text status_pencocokan
        date tanggal_majoo "hari laporan H+1"
        uuid dicatat_oleh FK "auth.users"
        text dicatat_oleh_nama
        timestamptz dicatat_pada
        timestamptz created_at
    }

    POINT_LEDGER {
        uuid id PK
        uuid pelanggan_id FK
        uuid transaksi_id FK "nullable"
        text tipe
        integer poin_masuk
        integer poin_keluar
        integer sisa
        date kedaluwarsa_pada
        text keterangan
        timestamptz created_at
    }

    ATURAN_POIN {
        uuid id PK
        text mode "per_kunjungan | per_nominal | per_transaksi"
        integer nominal
        date mulai
        date selesai
        text keterangan
        uuid dibuat_oleh FK
        timestamptz dibuat_pada
    }

    CAMPAIGN_KIRIM {
        uuid id PK
        uuid pelanggan_id FK
        text segmen
        text pesan
        uuid dikirim_oleh FK
        timestamptz dikirim_pada
    }
```

## Keterangan per entitas

| Tabel | Fungsi | Catatan kunci |
|---|---|---|
| `profile` | Peran staf (admin, manajer, kasir) | Satu baris per akun auth. Peran dibatasi CHECK. |
| `pelanggan` | Data pelanggan | Nomor WA unik. `poin` adalah saldo turunan dari `point_ledger`. Arsip memakai `diarsipkan_pada`, bukan hapus. |
| `transaksi` | Setiap penjualan, manual maupun impor Majoo | `external_ref` unik untuk impor. `pelanggan_id` boleh kosong (anonim). `tanggal_majoo` dipakai untuk hari laporan. |
| `point_ledger` | Jejak mutasi poin | Setiap masuk dan keluar tercatat. Tidak diubah diam-diam (prinsip audit). |
| `aturan_poin` | Aturan perolehan poin per periode | Mode `per_kunjungan` aktif. Kolom `aktif` dan `berlaku_dari` **tidak ada**. |
| `campaign_kirim` | Riwayat pesan campaign | Mencatat siapa mengirim ke siapa dan kapan. |
| `rekap_pencatat_transaksi` | **View**, bukan tabel | Ringkasan jumlah transaksi dan omzet per staf. Hanya dibaca. |

## Catatan integritas

- `transaksi.dicatat_oleh` mengacu ke `auth.users`, bukan `profile`. Jika profil dihapus, jejak pencatat tetap ada.
- `point_ledger` adalah sumber kebenaran poin. `pelanggan.poin` adalah hasil turunan dan harus selalu sama dengan jumlah ledger.
- Jalur impor Majoo tidak menimpa baris yang sudah ada (lihat `3de368d`). Tautan `pelanggan_id` yang belum terhubung dikerjakan lewat halaman Pencocokan.

## Yang belum terverifikasi

- **Tipe `text` vs enum** untuk `mode` dan `role`: CHECK constraint ada di SQL, tetapi tidak saya cek satu per satu untuk setiap kolom.
- **Trigger** (`hitung_poin_transaksi`, `trg_transaksi_pencocokan`) tidak digambarkan di ERD. Ini logika, bukan struktur.
- Tabel `campaign` dan `arsip_pelanggan` (dari berkas SQL `campaign.sql` dan `arsip-pelanggan.sql`) **tidak ada di DB** (diperiksa langsung: HTTP 404). Berkas SQL-nya belum dijalankan di DB ini. Fitur campaign dan arsip belum bisa berfungsi di DB sekarang, dan ini harus dijalankan dulu sebelum diuji.

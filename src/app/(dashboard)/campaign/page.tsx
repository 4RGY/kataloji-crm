import { HalamanBelumSiap } from "@/components/halaman-belum-siap";

export default function Halaman() {
  return (
    <HalamanBelumSiap
      judul="Campaign"
      keterangan="Kirim pesan WhatsApp ke segmen pelanggan, lalu pantau hasilnya."
      sprint="Sprint 4 dan Sprint 5"
      rencana={[
              "Kelola template pesan WhatsApp beserta status persetujuan Meta.",
              "Kirim otomatis untuk ulang tahun pelanggan dan peringatan poin hangus.",
              "Wizard campaign tiga langkah, pilih segmen, pilih template, lalu kirim atau jadwalkan.",
              "Status per penerima dan estimasi biaya pengiriman.",
              "Deteksi permintaan berhenti dari pelanggan, supaya yang tidak mau dihubungi tidak dikirimi lagi.",
      ]}
    />
  );
}

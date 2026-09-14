import { HalamanBelumSiap } from "@/components/halaman-belum-siap";

export default function Halaman() {
  return (
    <HalamanBelumSiap
      judul="Analitik"
      keterangan="Segmentasi pelanggan dan laporan performa loyalitas."
      sprint="Sprint 5 dan Sprint 6"
      rencana={[
              "Perhitungan RFM, skor 1 sampai 5 dengan sembilan label segmen.",
              "Matriks RFM dengan kemampuan melihat isi tiap segmen.",
              "Segmentasi otomatis dan grup pelanggan kustom.",
              "KPI loyalitas, tingkat kunjungan ulang, penukaran poin, dan retensi.",
              "Ekspor laporan ke CSV.",
      ]}
    />
  );
}

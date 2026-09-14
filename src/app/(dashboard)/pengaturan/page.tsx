import { HalamanBelumSiap } from "@/components/halaman-belum-siap";

export default function Halaman() {
  return (
    <HalamanBelumSiap
      judul="Pengaturan"
      keterangan="Kelola akun staf, peran akses, dan aturan loyalitas."
      sprint="Sprint 3"
      rencana={[
              "Kelola akun staf dan perannya, admin, manager, atau kasir.",
              "Ubah rasio poin dan aturan penukaran tanpa menyentuh kode.",
              "Rekonsiliasi harian dengan majoo, bandingkan jumlah transaksi dan omzet.",
              "Log audit untuk aksi sensitif seperti pembatalan transaksi.",
      ]}
    />
  );
}

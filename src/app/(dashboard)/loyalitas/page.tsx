import { HalamanBelumSiap } from "@/components/halaman-belum-siap";

export default function Halaman() {
  return (
    <HalamanBelumSiap
      judul="Loyalitas"
      keterangan="Saldo dan riwayat poin pelanggan, termasuk poin yang akan hangus."
      sprint="Sprint 2 dan Sprint 3"
      rencana={[
              "Buku besar poin per pelanggan, setiap penambahan dan penukaran tercatat satu baris.",
              "Penukaran poin mengikuti urutan FIFO, poin yang paling cepat hangus dipakai lebih dulu.",
              "Peringatan poin akan hangus, dan pengingat lewat WhatsApp pada H-30 dan H-7.",
              "Pengaturan rasio poin oleh admin, jadi aturan bisa diubah tanpa ubah kode.",
      ]}
    />
  );
}

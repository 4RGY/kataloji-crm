import { ShieldOff } from "lucide-react";

/**
 * Layar penolakan untuk halaman yang tidak boleh dibuka peran tertentu.
 *
 * Dijadikan komponen bersama karena polanya sudah dipakai di Staf dan Rekap
 * kasir, dan menyalinnya lagi untuk Campaign berarti tiga tempat harus
 * diubah bersamaan setiap kali kalimatnya diperbaiki.
 *
 * Yang penting di sini bukan tampilannya, melainkan isinya: penolakan
 * menyebut peran yang sedang dipakai dan alasannya. Layar yang hanya
 * berbunyi "akses ditolak" membuat staf mengira aplikasinya rusak, lalu
 * bertanya ke admin untuk sesuatu yang sebenarnya sudah bekerja benar.
 */
export function AksesDitolak({
  judul,
  keterangan,
  peran,
  alasan,
}: {
  judul: string;
  keterangan: string;
  /** Peran yang sedang login, apa adanya dari database. */
  peran: string | null;
  /** Mengapa peran itu tidak diizinkan, satu kalimat. */
  alasan: string;
}) {
  const label =
    peran === "kasir"
      ? "Kasir"
      : peran === "manager"
        ? "Manager"
        : peran === "admin"
          ? "Admin"
          : "staf";

  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{judul}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{keterangan}</p>
      </header>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <ShieldOff className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-bold text-foreground">
          Halaman ini bukan untuk peran {label}
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {alasan}
        </p>
      </div>
    </div>
  );
}

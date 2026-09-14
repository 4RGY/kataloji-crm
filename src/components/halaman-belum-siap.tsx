import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";

interface HalamanBelumSiapProps {
  judul: string;
  keterangan: string;
  sprint: string;
  rencana: string[];
}

/**
 * Kerangka halaman untuk menu yang belum dibangun.
 * Sengaja jujur: tidak menampilkan angka atau data palsu, hanya
 * menjelaskan apa yang akan ada di sini dan kapan rencananya.
 *
 * Tampilannya dibuat seperti "ruang yang memang sengaja dikosongkan",
 * bukan halaman gagal: judul tetap besar, ada penanda sprint, dan
 * daftar rencana dibuat dua kolom di layar lebar supaya ruang kanan
 * tidak terbuang.
 */
export function HalamanBelumSiap({
  judul,
  keterangan,
  sprint,
  rencana,
}: HalamanBelumSiapProps): ReactNode {
  return (
    <div className="px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{judul}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {keterangan}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <CircleDashed className="h-3.5 w-3.5" aria-hidden />
          {sprint}
        </span>
      </header>

      <section className="texture-grain relative overflow-hidden rounded-2xl border border-border bg-card p-7 lg:p-9">
        {/* Garis aksen tipis di kiri, menandai ini halaman terencana */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/60 via-primary/25 to-transparent"
        />

        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"
          >
            <CircleDashed className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight">
              Belum dibangun
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Rencana isi halaman ini di {sprint}:
            </p>
          </div>
        </div>

        {/* Dua kolom di layar lebar: daftar rencana jarang butuh lebar
            penuh, jadi ruang kanan dipakai daripada dibiarkan kosong. */}
        <ul className="mt-6 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {rencana.map((item) => (
            <li key={item} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
              />
              <span className="leading-relaxed text-muted-foreground">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

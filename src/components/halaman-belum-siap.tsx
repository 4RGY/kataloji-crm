import type { ReactNode } from "react";

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
 */
export function HalamanBelumSiap({
  judul,
  keterangan,
  sprint,
  rencana,
}: HalamanBelumSiapProps): ReactNode {
  return (
    <div className="max-w-3xl px-6 pb-10 pt-4 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">{judul}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{keterangan}</p>
      </header>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8">
        <p className="text-sm font-semibold text-foreground">
          Halaman ini belum dibangun
        </p>
        <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Bagian ini menyusul di {sprint}. Yang direncanakan:
        </p>
        <ul className="mt-5 space-y-2.5">
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
      </div>
    </div>
  );
}

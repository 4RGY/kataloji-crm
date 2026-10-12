"use client";

// ============================================================
// Komponen grafik dashboard: area tren omzet, donut metode bayar, dan
// batang horizontal menu teratas.
//
// Digambar dengan SVG dan CSS sendiri, tanpa menambah library chart.
// Alasannya: tiga bentuk ini cukup sederhana, dan menambah dependensi
// grafik berarti menambah berat bundel untuk sesuatu yang bisa digambar
// langsung. Semua warna memakai token tema (primary, muted), jadi tema
// terang dan gelap ikut berubah tanpa penyesuaian tambahan.
// ============================================================

import type { TitikTren, IrisanMetode, BatangMenu } from "@/lib/dashboard-grafik";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const rupiahRingkas = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function labelSingkat(hari: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(new Date(hari + "T00:00:00"));
}

/**
 * Area tren omzet harian.
 *
 * Memakai viewBox tetap 0..100 pada kedua sumbu lalu direntangkan, supaya
 * bentuknya ikut lebar kartu tanpa perlu mengukur DOM. Titik dibuat dari
 * data apa adanya: hari tanpa transaksi tetap nol dan tetap punya titik,
 * jadi garisnya tidak melompati hari kosong.
 */
export function GrafikTrenOmzet({ titik }: { titik: TitikTren[] }) {
  const tertinggi = titik.reduce((m, t) => Math.max(m, t.nilai), 0);

  if (titik.length === 0 || tertinggi === 0) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border">
        <p className="text-sm font-medium text-muted-foreground">
          Grafik terisi otomatis setelah transaksi tercatat
        </p>
        <p className="text-xs text-muted-foreground">
          Sumbu horizontal tanggal, sumbu vertikal omzet harian
        </p>
      </div>
    );
  }

  const tinggi = 100;
  const lebar = 100;
  // Titik tunggal tidak bisa membentuk garis, jadi digambar sebagai satu
  // titik di tengah supaya tetap terlihat sebagai data, bukan grafik kosong.
  const n = titik.length;
  const posisi = (i: number) => (n === 1 ? lebar / 2 : (i / (n - 1)) * lebar);
  const tinggiNilai = (nilai: number) => tinggi - (nilai / tertinggi) * tinggi;

  const titikGaris = titik.map((t, i) => ({
    x: posisi(i),
    y: tinggiNilai(t.nilai),
    data: t,
  }));

  const garis = titikGaris
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${garis} L${posisi(n - 1).toFixed(2)},${tinggi} L${posisi(0).toFixed(2)},${tinggi} Z`;

  const puncakIdx = titik.reduce(
    (maks, t, i) => (t.nilai > titik[maks].nilai ? i : maks),
    0,
  );

  return (
    <>
      <div className="relative h-52">
        <svg
          viewBox={`0 0 ${lebar} ${tinggi}`}
          preserveAspectRatio="none"
          className="h-full w-full text-primary"
          role="img"
          aria-label="Tren omzet harian"
        >
          <defs>
            <linearGradient id="tren-omzet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* garis bantu 25 / 50 / 75 persen */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={lebar}
              y1={tinggi * f}
              y2={tinggi * f}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={area} fill="url(#tren-omzet)" />
          <path
            d={garis}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* titik puncak ditandai supaya mata langsung menemukan hari terbaik */}
          <circle
            cx={posisi(puncakIdx)}
            cy={tinggiNilai(titik[puncakIdx].nilai)}
            r="1.6"
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Sumbu tanggal ditulis di luar SVG supaya teksnya tidak ikut
          melar mengikuti viewBox, yang membuat huruf jadi gepeng. */}
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{labelSingkat(titik[0].hari)}</span>
        {n > 2 && <span>{labelSingkat(titik[Math.floor((n - 1) / 2)].hari)}</span>}
        <span>{labelSingkat(titik[n - 1].hari)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          Puncak{" "}
          <strong className="font-semibold tabular-nums text-foreground">
            {rupiah.format(titik[puncakIdx].nilai)}
          </strong>{" "}
          pada {labelSingkat(titik[puncakIdx].hari)}
        </span>
        <span className="tabular-nums">
          {n} hari, {titik.filter((t) => t.nilai > 0).length} hari bertransaksi
        </span>
      </div>
    </>
  );
}

/**
 * Donut komposisi metode bayar.
 *
 * Digambar dari busur lingkaran dengan stroke-dasharray, bukan path busur
 * manual, supaya tidak ada perhitungan sudut yang rawan salah. Sisa 100%
 * selalu diisi tepat karena setiap irisan ditutup dengan `gap` kecil.
 */
export function DonutMetode({ irisan }: { irisan: IrisanMetode[] }) {
  const total = irisan.reduce((s, i) => s + i.jumlah, 0);

  if (total === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border">
        <p className="text-sm font-medium text-muted-foreground">
          Belum ada transaksi pada periode ini
        </p>
      </div>
    );
  }

  const R = 42;
  const KELILING = 2 * Math.PI * R;
  const GAP = irisan.length > 1 ? 1.5 : 0;

  // Warna mengikuti urutan; irisan "Belum tercatat" sengaja abu-abu karena
  // itu bukan metode, melainkan data yang belum ada.
  const warna = (i: IrisanMetode, idx: number) =>
    i.belumTercatat
      ? "text-foreground/25"
      : [
          "text-primary",
          "text-primary/65",
          "text-primary/40",
          "text-foreground/45",
        ][idx % 4];

  // Geser tiap irisan dihitung dari jumlah irisan sebelumnya, bukan dengan
  // variabel yang ditambah di dalam map. Menambah variabel luar saat render
  // dilarang React dan hasilnya bisa tidak konsisten antar render.
  const busur = irisan.map((i, idx) => {
    const panjang = (i.bagian || 0) * KELILING;
    const sebelum = irisan
      .slice(0, idx)
      .reduce((s, x) => s + (x.bagian || 0) * KELILING, 0);
    return { i, idx, panjang: Math.max(panjang - GAP, 0), geser: sebelum };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="13"
            className="text-foreground/8"
            stroke="currentColor"
          />
          {busur.map((b) => (
            <circle
              key={b.i.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth="13"
              strokeLinecap="butt"
              className={warna(b.i, b.idx)}
              stroke="currentColor"
              strokeDasharray={`${b.panjang} ${KELILING - b.panjang}`}
              strokeDashoffset={-b.geser}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-extrabold tabular-nums">{total}</p>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            transaksi
          </p>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {irisan.map((i, idx) => (
          <li key={i.label} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className={
                "h-2.5 w-2.5 shrink-0 rounded-sm " +
                (i.belumTercatat
                  ? "bg-foreground/25"
                  : ["bg-primary", "bg-primary/65", "bg-primary/40", "bg-foreground/45"][idx % 4])
              }
            />
            <span className={"min-w-0 flex-1 truncate " + (i.belumTercatat ? "text-muted-foreground" : "")}>
              {i.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Math.round(i.bagian * 100)}%
            </span>
            <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
              {i.jumlah}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Batang horizontal menu teratas.
 *
 * Lebar batang dibanding menu paling laris. Jumlah porsi ditulis apa adanya
 * supaya pembaca bisa menilai sendiri apakah selisihnya berarti; jumlah yang
 * kecil tidak dibulatkan menjadi kesan yang lebih kuat.
 */
export function BatangMenuHorizontal({
  daftar,
  totalPorsi,
  cukupData,
}: {
  daftar: BatangMenu[];
  totalPorsi: number;
  cukupData: boolean;
}) {
  if (daftar.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border">
        <p className="text-sm font-medium text-muted-foreground">
          Belum ada rincian item pada periode ini
        </p>
        <p className="text-xs text-muted-foreground">
          Rincian item hanya ada pada transaksi yang mencatat menunya
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {daftar.map((m, i) => (
          <li key={m.nama}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{m.nama}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <strong className="font-semibold text-foreground">{m.qty}</strong> porsi
              </span>
            </div>
            <div className="mt-1.5 ml-6 h-2 overflow-hidden rounded-sm bg-foreground/8">
              <div
                className="h-full rounded-sm bg-primary"
                style={{ width: `${Math.max(m.porsi * 100, 3)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {cukupData ? (
          <>
            Dari {totalPorsi.toLocaleString("id-ID")} porsi terjual pada periode
            ini. Peringkat dihitung dari jumlah porsi, bukan omzet, jadi menu
            murah yang sering dipesan tetap terlihat.
          </>
        ) : (
          <>
            Baru {totalPorsi.toLocaleString("id-ID")} porsi tercatat. Jumlahnya
            masih sedikit, jadi urutan ini belum bisa dijadikan patokan; angka
            ditampilkan apa adanya.
          </>
        )}
      </p>
    </>
  );
}

export { rupiah, rupiahRingkas };

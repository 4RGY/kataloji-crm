"use client";

// ============================================================
// Komponen grafik dashboard dengan Recharts.
// Tiga grafik: area tren omzet, donut metode bayar, batang menu teratas.
// Semua warna memakai token tema (CSS variables) jadi tema
// terang/gelap ikut berubah tanpa penyesuaian tambahan.
// ============================================================

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import type { TitikTren, IrisanMetode, BatangMenu } from "@/lib/dashboard-grafik";

const rupiahRingkas = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const rupiahPenuh = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function labelHari(hari: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(new Date(hari + "T00:00:00"));
}

// Warna donut untuk metode bayar
const WARNA_DONUT = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

// Tooltip custom untuk tren omzet
function TooltipOmzet({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-popover-foreground">
        {label ? labelHari(label) : ""}
      </p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        Omzet: <span className="font-bold text-foreground">{rupiahPenuh.format(payload[0].value)}</span>
      </p>
    </div>
  );
}

// Tooltip custom untuk menu teratas
function TooltipMenu({ active, payload }: {
  active?: boolean;
  payload?: { payload: BatangMenu; value: number }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-popover-foreground">{data.nama}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        Terjual: <span className="font-bold text-foreground">{data.qty} porsi</span>
      </p>
    </div>
  );
}

/**
 * Area tren omzet harian.
 */
export function GrafikTrenOmzet({ titik }: { titik: TitikTren[] }) {
  if (titik.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border">
        <p className="text-sm font-medium text-muted-foreground">
          Grafik terisi otomatis setelah transaksi tercatat
        </p>
        <p className="text-xs text-muted-foreground">
          Sumbu horizontal tanggal, sumbu vertikal omzet harian
        </p>
      </div>
    );
  }

  const data = titik.map((t) => ({
    tanggal: t.hari,
    nilai: t.nilai,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradOmzet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.5} />
        <XAxis
          dataKey="tanggal"
          tickFormatter={labelHari}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          dy={8}
        />
        <YAxis
          tickFormatter={(v: number) => rupiahRingkas.format(v)}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          width={48}
        />
        <Tooltip content={<TooltipOmzet />} />
        <Area
          type="monotone"
          dataKey="nilai"
          stroke="var(--color-chart-1)"
          strokeWidth={2.5}
          fill="url(#gradOmzet)"
          dot={false}
          activeDot={{ r: 5, fill: "var(--color-chart-1)", strokeWidth: 2, stroke: "var(--color-background)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Donut metode bayar.
 */
export function DonutMetode({ irisan }: { irisan: IrisanMetode[] }) {
  if (!irisan || irisan.length === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          Belum ada data metode bayar
        </p>
      </div>
    );
  }

  const total = irisan.reduce((s, i) => s + i.jumlah, 0);
  const data = irisan.map((i, idx) => ({
    nama: i.label,
    nilai: i.jumlah,
    warna: WARNA_DONUT[idx % WARNA_DONUT.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ResponsiveContainer width={200} height={160}>
          <PieChart>
            <Pie
              data={data}
              dataKey="nilai"
              nameKey="nama"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              stroke="var(--color-background)"
              strokeWidth={2}
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.warna} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "var(--color-popover)",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value} transaksi`, ""] as [string, string]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Label tengah */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-extrabold tabular-nums text-foreground">
            {total}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            transaksi
          </p>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <div key={d.nama} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: d.warna }}
            />
            <span className="text-xs text-muted-foreground">
              {d.nama} ({d.nilai})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Batang horizontal menu teratas.
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
  if (!cukupData || daftar.length === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {totalPorsi < 20
            ? "Baru " + totalPorsi + " porsi terjual"
            : "Belum ada data"}
        </p>
        <p className="text-xs text-muted-foreground">
          Peringkat menu baru bisa dipercaya setelah 20 porsi terjual
        </p>
      </div>
    );
  }

  // Ambil top 5 saja
  const top5 = daftar.slice(0, 5).map((d) => ({
    nama: d.nama.length > 16 ? d.nama.substring(0, 15) + "..." : d.nama,
    qty: d.qty,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={top5}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} opacity={0.5} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nama"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          width={100}
        />
        <Tooltip content={<TooltipMenu />} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
        <Bar
          dataKey="qty"
          fill="var(--color-chart-2)"
          radius={[0, 4, 4, 0]}
          barSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

#!/bin/bash
set -e
cd "$(dirname "$0")/.."

SUITES=(
  "scripts/uji-normalisasi-wa.mts"
  "scripts/uji-pesan-galat.mts"
  "scripts/uji-staf.mts"
  "scripts/uji-tgl-lahir.mts"
  "scripts/uji-jejak-pencatat.mts"
  "scripts/uji-pelanggan-tampilan.mts"
  "scripts/uji-poin-tampilan.mts"
  "scripts/uji-dashboard-tampilan.mts"
  "scripts/uji-dashboard-grafik.mts"
  "scripts/uji-loyalitas-tampilan.mts"
  "scripts/uji-analitik.mts"
  "scripts/uji-campaign.mts"
  "scripts/uji-laporan-penjualan.mts"
  "scripts/uji-laporan-penjualan-pdf.mts"
  "scripts/uji-banding-penjualan.mts"
  "scripts/uji-banding-penjualan-pdf.mts"
  "scripts/uji-laporan-pdf.mts"
  "scripts/uji-periode-laporan.mts"
  "scripts/uji-impor-metode.mts"
  "scripts/uji-impor-tanpa-timpa.mts"
  "scripts/uji-tulis-impor.mts"
  "scripts/uji-aturan-poin.mts"
  "scripts/uji-aturan-poin-db.mts"
  "scripts/uji-import-e2e.mts"
)

TOTAL=${#SUITES[@]}
LULUS=0
GAGAL=0

echo "Menjalankan $TOTAL suite pengujian..."

for suite in "${SUITES[@]}"; do
  echo -n "[$suite] ... "
  OUT=$(npx tsx "$suite" 2>&1)
  EC=$?
  if [ $EC -eq 0 ]; then
    RINGKAS=$(echo "$OUT" | grep -E "(LULUS|PASS|SELESAI|lulus)" | tail -n 1)
    echo "OK (exit 0) — $RINGKAS"
    LULUS=$((LULUS + 1))
  else
    echo "GAGAL (exit $EC)"
    echo "$OUT" | tail -n 10
    GAGAL=$((GAGAL + 1))
  fi
done

echo ""
echo "=== HASIL AKHIR: $LULUS/$TOTAL SUITE LULUS ($GAGAL GAGAL) ==="
test $GAGAL -eq 0

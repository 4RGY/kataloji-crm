import { hitungPoinTransaksi, type InputHitungPoin } from "@/lib/poin";

// Route tipis — hanya lapisan HTTP.
// Logika sebenarnya ada di src/lib/poin.ts (monolit modular),
// dipanggil via import langsung, bukan network call antar service.
export async function POST(request: Request) {
  let body: Partial<InputHitungPoin>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body harus JSON valid" }, { status: 400 });
  }

  const hasil = hitungPoinTransaksi({
    total: Number(body.total) || 0,
    poin_dipakai: Number(body.poin_dipakai) || 0,
    poin_tersedia: Number(body.poin_tersedia) || 0,
  });

  return Response.json(hasil);
}

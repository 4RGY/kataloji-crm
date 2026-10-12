"""
Uji RLS: sejauh mana tiap peran bisa BACA data lewat REST langsung.
Membuktikan apakah pagar tampilan di UI cuma kosmetik atau benar-benar pagar.
HANYA operasi baca. Tidak ada tulis/hapus.
"""
import json, urllib.request, urllib.error, re, pathlib

akar = pathlib.Path(".")
env = {}
for baris in (akar / ".env.local").read_text(encoding="utf-8").splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", baris.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"')

URL, ANON = env["NEXT_PUBLIC_SUPABASE_URL"], env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
# Sandi dibaca dari .env.local (kunci SANDI_UJI), bukan ditulis di berkas ini,
# supaya sandi tidak pernah ikut ter-commit ke git.
SANDI = env["SANDI_UJI"]
AKUN = {"kasir": "anggara@kataloji.id", "manager": "sinta@kataloji.id", "admin": "wahyu@kataloji.id"}


def ambil(path, kunci, token=None):
    h = {"apikey": kunci, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    else:
        h["Authorization"] = "Bearer " + kunci
    r = urllib.request.Request(f"{URL}{path}", headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        return e.code, (e.read().decode()[:200])


def login(email):
    r = urllib.request.Request(
        f"{URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": SANDI}).encode(),
        headers={"apikey": ANON, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read().decode())["access_token"]
    except urllib.error.HTTPError as e:
        return "GAGAL:" + e.read().decode()[:120]


TABEL = [
    ("transaksi", "omzet: total, diskon, poin"),
    ("point_ledger", "buku besar poin (audit)"),
    ("pelanggan", "identitas + nomor WA"),
    ("profile", "daftar akun staf + peran"),
    ("campaign", "riwayat kampanye"),
    ("aturan_poin", "aturan poin toko"),
    ("kunjungan", "riwayat kunjungan"),
]

print("=== Siapa bisa BACA apa lewat REST (anon key, RLS berlaku) ===\n")
token = {}
for peran, email in AKUN.items():
    token[peran] = login(email)
    print(f"  login {peran:8s}: {'OK' if not token[peran].startswith('GAGAL') else token[peran]}")

print()
lebar = 22
print(f"{'tabel':<{lebar}} {'anon':>8} {'kasir':>8} {'manager':>8} {'admin':>8}   keterangan")
print("-" * 92)
hasil = {}
for tabel, ket in TABEL:
    baris = {}
    st, d = ambil(f"/rest/v1/{tabel}?select=id&limit=1000", ANON)
    baris["anon"] = st if st != 200 else (len(d) if isinstance(d, list) else "?")
    for peran in ("kasir", "manager", "admin"):
        st, d = ambil(f"/rest/v1/{tabel}?select=id&limit=1000", ANON, token[peran])
        baris[peran] = st if st != 200 else (len(d) if isinstance(d, list) else "?")
    hasil[tabel] = baris
    print(f"{tabel:<{lebar}} {str(baris['anon']):>8} {str(baris['kasir']):>8} {str(baris['manager']):>8} {str(baris['admin']):>8}   {ket}")

print("\nAngka = jumlah baris yang TERLIHAT (bukan kode HTTP). 0 baris = ditolak RLS.")
print("Kode HTTP/error = kueri ditolak sebelum RLS (mis. 401/403/400).")

# Inti pertanyaan: apakah KASIR bisa membaca omzet?
print("\n=== Uji fokus: kasir membaca kolom omzet ===")
st, d = ambil("/rest/v1/transaksi?select=total,diskon,poin_dipakai,created_at&limit=1000", ANON, token["kasir"])
if st == 200 and isinstance(d, list):
    total = sum(x.get("total", 0) for x in d)
    print(f"  KASIR melihat {len(d)} baris transaksi, total kolom total = Rp {total:,}".replace(",", "."))
    print("  -> kasir BISA menjumlahkan omzet lewat REST walau UI melarangnya." if len(d) else "  -> kasir tidak melihat baris apa pun.")
else:
    print(f"  kasir ditolak (status {st}): {str(d)[:140]}")

# Anonim harus 401 di semua.
print("\n=== Uji tanpa login (anon) ===")
for tabel, _ in TABEL:
    st, d = ambil(f"/rest/v1/{tabel}?select=id&limit=1", ANON)
    print(f"  {tabel:<16} status {st} {str(d)[:70]}")

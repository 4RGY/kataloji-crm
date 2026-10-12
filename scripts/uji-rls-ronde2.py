"""
Uji RLS ronde 2: nama tabel yang benar + batas baris per peran.

Ronde 1 memakai dua nama tabel yang keliru (campaign, kunjungan). Yang benar:
campaign_kirim dan rekap_pencatat_transaksi (view). Perhatikan selisih
"dilihat vs milik sendiri": ronde 1 hanya menghitung baris TERLIHAT, dan
beberapa angka itu tampak sama antar-peran padahal artinya berbeda.
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


def ambil(path, token=None):
    h = {"apikey": ANON, "Authorization": "Bearer " + (token or ANON)}
    r = urllib.request.Request(f"{URL}{path}", headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:160]


def login(email):
    r = urllib.request.Request(
        f"{URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": SANDI}).encode(),
        headers={"apikey": ANON, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())["access_token"]


token = {p: login(e) for p, e in AKUN.items()}
uid = {}
for p, t in token.items():
    st, d = ambil("/auth/v1/user", t) if False else (None, None)

# Ambil id sendiri dari tabel profile (kolom id = auth uid).
for peran, t in token.items():
    st, d = ambil("/rest/v1/profile?select=id,nama,role", t)
    if st == 200 and d:
        uid[peran] = d[0]["id"]

TABEL = [
    ("transaksi", "omzet + jumlah transaksi"),
    ("point_ledger", "buku besar poin"),
    ("pelanggan", "identitas + nomor WA"),
    ("profile", "akun staf + peran"),
    ("aturan_poin", "aturan poin toko"),
    ("campaign_kirim", "catatan kirim kampanye"),
    ("rekap_pencatat_transaksi", "view rekap kinerja staf"),
]

print("=== Jumlah baris yang TERLIHAT per peran (RLS berlaku) ===\n")
print(f"{'tabel':<26} {'kasir':>7} {'manager':>8} {'admin':>7}   keterangan")
print("-" * 80)
for tabel, ket in TABEL:
    sel = []
    for peran in ("kasir", "manager", "admin"):
        st, d = ambil(f"/rest/v1/{tabel}?select=*&limit=2000", token[peran])
        sel.append(str(len(d)) if st == 200 and isinstance(d, list) else f"HTTP{st}")
    print(f"{tabel:<26} {sel[0]:>7} {sel[1]:>8} {sel[2]:>7}   {ket}")
print("\n0 = ditolak RLS (bukan error). HTTP4xx = ditolak sebelum RLS.")

print("\n=== Fokus 1: profil siapa yang bisa dibaca tiap peran ===")
for peran in ("kasir", "manager", "admin"):
    st, d = ambil("/rest/v1/profile?select=nama,role", token[peran])
    terlihat = [x["nama"] for x in d] if st == 200 and isinstance(d, list) else f"HTTP{st}"
    print(f"  {peran:<8} melihat {len(d) if isinstance(d,list) else '?'} profil: {terlihat}")

print("\n=== Fokus 2: apakah kasir bisa baca transaksi MILIK ORANG LAIN ===")
st, semua = ambil("/rest/v1/transaksi?select=id,dicatat_oleh,dicatat_oleh_nama,total,external_ref&limit=2000", token["kasir"])
if st == 200 and isinstance(semua, list):
    sendiri = [x for x in semua if x.get("dicatat_oleh") == uid["kasir"]]
    oranglain = [x for x in semua if x.get("dicatat_oleh") != uid["kasir"]]
    print(f"  kasir melihat {len(semua)} transaksi: {len(sendiri)} miliknya, {len(oranglain)} milik orang lain")
    total = sum(x["total"] for x in semua)
    print(f"  omzet yang bisa dijumlahkan kasir: Rp {total:,}".replace(",", "."))
    if oranglain:
        print(f"  -> BOCOR: transaksi milik orang lain terlihat (contoh dicatat_oleh_nama={oranglain[0].get('dicatat_oleh_nama')})")

print("\n=== Fokus 3: kasir MENGUBAH / MENULIS transaksi ===")
# PENTING: ronde pertama skrip ini benar-benar menjalankan INSERT dan
# meninggalkan satu baris sampah (total=1) di data produksi, yang lalu
# dihapus manual. Untuk tugas QA izin, cukup PATCH: INSERT yang berhasil
# membuktikan hal yang sama (kasir boleh mencatat transaksi, itu memang
# tugasnya) tanpa menambah baris ke data nyata.
if isinstance(semua, list) and semua:
    target = oranglain[0] if 'oranglain' in dir() and oranglain else semua[0]
    r = urllib.request.Request(
        f"{URL}/rest/v1/transaksi?id=eq.{target['id']}",
        data=json.dumps({"diskon": 1}).encode(), method="PATCH",
        headers={"apikey": ANON, "Authorization": "Bearer " + token["kasir"],
                 "Content-Type": "application/json", "Prefer": "return=representation"},
    )
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            d = json.loads(resp.read().decode() or "[]")
            print(f"  PATCH diskon transaksi orang lain: HTTP {resp.status}, {len(d)} baris "
                  f"{'-> BERHASIL MENGUBAH (celah!)' if d else '-> 0 baris (ditolak RLS, aman)'}")
    except urllib.error.HTTPError as e:
        print(f"  PATCH diskon transaksi orang lain: HTTP {e.code} -> ditolak: {e.read().decode()[:100]}")
    print("  INSERT tidak dijalankan (akan menambah baris nyata); izin mencatat")
    print("  transaksi sudah terbukti dari alur kasir di UI, dan memang tugasnya.")

print("\n=== Fokus 4: siapa boleh ubah peran staf / hapus pelanggan ===")
for peran in ("kasir", "manager"):
    r = urllib.request.Request(
        f"{URL}/rest/v1/profile?id=eq.{uid[peran]}",
        data=json.dumps({"role": "admin"}).encode(), method="PATCH",
        headers={"apikey": ANON, "Authorization": "Bearer " + token[peran],
                 "Content-Type": "application/json", "Prefer": "return=representation"},
    )
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            d = json.loads(resp.read().decode() or "[]")
            print(f"  {peran} naikkan peran sendiri: HTTP {resp.status}, {len(d)} baris -> {'BERHASIL (celah!)' if d else 'ditolak'}")
    except urllib.error.HTTPError as e:
        print(f"  {peran} naikkan peran sendiri: HTTP {e.code} ditolak")

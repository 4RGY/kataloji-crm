"""
Uji penentu: apakah view rekap_pencatat_transaksi & tabel lain memberi
HAK TAMBAHAN di luar tabel transaksi, atau hanya mewarisi policy yang sama.

Ini menguji ulang rekomendasi #10 yang gw tulis di
docs/LAPORAN_QA_SWEEP_3_PERAN.md, karena file itu mengklaim grant
'authenticated' adalah satu-satunya pagar dan pagarnya tidak ada.
Klaim itu harus dibuktikan atau dibatalkan.
"""
import json, urllib.request, urllib.error, re, pathlib

env = {}
for baris in pathlib.Path(".env.local").read_text(encoding="utf-8").splitlines():
    m = re.match(r"^([A-Z_]+)=(.*)$", baris.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"')
URL, ANON = env["NEXT_PUBLIC_SUPABASE_URL"], env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]


def ambil(path, token=None):
    h = {"apikey": ANON, "Authorization": "Bearer " + (token or ANON)}
    r = urllib.request.Request(f"{URL}{path}", headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]


def login(email):
    r = urllib.request.Request(
        f"{URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": "kataloji123"}).encode(),
        headers={"apikey": ANON, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())["access_token"]


kasir = login("anggara@kataloji.id")

print("=== Pertanyaan 1: apakah view mewarisi policy transaksi? ===")
st, trx = ambil("/rest/v1/transaksi?select=id&limit=5000", kasir)
st2, vw = ambil("/rest/v1/rekap_pencatat_transaksi?select=*", kasir)
n_trx = len(trx) if st == 200 else f"HTTP{st}"
n_vw = len(vw) if st2 == 200 else f"HTTP{st2}"
print(f"  transaksi terlihat kasir        : {n_trx} baris")
print(f"  rekap_pencatat_transaksi        : {n_vw} baris (agregat per staf)")
if st == 200 and st2 == 200:
    jumlah_di_view = sum(x["jumlah_transaksi"] for x in vw)
    print(f"  total transaksi dihitung view   : {jumlah_di_view}")
    print(f"  -> {'SAMA: view tidak membocorkan baris yang disembunyikan transaksi' if jumlah_di_view == len(trx) else 'BEDA: view melihat lebih banyak dari tabel (kebocoran nyata)'}")

print("\n=== Pertanyaan 2: apakah anon bisa baca view / tabel? ===")
for p in ["/rest/v1/rekap_pencatat_transaksi?select=*",
          "/rest/v1/point_ledger?select=id&limit=1",
          "/rest/v1/aturan_poin?select=id&limit=1",
          "/rest/v1/transaksi?select=id&limit=1"]:
    st, d = ambil(p)
    print(f"  {p.split('/')[-1][:45]:<48} HTTP {st}")

print("\n=== Pertanyaan 3: siapa yang boleh baca aturan_poin & point_ledger ===")
for email, peran in [("anggara@kataloji.id", "kasir"), ("sinta@kataloji.id", "manager"), ("wahyu@kataloji.id", "admin")]:
    t = login(email)
    st, a = ambil("/rest/v1/aturan_poin?select=id", t)
    st2, l = ambil("/rest/v1/point_ledger?select=id&limit=1", t)
    print(f"  {peran:<8} aturan_poin={len(a) if st==200 else 'HTTP'+str(st)}  point_ledger={len(l) if st2==200 else 'HTTP'+str(st2)}")

print("\n=== Pertanyaan 4: apakah kasir melihat transaksi ORANG LAIN ===")
st, d = ambil("/rest/v1/transaksi?select=dicatat_oleh_nama&limit=5000", kasir)
if st == 200:
    dari = {}
    for x in d:
        k = x.get("dicatat_oleh_nama") or "(kosong)"
        dari[k] = dari.get(k, 0) + 1
    print(f"  sebaran pencatat yang terlihat kasir: {dari}")
    print("  (kalau ada nama staf lain, artinya kasir melihat baris bukan miliknya)")

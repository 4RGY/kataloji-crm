#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generator presentasi Kataloji CRM.

Menghasilkan berkas PowerPoint 16:9 dengan 17 slide. Semua diagram digambar
dengan bentuk asli PowerPoint (rounded rectangle, diamond, konektor, blok
panah), bukan gambar tempel, supaya tetap bisa disunting setelah dibuka.

Palet mengikuti src/app/globals.css yang dikonversi dari oklch:
  espresso   #2A1D14  (teks gelap)
  terracotta #C88F7B  (warna utama / aksen)
  cream      #FAF5EE  (latar)
Ditambah warna turunan agar rapi dan konsisten, bukan hitam-putih.

Jalankan:  PYTHONPATH= python buat-ppt.py
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import MSO_AUTO_SIZE
import copy

# ------------------------------------------------------------------ palet ----
ESPRESSO   = RGBColor(0x2A, 0x1D, 0x14)
TERRACOTTA = RGBColor(0xC8, 0x8F, 0x7B)
TERRA_MED  = RGBColor(0xA9, 0x6F, 0x5B)   # terracotta lebih pekat
TERRA_DARK = RGBColor(0x8A, 0x57, 0x45)
CREAM      = RGBColor(0xFA, 0xF5, 0xEE)
TAN        = RGBColor(0xF3, 0xE7, 0xDE)   # kartu / latar aksen
TAN_DEEP   = RGBColor(0xE9, 0xD6, 0xC7)
SAGE       = RGBColor(0x6E, 0x8F, 0x76)   # berhasil / poin
SAGE_DARK  = RGBColor(0x52, 0x6F, 0x59)
BRICK      = RGBColor(0xB0, 0x5E, 0x4B)   # peringatan / destruktif
GOLD       = RGBColor(0xC9, 0xA9, 0x6B)   # aksen
GOLD_DARK  = RGBColor(0xA8, 0x86, 0x48)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
INK        = RGBColor(0x4A, 0x3B, 0x31)   # teks badan (lebih lembut)
INK_SOFT   = RGBColor(0x6E, 0x5D, 0x52)

FONT = "Segoe UI"

W = Inches(13.333)
H = Inches(7.5)

prs = Presentation()
prs.slide_width = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]


# ---------------------------------------------------------------- util -----
def slide_baru(bg=CREAM):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = bg
    return s


def _set_fill(shp, warna):
    shp.fill.solid()
    shp.fill.fore_color.rgb = warna


def _no_line(shp):
    shp.line.fill.background()


def _garis(shp, warna, pt=1.0):
    shp.line.color.rgb = warna
    shp.line.width = Pt(pt)


def kotak(slide, x, y, w, h, warna, rounded=True, garis=None, tebal=1.25,
          radius=0.10):
    shp = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE,
        x, y, w, h)
    try:
        shp.adjustments[0] = radius
    except Exception:
        pass
    _set_fill(shp, warna)
    if garis is None:
        _no_line(shp)
    else:
        _garis(shp, garis, tebal)
    shp.shadow.inherit = False
    return shp


def lingkaran(slide, x, y, d, warna, garis=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, d, d)
    _set_fill(shp, warna)
    if garis is None:
        _no_line(shp)
    else:
        _garis(shp, garis, 1.25)
    shp.shadow.inherit = False
    return shp


def wajik(slide, x, y, w, h, warna):
    shp = slide.shapes.add_shape(MSO_SHAPE.DIAMOND, x, y, w, h)
    _set_fill(shp, warna)
    _no_line(shp)
    shp.shadow.inherit = False
    return shp


def panah_bawah(slide, x, y, w, h, warna=TERRACOTTA):
    shp = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, x, y, w, h)
    _set_fill(shp, warna)
    _no_line(shp)
    shp.shadow.inherit = False
    return shp


def panah_kanan(slide, x, y, w, h, warna=TERRACOTTA):
    shp = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x, y, w, h)
    _set_fill(shp, warna)
    _no_line(shp)
    shp.shadow.inherit = False
    return shp


def tulis(slide, x, y, w, h, teks, size=16, warna=INK, bold=False,
          align=PP_ALIGN.LEFT, font=FONT, italic=False, anchor=MSO_ANCHOR.TOP,
          line_spacing=1.0, wrap=True):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = line_spacing
    r = p.add_run()
    r.text = teks
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = warna
    r.font.name = font
    return tb


def tulis_multi(slide, x, y, w, h, baris, anchor=MSO_ANCHOR.TOP,
                line_spacing=1.0):
    """baris = list of list of (teks, size, warna, bold)."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, runs in enumerate(baris):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = line_spacing
        for (teks, size, warna, bold) in runs:
            r = p.add_run()
            r.text = teks
            r.font.size = Pt(size)
            r.font.bold = bold
            r.font.color.rgb = warna
            r.font.name = FONT
    return tb


def header(slide, label, judul, subjudul=None):
    """Header standar untuk slide konten."""
    # chip label bagian (kiri atas)
    chip_w = Inches(0.14 + 0.16 * len(label))
    chip = kotak(slide, Inches(0.55), Inches(0.42), chip_w, Inches(0.34),
                 TERRACOTTA, radius=0.5)
    tulis(slide, Inches(0.55), Inches(0.44), chip_w, Inches(0.30), label,
          size=11, warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
    # judul
    tulis(slide, Inches(0.55), Inches(0.86), Inches(12.2), Inches(0.62),
          judul, size=30, warna=ESPRESSO, bold=True)
    # garis aksen
    kotak(slide, Inches(0.57), Inches(1.52), Inches(1.5), Inches(0.07),
          TERRACOTTA, rounded=False)
    if subjudul:
        tulis(slide, Inches(0.55), Inches(1.70), Inches(12.2), Inches(0.4),
              subjudul, size=13, warna=INK_SOFT)


def footer(slide, nomor, total=18):
    tulis(slide, Inches(0.55), Inches(7.08), Inches(6), Inches(0.3),
          "Kataloji CRM", size=9, warna=INK_SOFT)
    tulis(slide, Inches(11.9), Inches(7.08), Inches(0.9), Inches(0.3),
          f"{nomor:02d} / {total}", size=9, warna=INK_SOFT, align=PP_ALIGN.RIGHT)


def chip(slide, x, y, teks, warna=TERRACOTTA, warna_teks=WHITE, size=11):
    w = Inches(0.24 + 0.145 * len(teks))
    kotak(slide, x, y, w, Inches(0.34), warna, radius=0.5)
    tulis(slide, x, y + Inches(0.02), w, Inches(0.28), teks, size=size,
          warna=warna_teks, bold=True, align=PP_ALIGN.CENTER)


def kartu(slide, x, y, w, h, judul, badan, warna_badan=TAN, ikon=None,
          judul_size=15, badan_size=11.5, warna_judul=ESPRESSO,
          warna_teks=INK):
    kotak(slide, x, y, w, h, warna_badan, garis=TERRA_MED, tebal=1.0)
    # strip aksen kiri
    kotak(slide, x, y + Inches(0.08), Inches(0.09), h - Inches(0.16),
          TERRACOTTA, rounded=False)
    ty = y + Inches(0.16)
    if ikon:
        lingkaran(slide, x + Inches(0.22), y + Inches(0.16), Inches(0.42),
                  TERRACOTTA)
        tulis(slide, x + Inches(0.22), y + Inches(0.20), Inches(0.42),
              Inches(0.34), ikon, size=16, warna=WHITE, bold=True,
              align=PP_ALIGN.CENTER)
        tx = x + Inches(0.78)
    else:
        tx = x + Inches(0.24)
    tulis(slide, tx, ty, w - Inches(0.4), Inches(0.4), judul, size=judul_size,
          warna=warna_judul, bold=True)
    tulis(slide, tx, ty + Inches(0.44), w - Inches(0.45), h - Inches(0.60),
          badan, size=badan_size, warna=warna_teks, line_spacing=1.08)


# ----------------------------------------------------------------- slide ----
def s1_sampul():
    s = slide = slide_baru()
    # latar espresso penuh, dengan pita terracotta di bawah
    kotak(s, 0, 0, W, H, ESPRESSO, rounded=False)
    kotak(s, 0, Inches(6.1), W, Inches(1.4), TERRACOTTA, rounded=False)
    kotak(s, 0, Inches(6.1), W, Inches(0.12), GOLD, rounded=False)

    # tanda aplikasi: lingkaran terracotta dengan huruf K
    lingkaran(s, Inches(0.9), Inches(0.85), Inches(1.05), TERRACOTTA)
    tulis(s, Inches(0.9), Inches(0.95), Inches(1.05), Inches(0.85), "K",
          size=44, warna=WHITE, bold=True, align=PP_ALIGN.CENTER,
          anchor=MSO_ANCHOR.MIDDLE)

    tulis(s, Inches(0.9), Inches(2.15), Inches(11), Inches(0.5),
          "KATALOJI CRM", size=20, warna=GOLD, bold=True)
    tulis_multi(s, Inches(0.9), Inches(2.62), Inches(11.6), Inches(2.0),
                [[("Sistem Loyalitas & Kasir", 44, WHITE, True)],
                 [("untuk Kedai Kopi", 44, WHITE, True)]], line_spacing=1.03)
    tulis(s, Inches(0.9), Inches(4.35), Inches(11.6), Inches(0.6),
          "Catat transaksi, kumpulkan poin pelanggan, kirim promosi, "
          "dan awasi kas — satu aplikasi.",
          size=16, warna=RGBColor(0xE6, 0xD8, 0xCE))

    # blok penyusun / pembimbing
    tulis(s, Inches(0.9), Inches(6.35), Inches(5.4), Inches(0.35),
          "Penyusun        [nama penyusun]", size=13, warna=WHITE, bold=True)
    tulis(s, Inches(0.9), Inches(6.75), Inches(5.4), Inches(0.35),
          "Pembimbing   [nama pembimbing]", size=13, warna=WHITE, bold=True)
    tulis(s, Inches(9.2), Inches(6.52), Inches(3.2), Inches(0.26),
          "Kerja Praktik", size=12, warna=RGBColor(0xF3, 0xE7, 0xDE),
          align=PP_ALIGN.RIGHT)
    tulis(s, Inches(9.2), Inches(6.78), Inches(3.2), Inches(0.26),
          "Sistem Informasi", size=12, warna=RGBColor(0xF3, 0xE7, 0xDE),
          align=PP_ALIGN.RIGHT)


def s2_agenda():
    s = slide = slide_baru()
    header(s, "PENDAHULUAN", "Apa yang dibahas", 
           "Alur presentasi, dari masalah sampai rencana lanjutan.")
    items = [
        ("01", "Masalah", "Pencatatan manual, poin tersebar, kas tidak terawasi."),
        ("02", "Solusi", "Kataloji CRM dan nilai utamanya untuk kedai."),
        ("03", "Alur kerja", "Transaksi, siklus poin, pelanggan, dan pemasaran."),
        ("04", "Hak akses", "Tiga peran dan batasnya masing-masing."),
        ("05", "Teknikal", "Arsitektur, keamanan, dan kualitas pengujian."),
        ("06", "Lanjutan", "Capaian dan rencana ke depan."),
    ]
    x0, y0 = Inches(0.7), Inches(2.15)
    gw, gh = Inches(3.95), Inches(1.45)
    for i, (no, t, d) in enumerate(items):
        col = i % 3
        baris = i // 3
        x = x0 + col * (gw + Inches(0.28))
        y = y0 + baris * (gh + Inches(0.30))
        kartu(s, x, y, gw, gh, t, d, ikon=no, judul_size=14, badan_size=10.5)
    footer(s, 2)


def s3_masalah():
    s = slide = slide_baru()
    header(s, "PENDAHULUAN", "Masalah di kedai kopi",
           "Tanpa sistem, pemilik dan kasir bekerja dengan cara yang rapuh.")
    cards = [
        ("01", "Poin ditulis di kertas",
         "Kartu cap atau catatan kertas mudah hilang, tidak bisa dihitung "
         "ulang, dan tidak memberi alasan bagi pelanggan untuk kembali."),
        ("02", "Tidak tahu siapa pelanggannya",
         "Tidak ada catatan siapa yang sering datang, kapan ulang tahunnya, "
         "atau menu favoritnya. Promosi jadi menembak membabi buta."),
        ("03", "Kas tidak jelas",
         "Setoran akhir hari mengandalkan ingatan. Siapa mencatat transaksi "
         "apa, dan berapa jumlahnya, sulit ditelusuri kalau ada selisih."),
        ("04", "Akses tanpa batas",
         "Semua orang memakai akun yang sama. Tidak ada pemisahan antara "
         "yang boleh mengubah data dan yang hanya boleh mencatat."),
    ]
    x0, y0 = Inches(0.7), Inches(2.3)
    cw, ch = Inches(5.95), Inches(2.05)
    for i, (no, t, d) in enumerate(cards):
        col = i % 2
        baris = i // 2
        kartu(s, x0 + col * (cw + Inches(0.30)),
              y0 + baris * (ch + Inches(0.28)), cw, ch, t, d,
              ikon=no, judul_size=15, badan_size=11.5)
    footer(s, 3)


def s4_solusi():
    s = slide = slide_baru()
    header(s, "SOLUSI", "Kataloji CRM",
           "Satu aplikasi web yang menyatukan kasir, loyalitas, dan pemasaran.")
    # tiga pilar besar
    pil = [
        ("Kasir", "Catat transaksi cepat dengan tombol nominal, diskon, dan "
         "penukaran poin. Nomor struk Majoo bisa dicantumkan.", "Rp"),
        ("Loyalitas", "Poin otomatis masuk ke saldo pelanggan. Ada buku besar "
         "agar setiap poin bisa ditelusuri asal-usulnya.", "★"),
        ("Pemasaran", "Kirim pesan WhatsApp massal lewat campaign, pantau "
         "hasilnya, dan baca analitik kedai.", "↗"),
    ]
    x0 = Inches(0.7)
    cw = Inches(3.95)
    ch = Inches(2.15)
    for i, (t, d, ikon) in enumerate(pil):
        kartu(s, x0 + i * (cw + Inches(0.28)), Inches(2.25), cw, ch,
              t, d, ikon=ikon, judul_size=16, badan_size=11)
    # baris nilai
    nilai = [
        "Tiga peran: Admin, Manager, Kasir",
        "Data tersimpan aman di cloud",
        "Bisa dibuka dari HP atau tablet kasir",
        "Poin tidak bisa dimanipulasi",
    ]
    y = Inches(4.75)
    for i, n in enumerate(nilai):
        x = x0 + i * (cw + Inches(0.28))
        lingkaran(s, x + Inches(0.05), y + Inches(0.04), Inches(0.3), SAGE)
        tulis(s, x + Inches(0.05), y + Inches(0.06), Inches(0.3), Inches(0.26),
              "✓", size=13, warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
        tulis(s, x + Inches(0.45), y, cw - Inches(0.5), Inches(0.75), n,
              size=11.5, warna=INK, line_spacing=1.05)
    footer(s, 4)


def s5_arsitektur():
    s = slide = slide_baru()
    header(s, "TEKNIKAL", "Arsitektur & teknologi",
           "Aplikasi web modern, satu basis kode, data di Supabase.")
    # lapisan tumpukan
    stack = [
        ("Antarmuka", "React + Next.js (App Router), Tailwind CSS, komponen shadcn/ui", TERRACOTTA),
        ("Logika & API", "Server actions + route handler, logika bisnis murni di src/lib", TERRA_MED),
        ("Data & Auth", "Supabase (PostgreSQL) — autentikasi, basis data, Row Level Security", SAGE_DARK),
    ]
    y = Inches(2.2)
    for nama, det, warna in stack:
        kotak(s, Inches(1.3), y, Inches(10.7), Inches(1.05), warna)
        tulis(s, Inches(1.65), y + Inches(0.12), Inches(2.3), Inches(0.4),
              nama, size=15, warna=WHITE, bold=True)
        tulis(s, Inches(4.1), y + Inches(0.12), Inches(7.7), Inches(0.8),
              det, size=11.5, warna=WHITE)
        y += Inches(1.28)
    # catatan samping
    kotak(s, Inches(1.3), Inches(6.05), Inches(10.7), Inches(0.85), TAN,
          garis=TERRA_MED, tebal=1.0)
    tulis_multi(s, Inches(1.6), Inches(6.2), Inches(10.1), Inches(0.6),
                [[("Satu basis kode. ", 12, ESPRESSO, True),
                  ("Logika bisnis (poin, peran, validasi) ditulis sekali di src/lib dan diuji lewat 694 asersi, "
                   "bukan tersebar di banyak berkas.", 12, INK, False)]])
    footer(s, 5)


def _flow_node(slide, x, y, w, h, judul, badan, warna=TAN, judul_size=12.5,
               badan_size=10):
    kotak(slide, x, y, w, h, warna, garis=TERRA_MED, tebal=1.0)
    tulis(slide, x + Inches(0.12), y + Inches(0.08), w - Inches(0.24),
          Inches(0.3), judul, size=judul_size, warna=ESPRESSO, bold=True,
          align=PP_ALIGN.CENTER)
    if badan:
        tulis(slide, x + Inches(0.12), y + Inches(0.40), w - Inches(0.24),
              h - Inches(0.46), badan, size=badan_size, warna=INK,
              align=PP_ALIGN.CENTER, line_spacing=1.02)


def s6_alur_transaksi():
    s = slide = slide_baru()
    header(s, "ALUR KERJA", "Alur transaksi kasir",
           "Dari memilih pelanggan sampai poin masuk ke saldo.")
    # kolom kiri: langkah vertikal
    steps = [
        ("1", "Pilih pelanggan", "Cari nama atau 3 digit akhir WhatsApp, atau buat pelanggan baru."),
        ("2", "Input tagihan", "Tombol cepat +10rb…+100rb, atau ketik. Tambah diskon promo bila ada."),
        ("3", "Tukar poin (opsional)", "Minimal 5 poin, maksimal 100% tagihan. 1 poin = Rp 1.000."),
        ("4", "Pratinjau & simpan", "Poin didapat, potongan, dan yang dibayar tampil sebelum disimpan."),
    ]
    x, y = Inches(0.7), Inches(2.15)
    sw, sh = Inches(6.3), Inches(0.98)
    for i, (no, t, d) in enumerate(steps):
        kotak(slide, x, y, sw, sh, TAN, garis=TERRA_MED, tebal=1.0)
        lingkaran(slide, x + Inches(0.16), y + Inches(0.29), Inches(0.42),
                  TERRACOTTA)
        tulis(slide, x + Inches(0.16), y + Inches(0.32), Inches(0.42),
              Inches(0.34), no, size=15, warna=WHITE, bold=True,
              align=PP_ALIGN.CENTER)
        tulis(slide, x + Inches(0.72), y + Inches(0.09), Inches(5.4),
              Inches(0.32), t, size=12.5, warna=ESPRESSO, bold=True)
        tulis(slide, x + Inches(0.72), y + Inches(0.42), Inches(5.4),
              Inches(0.5), d, size=10, warna=INK, line_spacing=1.0)
        if i < 3:
            panah_bawah(slide, x + Inches(0.29), y + sh, Inches(0.26),
                        Inches(0.20), TERRACOTTA)
        y += sh + Inches(0.20)
    # kolom kanan: hasil
    rx = Inches(7.35)
    kotak(slide, rx, Inches(2.15), Inches(5.35), Inches(4.15), CREAM,
          garis=TERRA_MED, tebal=1.25)
    tulis(slide, rx + Inches(0.3), Inches(2.32), Inches(4.7), Inches(0.4),
          "Yang terjadi setelah Simpan", size=15, warna=ESPRESSO, bold=True)
    hasil = [
        ("Transaksi tersimpan", "beserta siapa pencatatnya, jumlah, dan poinnya."),
        ("Poin masuk saldo pelanggan", "dan tercatat di buku besar sebagai earn."),
        ("Nomor struk tersimpan", "bila diisi, sebagai rujukan struk Majoo."),
    ]
    yy = Inches(2.82)
    for t, d in hasil:
        lingkaran(slide, rx + Inches(0.32), yy + Inches(0.05), Inches(0.28), SAGE)
        tulis(slide, rx + Inches(0.32), yy + Inches(0.07), Inches(0.28),
              Inches(0.24), "✓", size=12, warna=WHITE, bold=True,
              align=PP_ALIGN.CENTER)
        tulis(slide, rx + Inches(0.72), yy, Inches(4.6), Inches(0.35), t,
              size=12, warna=ESPRESSO, bold=True)
        tulis(slide, rx + Inches(0.72), yy + Inches(0.34), Inches(4.6),
              Inches(0.55), d, size=10.5, warna=INK, line_spacing=1.0)
        yy += Inches(1.05)
    footer(s, 6)


def s7_aturan_poin():
    s = slide = slide_baru()
    header(s, "ALUR KERJA", "Aturan poin (tepat)",
           "Angka yang dipakai aplikasi, bukan perkiraan.")
    rules = [
        ("1 poin", "per Rp 20.000", "Dari total setelah diskon promo, sebelum potongan poin.", TERRACOTTA),
        ("1 poin", "= Rp 1.000", "Nilai poin saat ditukar memotong tagihan.", GOLD_DARK),
        ("5 poin", "minimum tukar", "Penukaran di bawah itu ditolak aplikasi.", TERRA_DARK),
        ("100%", "batas atas tukar", "Potongan poin tidak boleh melebihi tagihan.", SAGE_DARK),
        ("12 bulan", "masa berlaku", "Poin yang tidak dipakai akan hangus (expire).", BRICK),
    ]
    x0 = Inches(0.7)
    cw = Inches(3.95)
    ch = Inches(2.3)
    for i, (besar, kecil, det, warna) in enumerate(rules):
        col = i % 3
        baris = i // 3
        x = x0 + col * (cw + Inches(0.28))
        y = Inches(2.2) + baris * (ch + Inches(0.26))
        kotak(slide, x, y, cw, ch, TAN, garis=TERRA_MED, tebal=1.0)
        kotak(slide, x, y, cw, Inches(0.12), warna, rounded=False)
        tulis(slide, x + Inches(0.25), y + Inches(0.30), cw - Inches(0.5),
              Inches(0.75), besar, size=34, warna=warna, bold=True)
        tulis(slide, x + Inches(0.25), y + Inches(1.10), cw - Inches(0.5),
              Inches(0.4), kecil, size=14, warna=ESPRESSO, bold=True)
        tulis(slide, x + Inches(0.25), y + Inches(1.55), cw - Inches(0.5),
              Inches(0.65), det, size=10.5, warna=INK, line_spacing=1.05)
    footer(s, 7)


def s8_siklus_poin():
    s = slide = slide_baru()
    header(s, "ALUR KERJA", "Siklus hidup poin",
           "Setiap perubahan saldo tercatat di buku besar dan bisa ditelusuri.")
    # empat tahap horizontal + ledger di bawah
    tahap = [
        ("EARN", "Dapat", "Transaksi dengan pelanggan menambah saldo.", SAGE),
        ("REDEEM", "Tukar", "Dipakai memotong tagihan (min 5 poin).", GOLD),
        ("EXPIRE", "Hangus", "Poin kedaluwarsa setelah 12 bulan.", BRICK),
        ("ADJUST", "Koreksi", "Penyesuaian manual oleh yang berwenang.", TERRA_MED),
    ]
    x0 = Inches(0.7)
    cw = Inches(2.85)
    ch = Inches(2.05)
    for i, (kode, t, d, warna) in enumerate(tahap):
        x = x0 + i * (cw + Inches(0.35))
        kotak(slide, x, Inches(2.2), cw, ch, TAN, garis=TERRA_MED, tebal=1.0)
        kotak(slide, x, Inches(2.2), cw, Inches(0.5), warna, rounded=False)
        tulis(slide, x, Inches(2.26), cw, Inches(0.4), kode, size=13,
              warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
        tulis(slide, x + Inches(0.15), Inches(2.85), cw - Inches(0.3),
              Inches(0.4), t, size=15, warna=ESPRESSO, bold=True,
              align=PP_ALIGN.CENTER)
        tulis(slide, x + Inches(0.15), Inches(3.28), cw - Inches(0.3),
              Inches(0.85), d, size=10.5, warna=INK, align=PP_ALIGN.CENTER,
              line_spacing=1.05)
        if i < 3:
            panah_kanan(slide, x + cw + Inches(0.03), Inches(3.0),
                        Inches(0.29), Inches(0.26), TERRACOTTA)
    # buku besar
    kotak(slide, Inches(0.7), Inches(4.7), Inches(11.95), Inches(1.9), CREAM,
          garis=TERRA_MED, tebal=1.25)
    tulis(slide, Inches(1.0), Inches(4.9), Inches(11), Inches(0.4),
          "Buku besar (point_ledger)", size=15, warna=ESPRESSO, bold=True)
    tulis(slide, Inches(1.0), Inches(5.35), Inches(11.3), Inches(1.1),
          "Setiap baris menyimpan jenis (earn/redeem/expire/adjust), jumlah, dan sisa saldo. "
          "Hanya earn dan adjust yang menambah saldo; redeem dan expire menguranginya. "
          "Dengan begitu, saldo pelanggan mana pun bisa dihitung ulang baris demi baris.",
          size=11.5, warna=INK, line_spacing=1.15)
    footer(s, 8)


def s9_pelanggan():
    s = slide = slide_baru()
    header(s, "ALUR KERJA", "Kelola pelanggan",
           "Basis data pelanggan lengkap dengan riwayat dan segmen.")
    kartus = [
        ("Profil", "Nama, nomor WhatsApp (dinormalisasi otomatis 08→+62), "
         "dan tanggal lahir untuk ucapan ulang tahun."),
        ("Riwayat", "Kunjungan, transaksi, dan saldo poin tampil per pelanggan. "
         "Satu kali ketuk langsung chat via WhatsApp."),
        ("Arsipkan", "Pelanggan yang tidak aktif bisa diarsipkan tanpa menghapus "
         "riwayat dan poinnya. Bisa dikembalikan kapan saja."),
        ("Segmen", "Pengelompokan otomatis: belum transaksi, perlu disapa, "
         "ulang tahun bulan ini — untuk sasaran promosi."),
    ]
    x0, y0 = Inches(0.7), Inches(2.2)
    cw, ch = Inches(5.95), Inches(2.05)
    for i, (t, d) in enumerate(kartus):
        col = i % 2
        baris = i // 2
        kartu(s, x0 + col * (cw + Inches(0.3)), y0 + baris * (ch + Inches(0.26)),
              cw, ch, t, d, judul_size=15, badan_size=11)
    footer(s, 9)


def s10_pemasaran():
    s = slide = slide_baru()
    header(s, "ALUR KERJA", "Pemasaran (campaign)",
           "Kirim pesan promosi yang tepat sasaran, bukan menyebar ke semua.")
    # flowchart horizontal
    steps = [
        ("1", "Pilih segmen", "Pelanggan yang perlu disapa atau berulang tahun."),
        ("2", "Susun pesan", "Teks promosi, boleh tanpa variabel."),
        ("3", "Kirim", "Dikirim lewat WhatsApp tiap pelanggan."),
        ("4", "Pantau", "Berapa terkirim dan berapa yang datang kembali."),
    ]
    x = Inches(0.7)
    y = Inches(2.35)
    cw, ch = Inches(2.82), Inches(2.0)
    for i, (no, t, d) in enumerate(steps):
        kotak(slide, x, y, cw, ch, TAN, garis=TERRA_MED, tebal=1.0)
        lingkaran(slide, x + cw/2 - Inches(0.25), y + Inches(0.22),
                  Inches(0.5), TERRACOTTA)
        tulis(slide, x + cw/2 - Inches(0.25), y + Inches(0.28), Inches(0.5),
              Inches(0.38), no, size=17, warna=WHITE, bold=True,
              align=PP_ALIGN.CENTER)
        tulis(slide, x + Inches(0.1), y + Inches(0.92), cw - Inches(0.2),
              Inches(0.35), t, size=13, warna=ESPRESSO, bold=True,
              align=PP_ALIGN.CENTER)
        tulis(slide, x + Inches(0.14), y + Inches(1.28), cw - Inches(0.28),
              Inches(0.65), d, size=10, warna=INK, align=PP_ALIGN.CENTER,
              line_spacing=1.02)
        if i < 3:
            panah_kanan(slide, x + cw + Inches(0.03), y + Inches(0.85),
                        Inches(0.28), Inches(0.26), TERRACOTTA)
        x += cw + Inches(0.34)
    # catatan keputusan
    kotak(slide, Inches(0.7), Inches(4.75), Inches(11.95), Inches(1.7), CREAM,
          garis=TERRA_MED, tebal=1.25)
    tulis_multi(slide, Inches(1.0), Inches(4.95), Inches(11.3), Inches(1.4),
                [[("Keputusan tingkat pengelola. ", 13, ESPRESSO, True),
                  ("Menu Campaign dan Analitik sengaja tidak tampil untuk kasir — bukan soal kerahasiaan, "
                   "tetapi karena mengirim promosi bukan keputusan yang diambil di tengah melayani antrean. "
                   "Hanya Admin dan Manager yang melihatnya.", 11.5, INK, False)]])
    footer(s, 10)


def s11_analitik():
    s = slide = slide_baru()
    header(s, "ALUR KERJA", "Analitik & rekap kasir",
           "Memantau kedai dan pertanggungjawaban kas.")
    kartus = [
        ("Analitik", "Omzet per periode (hari/3/7/30 hari atau rentang), grafik "
         "omzet, jam ramai, dan papan loyalitas. Semua angka ringkas di satu layar."),
        ("Rekap kasir", "Siapa mencatat transaksi apa, per periode. Dipakai untuk "
         "menelusuri selisih kas dan pertanggungjawaban antar staf."),
        ("Pembukuan poin", "Pemeriksaan otomatis memastikan saldo poin di buku besar "
         "selalu sama dengan total yang seharusnya. Kalau ada selisih, langsung ketahuan."),
    ]
    x0 = Inches(0.7)
    cw = Inches(3.95)
    ch = Inches(3.6)
    for i, (t, d) in enumerate(kartus):
        kartu(s, x0 + i * (cw + Inches(0.28)), Inches(2.3), cw, ch, t, d,
              judul_size=15, badan_size=11)
    footer(s, 11)


def _cek(slide, x, y, ok, teks="", size=11.5):
    warna = SAGE if ok else BRICK
    simbol = "✓" if ok else "✗"
    lingkaran(slide, x, y + Inches(0.04), Inches(0.30), warna)
    tulis(slide, x, y + Inches(0.07), Inches(0.30), Inches(0.26), simbol,
          size=12.5, warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
    if teks:
        tulis(slide, x + Inches(0.40), y, Inches(2.6), Inches(0.7), teks,
              size=size, warna=INK, line_spacing=1.0)


def s12_peran():
    """Kartu per peran, lapang.

    Slide ini dulu digabung dengan matriks kemampuan menjadi satu halaman.
    Hasilnya terlalu padat: sebelas baris teks plus dua belas tanda centang
    dalam satu layar. Dipisah dua, masing-masing jadi lapang.
    """
    s = slide = slide_baru()
    header(s, "HAK AKSES", "Tiga peran di Kataloji",
           "Setiap staf masuk dengan akunnya sendiri; menu dan izin mengikuti perannya.")
    data = [
        ("Admin", "9", TERRACOTTA,
         "Pemilik atau pengelola kedai. Akses penuh ke seluruh sistem.",
         ["Semua yang bisa Manager",
          "Kelola akun staf dan perannya",
          "Ubah pengaturan sistem"]),
        ("Manager", "8", GOLD_DARK,
         "Kepala shift. Mengatur data dan pemasaran, tanpa menyentuh akun.",
         ["Semua yang bisa Kasir",
          "Kirim campaign dan baca analitik",
          "Lihat rekap kinerja kasir"]),
        ("Kasir", "5", SAGE_DARK,
         "Petugas depan. Fokus melayani pelanggan di antrean.",
         ["Catat transaksi dan poin",
          "Tambah pelanggan baru",
          "Tukar poin pelanggan"]),
    ]
    x0 = Inches(0.7)
    cw = Inches(3.95)
    y = Inches(2.28)
    ch = Inches(4.5)
    for i, (nama, jml, warna, det, boleh) in enumerate(data):
        x = x0 + i * (cw + Inches(0.28))
        kotak(s, x, y, cw, ch, TAN, garis=TERRA_MED, tebal=1.0)
        kotak(s, x, y, cw, Inches(0.13), warna, rounded=False)
        lingkaran(s, x + cw - Inches(1.12), y + Inches(0.34), Inches(0.74), warna)
        tulis(s, x + cw - Inches(1.12), y + Inches(0.46), Inches(0.74),
              Inches(0.44), jml, size=22, warna=WHITE, bold=True,
              align=PP_ALIGN.CENTER)
        tulis(s, x + cw - Inches(1.12), y + Inches(1.12), Inches(0.74),
              Inches(0.24), "menu", size=8.5, warna=INK_SOFT,
              align=PP_ALIGN.CENTER)
        tulis(s, x + Inches(0.28), y + Inches(0.44), cw - Inches(1.5),
              Inches(0.5), nama, size=21, warna=warna, bold=True)
        # Keterangan ditaruh di bawah label "menu", bukan sebaris dengannya.
        # Kalau sebaris, baris terpanjang keterangan akan menabrak label itu.
        tulis(s, x + Inches(0.28), y + Inches(1.50), cw - Inches(0.56),
              Inches(0.85), det, size=11, warna=INK, line_spacing=1.12)
        kotak(s, x + Inches(0.28), y + Inches(2.42), cw - Inches(0.56),
              Inches(0.014), TAN_DEEP, rounded=False)
        tulis(s, x + Inches(0.28), y + Inches(2.56), cw - Inches(0.56),
              Inches(0.26), "Yang boleh dilakukan", size=9.5, warna=INK_SOFT,
              bold=True)
        yy = y + Inches(2.92)
        for b in boleh:
            lingkaran(s, x + Inches(0.30), yy + Inches(0.04), Inches(0.28), warna)
            tulis(s, x + Inches(0.30), yy + Inches(0.06), Inches(0.28),
                  Inches(0.24), "✓", size=10.5, warna=WHITE, bold=True,
                  align=PP_ALIGN.CENTER)
            tulis(s, x + Inches(0.70), yy, cw - Inches(1.02), Inches(0.44),
                  b, size=11, warna=INK, line_spacing=1.0)
            yy += Inches(0.52)
    footer(s, 12)


def s13_matriks():
    s = slide = slide_baru()
    header(s, "HAK AKSES", "Matriks kemampuan",
           "Rinciannya per kemampuan. Halaman yang ditolak tetap terkunci walau alamatnya diketik langsung.")
    LX, LW = 0.72, 5.28
    CW = 2.23
    CX = [6.10, 8.33, 10.56]

    for i, (nama, warna) in enumerate([("Admin", TERRACOTTA),
                                       ("Manager", GOLD_DARK),
                                       ("Kasir", SAGE_DARK)]):
        x = Inches(CX[i] - 0.15)
        kotak(s, x, Inches(1.96), Inches(CW), Inches(0.46), warna)
        tulis(s, x, Inches(2.03), Inches(CW), Inches(0.34), nama, size=12.5,
              warna=WHITE, bold=True, align=PP_ALIGN.CENTER)

    fitur = [
        ("Catat transaksi dan poin", True, True, True),
        ("Tambah dan ubah data pelanggan", True, True, True),
        ("Arsipkan dan kembalikan pelanggan", True, True, True),
        ("Lihat dashboard dan analitik", True, True, False),
        ("Kirim campaign pemasaran", True, True, False),
        ("Lihat rekap kinerja kasir", True, True, False),
        ("Kelola akun staf", True, False, False),
        ("Ubah pengaturan sistem", True, False, False),
    ]
    y = Inches(2.72)
    rh = Inches(0.50)
    for idx, (nama, a, m, k) in enumerate(fitur):
        if idx % 2 == 0:
            kotak(s, Inches(0.60), y - Inches(0.05), Inches(12.30),
                  Inches(0.46), TAN, radius=0.18)
        tulis(s, Inches(LX), y + Inches(0.07), Inches(LW), Inches(0.32),
              nama, size=12, warna=ESPRESSO)
        for i, ok in enumerate((a, m, k)):
            # -0,30 bukan -0,15: nilai ini tepi KIRI lingkaran selebar 0,30,
            # jadi titik tengahnya jatuh di CX[i] + CW/2 - 0,15, sama dengan
            # titik tengah blok judul kolom di atasnya. Versi pertama memakai
            # -0,15 sehingga seluruh tanda centang bergeser 0,15 inci ke kanan.
            cx = Inches(CX[i] + CW / 2 - 0.30)
            _cek(s, cx, y, ok)
        y += rh
    footer(s, 13)


def s14_keamanan():
    s = slide = slide_baru()
    header(s, "TEKNIKAL", "Keamanan",
           "Data dilindungi berlapis, di antar muka maupun di basis data.")
    kartus = [
        ("Autentikasi", "Masuk lewat Supabase Auth. Kata sandi minimal 8 "
         "karakter memuat huruf dan angka; sesi dikelola server."),
        ("Row Level Security", "Basis data menolak akses yang tidak berhak, "
         "bukan hanya menyembunyikan menu. Penembusan lewat alamat tetap ditolak."),
        ("Penjaga izin", "Setiap halaman memeriksa peran sebelum merender data. "
         "Halaman Staf hanya admin; Rekap kasir admin & manager."),
        ("Anti-kunci-diri", "Admin tidak bisa menghapus atau menurunkan "
         "akunnya sendiri, supaya sistem tidak pernah kehilangan admin terakhir."),
    ]
    x0, y0 = Inches(0.7), Inches(2.2)
    cw, ch = Inches(5.95), Inches(1.72)
    for i, (t, d) in enumerate(kartus):
        col = i % 2
        baris = i // 2
        kartu(s, x0 + col * (cw + Inches(0.3)), y0 + baris * (ch + Inches(0.24)),
              cw, ch, t, d, judul_size=15, badan_size=10.5)
    footer(s, 14)


def s15_kualitas():
    s = slide = slide_baru()
    header(s, "TEKNIKAL", "Kualitas & pengujian",
           "Diuji otomatis dan manual, tiga peran, sebelum diserahkan.")
    angka = [
        ("694", "asersi otomatis", "10 harness tsx — aturan poin, peran, validasi, saldo buku besar."),
        ("3", "peran diuji manual", "Admin, Manager, Kasir — semua halaman dibuka dan dicoba."),
        ("15", "halaman lolos build", "Build produksi bersih, tanpa galat tipe."),
        ("4", "cacat diperbaiki", "Ditemukan lewat pengujian manual, lalu ditutup."),
    ]
    x0 = Inches(0.7)
    cw = Inches(2.85)
    ch = Inches(2.5)
    for i, (besar, kecil, det) in enumerate(angka):
        x = x0 + i * (cw + Inches(0.28))
        kotak(slide, x, Inches(2.3), cw, ch, TAN, garis=TERRA_MED, tebal=1.0)
        tulis(slide, x, Inches(2.55), cw, Inches(0.9), besar, size=44,
              warna=TERRACOTTA, bold=True, align=PP_ALIGN.CENTER)
        tulis(slide, x, Inches(3.45), cw, Inches(0.35), kecil, size=13,
              warna=ESPRESSO, bold=True, align=PP_ALIGN.CENTER)
        tulis(slide, x + Inches(0.2), Inches(3.85), cw - Inches(0.4),
              Inches(0.85), det, size=9.5, warna=INK, align=PP_ALIGN.CENTER,
              line_spacing=1.05)
    # catatan metodologi
    kotak(slide, Inches(0.7), Inches(5.15), Inches(11.95), Inches(1.35), CREAM,
          garis=TERRA_MED, tebal=1.25)
    tulis_multi(slide, Inches(1.0), Inches(5.33), Inches(11.3), Inches(1.1),
                [[("Metodologi jujur. ", 13, ESPRESSO, True),
                  ("Yang diuji manual benar-benar dijalankan di aplikasi hidup, bukan dari membaca kode. "
                   "Empat cacat ditemukan lewat cara itu — salah satunya pesan penolakan yang menyebut "
                   "\"hanya untuk admin\" padahal manager juga boleh masuk. Semua sudah diperbaiki.", 11.5, INK, False)]])
    footer(s, 15)


def s16_capaian():
    s = slide = slide_baru()
    header(s, "Lanjutan".upper(), "Capaian",
           "Yang sudah selesai dan siap dipakai.")
    item = [
        "Kasir lengkap: pilih pelanggan, diskon, tukar poin, nomor struk Majoo.",
        "Loyalitas penuh: poin otomatis, buku besar, arsip pelanggan.",
        "Pemasaran: campaign WhatsApp per segmen, plus analitik kedai.",
        "Tiga peran dengan izin terpisah dan penjaga anti-kunci-diri.",
        "Keamanan berlapis: Row Level Security, middleware, dan penjaga peran.",
        "Kualitas terjamin: 694 asersi otomatis + pengujian manual tiga peran.",
        "Panduan pengujian dan materi presentasi tersedia untuk serah terima.",
    ]
    y = Inches(2.2)
    for i, t in enumerate(item):
        lingkaran(slide, Inches(0.85), y + Inches(0.04), Inches(0.32), SAGE)
        tulis(slide, Inches(0.85), y + Inches(0.06), Inches(0.32), Inches(0.28),
              "✓", size=13, warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
        tulis(slide, Inches(1.35), y, Inches(11), Inches(0.4), t, size=13,
              warna=INK)
        y += Inches(0.62)
    footer(s, 16)


def s17_rencana():
    s = slide = slide_baru()
    header(s, "Lanjutan".upper(), "Rencana lanjutan",
           "Arah pengembangan setelah serah terima.")
    fases = [
        ("Segera", "Uji di iPad/HP kasir sungguhan (layar kecil belum diuji), "
         "tutup pendaftaran publik, dan isi data pelanggan awal.", GOLD),
        ("Dekat", "Notifikasi WhatsApp otomatis saat ulang tahun, laporan yang "
         "bisa diekspor, dan struk digital.", TERRA_MED),
        ("Nanti", "Aplikasi pelanggan untuk melihat saldo poin sendiri, "
         "pemesanan daring, dan integrasi pembayaran.", SAGE_DARK),
    ]
    x = Inches(0.7)
    cw = Inches(3.95)
    ch = Inches(3.3)
    for i, (t, d, warna) in enumerate(fases):
        xx = x + i * (cw + Inches(0.28))
        kotak(slide, xx, Inches(2.3), cw, ch, TAN, garis=TERRA_MED, tebal=1.0)
        kotak(slide, xx, Inches(2.3), cw, Inches(0.5), warna, rounded=False)
        tulis(slide, xx, Inches(2.36), cw, Inches(0.4), t, size=15,
              warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
        tulis(slide, xx + Inches(0.25), Inches(3.0), cw - Inches(0.5),
              ch - Inches(0.9), d, size=11.5, warna=INK, line_spacing=1.2)
    footer(s, 17)


def s18_penutup():
    s = slide = slide_baru()
    kotak(s, 0, 0, W, H, ESPRESSO, rounded=False)
    kotak(s, 0, 0, W, Inches(0.14), TERRACOTTA, rounded=False)
    lingkaran(s, Inches(6.17), Inches(1.7), Inches(1.0), TERRACOTTA)
    tulis(s, Inches(6.17), Inches(1.8), Inches(1.0), Inches(0.8), "K",
          size=42, warna=WHITE, bold=True, align=PP_ALIGN.CENTER,
          anchor=MSO_ANCHOR.MIDDLE)
    tulis(s, Inches(1.5), Inches(3.1), Inches(10.33), Inches(1.0),
          "Terima kasih", size=44, warna=WHITE, bold=True, align=PP_ALIGN.CENTER)
    tulis(s, Inches(1.5), Inches(4.25), Inches(10.33), Inches(0.6),
          "Siap dipakai, siap ditunjukkan ke pelanggan pertama.",
          size=16, warna=RGBColor(0xE6, 0xD8, 0xCE), align=PP_ALIGN.CENTER)
    tulis(s, Inches(1.5), Inches(5.6), Inches(10.33), Inches(0.5),
          "Kataloji CRM — Kasir · Loyalitas · Pemasaran", size=14, warna=GOLD,
          bold=True, align=PP_ALIGN.CENTER)
    footer(s, 18)


# ---------------------------------------------------------------- bangun ----
s1_sampul()
s2_agenda()
s3_masalah()
s4_solusi()
s5_arsitektur()
s6_alur_transaksi()
s7_aturan_poin()
s8_siklus_poin()
s9_pelanggan()
s10_pemasaran()
s11_analitik()
s12_peran()
s13_matriks()
s14_keamanan()
s15_kualitas()
s16_capaian()
s17_rencana()
s18_penutup()

OUT = "Kataloji-CRM-Presentasi.pptx"
prs.save(OUT)
print("SELESAI:", OUT, "| slide:", len(prs.slides._sldIdLst))

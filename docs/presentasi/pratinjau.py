#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pembuat pratinjau gambar dari berkas presentasi Kataloji CRM.

Alasannya ada: LibreOffice tidak terpasang di mesin ini, dan model penglihatan
yang tersedia selalu mengembalikan kutipan motivasi alih-alih deskripsi gambar.
Jadi pratinjau tidak bisa dibuat lewat konversi Office maupun diperiksa lewat
model. Berkas ini menggambar ulang isi slide dengan Pillow, langsung dari
bentuk dan teks yang tersimpan di dalam .pptx. Hasilnya untuk diperiksa mata
manusia, bukan untuk menggantikan PowerPoint.

Jalankan:  PYTHONPATH= python pratinjau.py
Menghasilkan: pratinjau-17-slide.png dan pratinjau/slide-NN.png
"""
import os
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PPTX = os.path.join(HERE, "Kataloji-CRM-Presentasi.pptx")
OUT_SHEET = os.path.join(HERE, "pratinjau-18-slide.png")
OUT_DIR = os.path.join(HERE, "pratinjau")

PX_PER_IN = 120
KOLOM = 3

REGULER = [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf",
           "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
TEBAL = [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]


def pilih_font(kandidat):
    for p in kandidat:
        if os.path.exists(p):
            return p
    return None


F_REG = pilih_font(REGULER)
F_BOLD = pilih_font(TEBAL) or F_REG
_cache = {}


def font(size, bold=False):
    key = (round(size, 1), bold)
    if key not in _cache:
        path = F_BOLD if bold else F_REG
        px = max(6, int(round(size * PX_PER_IN / 72.0)))
        _cache[key] = (ImageFont.truetype(path, px) if path
                       else ImageFont.load_default())
    return _cache[key]


def px(inches):
    return int(round(inches * PX_PER_IN))


def warna_rgb(fore):
    try:
        c = fore.rgb
        return (c[0], c[1], c[2])
    except Exception:
        return (200, 143, 123)


def bentuk(d, shp, skala=1.0):
    x, y = px(shp.left / 914400.0 * skala), px(shp.top / 914400.0 * skala)
    w, h = px(shp.width / 914400.0 * skala), px(shp.height / 914400.0 * skala)
    if w <= 0 or h <= 0:
        return
    try:
        if shp.fill.type is None:
            return
        warna = warna_rgb(shp.fill.fore_color)
    except Exception:
        return
    try:
        tipe = shp.auto_shape_type
    except Exception:
        tipe = None

    if tipe == MSO_SHAPE.ROUNDED_RECTANGLE:
        r = max(2, int(min(w, h) * 0.16))
        d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=warna)
    elif tipe == MSO_SHAPE.OVAL:
        d.ellipse([x, y, x + w, y + h], fill=warna)
    elif tipe == MSO_SHAPE.DIAMOND:
        d.polygon([(x + w // 2, y), (x + w, y + h // 2),
                   (x + w // 2, y + h), (x, y + h // 2)], fill=warna)
    elif tipe == MSO_SHAPE.DOWN_ARROW:
        bw = int(w * 0.5)
        bx = x + (w - bw) // 2
        by = y + int(h * 0.55)
        d.polygon([(x, y), (x + w, y), (x + w, by), (x + w, by),
                   (x + w, by), (x + w // 2, y + h), (x, by)], fill=warna)
        d.rectangle([bx, y, bx + bw, by], fill=warna)
    elif tipe == MSO_SHAPE.RIGHT_ARROW:
        bh = int(h * 0.5)
        by = y + (h - bh) // 2
        bx = x + int(w * 0.55)
        d.polygon([(x, by), (bx, by), (bx, y), (x + w, y + h // 2),
                   (bx, y + h), (bx, by + bh), (x, by + bh)], fill=warna)
    else:
        d.rectangle([x, y, x + w, y + h], fill=warna)


def teks_kotak(d, shp, skala=1.0):
    tf = shp.text_frame
    paragraf = [(p, [r for r in p.runs]) for p in tf.paragraphs]
    paragraf = [(p, rs) for p, rs in paragraf if p.text.strip()]
    if not paragraf:
        return
    x = px(shp.left / 914400.0 * skala)
    y = px(shp.top / 914400.0 * skala)
    w = px(shp.width / 914400.0 * skala)
    h = px(shp.height / 914400.0 * skala)

    baris_kumpul = []
    for p, runs in paragraf:
        size = runs[0].font.size.pt if runs[0].font.size else 18
        bold = bool(runs[0].font.bold)
        warna = warna_rgb(runs[0].font.color)
        f = font(size, bold)
        align = str(p.alignment)
        spasi = p.line_spacing if isinstance(p.line_spacing, float) else 1.0
        for potong in _bungkus(p.text, f, w):
            baris_kumpul.append((potong, f, warna, align, spasi, size))

    tinggi = sum(int(b[5] * PX_PER_IN / 72.0 * 1.25 * b[4]) for b in baris_kumpul)
    if "MIDDLE" in str(tf.vertical_anchor):
        cy = y + max(0, (h - tinggi) // 2)
    else:
        cy = y
    for (t, f, warna, align, spasi, size) in baris_kumpul:
        lw = d.textlength(t, font=f)
        if "CENTER" in align:
            cx = x + (w - lw) / 2
        elif "RIGHT" in align:
            cx = x + w - lw
        else:
            cx = x
        d.text((cx, cy), t, font=f, fill=warna)
        cy += int(size * PX_PER_IN / 72.0 * 1.25 * spasi)


def _bungkus(teks, f, w_maks):
    """Bungkus teks jadi daftar baris yang muat lebar w_maks."""
    if w_maks <= 4:
        return [teks]
    im = Image.new("RGB", (10, 10))
    d = ImageDraw.Draw(im)
    baris, acc = [], ""
    for kata in teks.split():
        coba = (acc + " " + kata).strip()
        if d.textlength(coba, font=f) <= w_maks or not acc:
            acc = coba
        else:
            baris.append(acc)
            acc = kata
    if acc:
        baris.append(acc)
    return baris


def render_slide(sl, skala=1.0):
    w = px(13.333 * skala)
    h = px(7.5 * skala)
    latar = (250, 245, 238)
    try:
        c = sl.background.fill.fore_color.rgb
        latar = (c[0], c[1], c[2])
    except Exception:
        pass
    img = Image.new("RGB", (w, h), latar)
    d = ImageDraw.Draw(img)
    for shp in sl.shapes:
        if shp.has_text_frame and not shp.text_frame.text.strip():
            if shp.shape_type is not None and "TEXT_BOX" not in str(shp.shape_type):
                bentuk(d, shp, skala)
            continue
        bentuk(d, shp, skala)
    # teks digambar terakhir supaya tidak tertutup bentuk
    for shp in sl.shapes:
        if shp.has_text_frame and shp.text_frame.text.strip():
            teks_kotak(d, shp, skala)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    prs = Presentation(PPTX)
    slides = [render_slide(sl, 1.0) for sl in prs.slides]
    for i, im in enumerate(slides, 1):
        im.save(os.path.join(OUT_DIR, f"slide-{i:02d}.png"))

    tw, th = slides[0].size
    sk = 0.34
    cw, chh = int(tw * sk), int(th * sk)
    baris = (len(slides) + KOLOM - 1) // KOLOM
    pad = 14
    sheet = Image.new("RGB",
                      (KOLOM * cw + (KOLOM + 1) * pad,
                       baris * chh + (baris + 1) * pad), (232, 224, 216))
    for i, im in enumerate(slides):
        c, r = i % KOLOM, i // KOLOM
        kecil = im.resize((cw, chh), Image.LANCZOS)
        sheet.paste(kecil, (pad + c * (cw + pad), pad + r * (chh + pad)))
    sheet.save(OUT_SHEET)
    print("SELESAI:", OUT_SHEET, sheet.size)
    print("per slide:", OUT_DIR)


if __name__ == "__main__":
    main()

"""Generate public/og-image.png (1200x630). Run: python3 scripts/og-image.py"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 1200, 630
BG, TEAL, FG, MUTED = (17, 17, 17), (0, 212, 200), (245, 245, 245), (160, 160, 160)
FONT = "/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf"
def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([14 if size < 40 else 32, weight])
    except Exception: pass
    return f
img = Image.new("RGB", (W, H), BG)
glow = Image.new("RGB", (W, H), BG)
ImageDraw.Draw(glow).ellipse((250, -380, 950, 260), fill=(0, 90, 85))
img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(140)), 0.9)
d = ImageDraw.Draw(img)
d.text((80, 80), "Valu", font=font(64, 800), fill=FG)
d.text((80 + d.textlength("Valu", font=font(64, 800)), 80), "8", font=font(64, 800), fill=TEAL)
d.text((80, 220), "Know what your car", font=font(76, 700), fill=FG)
d.text((80, 310), "is really worth", font=font(76, 700), fill=FG)
d.text((80, 430), "Live UK market data · DVSA MOT history · AI photo check", font=font(30, 400), fill=MUTED)
# UK number plate motif
px, py = 80, 500
d.rounded_rectangle((px, py, px + 360, py + 80), 12, fill=(255, 214, 0))
d.rounded_rectangle((px, py, px + 44, py + 80), 12, fill=(0, 51, 153))
d.rectangle((px + 30, py, px + 44, py + 80), fill=(0, 51, 153))
d.text((px + 9, py + 46), "GB", font=font(20, 700), fill=(255, 255, 255))
d.text((px + 70, py + 14), "VALU 8ED", font=font(46, 800), fill=(0, 0, 0))
img.save("public/og-image.png", optimize=True)
print("wrote public/og-image.png")

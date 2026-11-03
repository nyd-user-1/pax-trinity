# A play badge drawn onto each guide's poster for the mail, at the bottom right as the docs' cards wear it, clear of
# the title card's words: <name>.play.jpg beside <name>.jpg.
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
for n in sys.argv[2:]:
    im = Image.open(f"{d}/{n}.jpg").convert("RGBA")
    W, H = im.size
    r, margin = int(H * 0.07), int(H * 0.04)
    cx, cy = W - margin - r, H - margin - r
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    dr.ellipse((cx - r - 5, cy - r - 5, cx + r + 5, cy + r + 5), fill=(15, 23, 42, 36))
    dr.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 242))
    t = r * 0.5
    dr.polygon([(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t * 0.95, cy)], fill=(30, 58, 138, 255))
    Image.alpha_composite(im, layer).convert("RGB").save(f"{d}/{n}.play.jpg", quality=88, optimize=True)
    print("ok", n)

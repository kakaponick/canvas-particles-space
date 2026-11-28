"""Cuts a galaxy out of a photograph on black: an ellipse round its disc (centre, half axes and turn given in
shares of the picture), its light as the alpha, the colour kept, the square cropped round the ellipse and
shrunk to `size` pixels. Prints the share of the output's width the ellipse's major axis spans."""
import math
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
cx, cy, ra, rb, turn, size = (float(v) for v in sys.argv[3:9])
img = Image.open(src).convert('RGB')
w, h = img.size
# A square round the ellipse with a margin, in the picture's pixels
half = max(ra, rb) * 1.08 * w
box = (int(cx * w - half), int(cy * h - half), int(cx * w + half), int(cy * h + half))
crop = img.crop(box).resize((int(size), int(size)), Image.LANCZOS)
n = crop.size[0]
px = crop.load()
outImg = Image.new('RGBA', (n, n))
op = outImg.load()
c, s = math.cos(math.radians(turn)), math.sin(math.radians(turn))
scale = n / (2 * half)
A, B = ra * w * scale, rb * w * scale
for y in range(n):
    for x in range(n):
        dx, dy = x - n / 2, y - n / 2
        u = (dx * c + dy * s) / A
        v = (-dx * s + dy * c) / B
        e = math.sqrt(u * u + v * v)
        # Soft edge from 0.85 to 1.05 of the ellipse
        mask = min(max((1.05 - e) / 0.2, 0.0), 1.0)
        r, g, b = px[x, y]
        light = max(r, g, b) / 255.0
        alpha = min(light * 1.6, 1.0) ** 0.9 * mask
        if alpha <= 0.002:
            op[x, y] = (0, 0, 0, 0)
            continue
        k = 1.0 / max(light, 1e-3)
        op[x, y] = (min(int(r * k), 255), min(int(g * k), 255), min(int(b * k), 255), int(alpha * 255))
outImg.save(out, optimize=True)
print('major axis share of width:', round(2 * A / n, 4))

"""Hand lettering for films/last_parsec.js.

The scene's caption faces are all set type, and the film's notes are a draughtsman's, written by hand on the
drawing. So each note is drawn here, letter by letter, in a marker hand (Ink Free, with Segoe Print and Segoe
UI Symbol for the signs it lacks), every letter a little off its line, its size and its angle, and the film
lays the pictures over the scene as images. The same text draws the same picture: the jitter is seeded by it.

    python films/last_parsec_letters.py

writes films/last_parsec/<name>.png and films/last_parsec/letters.json, the width of each in shares of a
1080p frame's short side, which the film reads. Text marks: ^{..} raised, _{..} lowered, a newline breaks.
Needs Pillow and fontTools, and the Windows fonts named below.
"""
import hashlib
import json
import math
import os
import random

from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'last_parsec')
FONTS = ['C:/Windows/Fonts/Inkfree.ttf', 'C:/Windows/Fonts/segoepr.ttf', 'C:/Windows/Fonts/seguisym.ttf']
# Drawn at twice the size it is seen at in a 1080p frame, so that a 4K render is still sharp
SCALE = 2
SHORT = 1080

NOTES = {
    'title': ('ПОСЛЕДНИЙ ПАРСЕК', 64),
    'merged': ('Две галактики слились.\nИх чёрные дыры осели в общий центр', 40),
    'heavy': ('10^{9} масс Солнца', 32),
    'light': ('7·10^{8} масс Солнца', 32),
    'stars': ('вокруг — звёзды старых ядер', 34),
    'pass': ('звезда проходит между ними\nи вылетает быстрее, чем пришла', 36),
    'takes': ('скорость она берёт у орбиты —\nпара сходится', 36),
    'shrinks': ('a ↓', 40),
    'empty': ('Таких звёзд больше нет', 40),
    'stall': ('≈ 1 пк', 40),
    'period': ('один оборот ≈ 2300 лет', 30),
    'waves': ('одни гравитационные волны\nсвели бы их за ≈ 5·10^{11} лет', 36),
    'age': ('в 35 раз дольше,\nчем живёт Вселенная', 36),
    'hum': ('2023: в тиканье пульсаров нашли общий гул —\nскорее всего, от таких пар', 34),
    'through': ('значит, последний парсек\nони как-то проходят', 38),
    'how': ('как — пока спорят', 40),
}

INK = (214, 232, 255)


def faces():
    return [(path, set(TTFont(path).getBestCmap())) for path in FONTS]


def runs(text):
    """Split the text into (character, raise) pairs: 0 on the line, 1 raised, -1 lowered."""
    out = []
    index = 0
    while index < len(text):
        if text[index] in '^_' and text[index + 1:index + 2] == '{':
            end = text.index('}', index)
            level = 1 if text[index] == '^' else -1
            out.extend((char, level) for char in text[index + 2:end])
            index = end + 1
        else:
            out.append((text[index], 0))
            index += 1
    return out


def letter(char, size, pad, fonts, rng):
    """One letter on a tile with its baseline's start at (pad, pad), turned a little about it."""
    path = next((path for path, cmap in fonts if ord(char) in cmap), FONTS[0])
    font = ImageFont.truetype(path, size)
    advance = font.getlength(char)
    if char == ' ':
        return None, advance
    tile = Image.new('L', (int(advance) + 2 * pad, 2 * pad), 0)
    ImageDraw.Draw(tile).text((pad, pad), char, font=font, fill=255, anchor='ls')
    tile = tile.rotate(rng.uniform(-4, 4), resample=Image.BICUBIC, center=(pad + advance / 2, pad))
    return tile, advance


def draw(name, text, size):
    rng = random.Random(hashlib.sha1(text.encode()).hexdigest())
    fonts = faces()
    size *= SCALE
    pad = size
    lines = text.split('\n')
    placed = []
    y = 2 * pad
    for row, line in enumerate(lines):
        x = pad + rng.uniform(0, 0.25) * size * (row > 0)
        slope = math.radians(rng.uniform(-0.8, 0.8))
        start = x
        for char, level in runs(line):
            grow = rng.uniform(0.94, 1.06) * (0.62 if level else 1)
            tile, advance = letter(char, max(8, round(size * grow)), pad, fonts, rng)
            lift = -0.36 * size if level > 0 else 0.14 * size if level < 0 else 0
            drop = rng.uniform(-0.035, 0.035) * size + lift + (x - start) * math.tan(slope)
            if tile is not None:
                placed.append((tile, x, y + drop, rng.uniform(0.82, 1)))
            x += advance + rng.uniform(-0.015, 0.025) * size
        y += size * 1.35
    width = int(max(px + tile.width for tile, px, _, _ in placed) + pad)
    height = int(y + pad)
    sheet = Image.new('RGBA', (width, height), INK + (0,))
    alpha = Image.new('L', (width, height), 0)
    for tile, px, py, strength in placed:
        shade = tile.point(lambda value: int(value * strength))
        box = (int(px - pad), int(py - pad))
        region = alpha.crop((box[0], box[1], box[0] + tile.width, box[1] + tile.height))
        alpha.paste(ImageChops.lighter(region, shade), box)
    sheet.putalpha(alpha)
    box = alpha.getbbox()
    margin = size // 4
    sheet = sheet.crop((box[0] - margin, box[1] - margin, box[2] + margin, box[3] + margin))
    sheet.save(os.path.join(OUT, name + '.png'), optimize=True)
    return round(sheet.width / SCALE / SHORT, 4)


def main():
    os.makedirs(OUT, exist_ok=True)
    widths = {name: draw(name, text, size) for name, (text, size) in NOTES.items()}
    with open(os.path.join(OUT, 'letters.json'), 'w', encoding='utf-8') as file:
        json.dump(widths, file, ensure_ascii=False, indent=2)
        file.write('\n')
    print(json.dumps(widths, ensure_ascii=False))


if __name__ == '__main__':
    main()

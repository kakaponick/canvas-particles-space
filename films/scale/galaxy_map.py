"""The nearby universe on the supergalactic plane, from real catalogues: the Updated Nearby Galaxy Catalog
(Karachentsev+ 2013, measured distances, to 9 Mpc) and the 2MASS Redshift Survey (Huchra+ 2012, distance
cz / 70 beyond it). The big clusters' fingers of god are pulled back to their clusters, the strip the Milky
Way's disc hides (the zone of avoidance) is filled with clones of the strips beside it, as maps made from 2MRS
do. Each level is a square N pixels across, E Mpc from its middle (us) to its edge, rotated so a place stands
at the film's map angle SG_ANGLE + SGL, every galaxy a soft dot that also carries the light the survey
misses at its distance.

The catalogues come from VizieR (J/AJ/145/101/catalog: Name, RAJ2000, DEJ2000, Dist, KLum, a26 as TSV;
J/ApJS/199/26/table3: GLON, GLAT, Ktmag, cz, CAT).

usage: python films/scale/galaxy_map.py <ungc.tsv> <2mrs.tsv> films/scale"""
import math
import random
import sys
from PIL import Image

ungc_path, mrs_path, out = sys.argv[1:4]
SG_ANGLE = 47.1
H0 = 70.0
N = 2048
LEVELS = [(0.5, 1.0, 14.0), (2, 2.0, 14.0), (8, 5.0, 12.0), (32, 10.0, 10.0), (128, 15.0, 3.5), (512, 25.0, 2.5)]  # E, half thickness Mpc, gain
SKIP = {'MESSIER031', 'MESSIER033', 'LMC', 'SMC', 'Milky Way'}
random.seed(7)
r = math.radians


def unit(l, b):
    return (math.cos(r(b)) * math.cos(r(l)), math.cos(r(b)) * math.sin(r(l)), math.sin(r(b)))


def dot(a, b):
    return sum(p * q for p, q in zip(a, b))


Z = unit(47.37, 6.32)
X = unit(137.37, 0)
X = [x - dot(X, Z) * z for x, z in zip(X, Z)]
n = math.sqrt(dot(X, X))
X = [x / n for x in X]
Y = (Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0])
EQ_TO_GAL = ((-0.0548755604, -0.8734370902, -0.4838350155),
             (0.4941094279, -0.4448296300, 0.7469822445),
             (-0.8676661490, -0.1980763734, 0.4559837762))


def galactic_of(ra, de):
    e = (math.cos(r(de)) * math.cos(r(ra)), math.cos(r(de)) * math.sin(r(ra)), math.sin(r(de)))
    g = [dot(row, e) for row in EQ_TO_GAL]
    return math.degrees(math.atan2(g[1], g[0])) % 360, math.degrees(math.asin(max(-1, min(1, g[2]))))


def rows(path):
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('#') or not line.strip():
            continue
        cells = line.rstrip('\n').split('\t')
        if cells[0].strip() in ('Name', 'GLON') or cells[0].startswith('-') or cells[0].strip() == '':
            continue
        yield cells


galaxies = []  # (l, b, distance Mpc, weight)
for c in rows(ungc_path):
    name = c[0].strip()
    if name in SKIP:
        continue
    try:
        h, m, s = (float(v) for v in c[1].split())
        sign = -1 if c[2].strip().startswith('-') else 1
        d, dm, ds = (abs(float(v)) for v in c[2].split())
        dist = float(c[3])
    except ValueError:
        continue
    if dist > 9:
        continue
    lum = float(c[4]) if c[4].strip() else 6.5
    l, b = galactic_of(15 * (h + m / 60 + s / 3600), sign * (d + dm / 60 + ds / 3600))
    galaxies.append((l, b, dist, min(max(10 ** (0.3 * (lum - 10)), 0.6), 2.0), 1.0))
print('UNGC', len(galaxies))

# clusters: galactic l, b, mean cz, radius in degrees on the sky, velocity spread, physical radius Mpc
CLUSTERS = [(283.78, 74.49, 1100, 6.0, 700, 1.6), (236.7, -53.6, 1379, 4.0, 380, 0.7), (58.1, 87.96, 6925, 2.5, 1000, 1.8),
            (150.57, -13.26, 5366, 2.5, 1300, 1.8), (302.4, 21.6, 3400, 3.0, 1000, 1.4), (325.3, -7.3, 4844, 2.0, 950, 1.4),
            (269.6, 26.5, 3777, 2.5, 700, 1.2)]
cl_units = [(unit(l, b), cz, math.cos(r(rad)), sv, rp) for l, b, cz, rad, sv, rp in CLUSTERS]
mrs = []
for c in rows(mrs_path):
    try:
        l, b, k, cz = float(c[0]), float(c[1]), float(c[2]), float(c[3])
    except ValueError:
        continue
    u = unit(l, b)
    dist = None
    for cu, ccz, cosr, sv, rp in cl_units:
        if dot(u, cu) > cosr and abs(cz - ccz) < 2.5 * sv:
            dist = ccz / H0 + random.gauss(0, rp / 1.5)
            break
    if dist is None:
        dist = cz / H0
    if dist < 9:
        continue
    absk = k - 5 * math.log10(dist * 1e5)
    weight = min(max(10 ** (-0.4 * (absk + 23.5) * 0.3), 0.4), 2.0)
    mrs.append((l, b, dist, weight))
print('2MRS', len(mrs))
# The survey keeps only galaxies brighter than K = 11.75, so it thins with distance and a map of it puts us at
# the middle of a ball. Each galaxy stands for the light too faint to be seen beside it: of a Schechter
# luminosity function (M* = -23.55 in K, alpha = -1) a survey sees the share exp(-Lmin / L*) of the light, so a
# galaxy's light is multiplied by how much less is seen at its distance than at 20 Mpc, and spread wider
def seen(dist):
    return 10 ** (-0.4 * (11.75 - 5 * math.log10(dist * 1e5) + 23.55))
def thinning(dist):
    return min(math.exp(seen(dist) - seen(20.0)), 6.0)
for d in (20, 50, 100, 150, 200):
    print('at', d, 'Mpc: x', round(thinning(d), 2))
mrs = [(l, b, dist, w, thinning(dist)) for l, b, dist, w in mrs]
# the zone of avoidance: 2MRS has |b| >= 5 deg, 8 deg toward the bulge; the strips as wide beside it are cloned in
clones = []
for l, b, dist, w, sel in mrs:
    lim = 8 if (l < 30 or l > 330) else 5
    if lim <= abs(b) < 2 * lim:
        clones.append((l, b - math.copysign(lim, b), dist * (1 + random.uniform(-0.02, 0.02)), w, sel))
print('clones', len(clones))
everything = galaxies + mrs + clones

placed = []
# Past the survey's reach the map fades out, from 150 to 230 Mpc: the film's cosmic web goes on from there
REACH_IN, REACH_OUT = 150.0, 230.0
def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)
for l, b, dist, w, sel in everything:
    p = unit(l, b)
    sx, sy, sz = dist * dot(p, X), dist * dot(p, Y), dist * dot(p, Z)
    ca, sa = math.cos(r(SG_ANGLE)), math.sin(r(SG_ANGLE))
    fade = 1 - smooth((math.hypot(sx, sy) - REACH_IN) / (REACH_OUT - REACH_IN))
    if fade > 0:
        placed.append((sx * ca - sy * sa, sx * sa + sy * ca, sz, w * sel * fade, sel))

for E, half, gain in LEVELS:
    scale = 2 * E / N  # Mpc a pixel
    buf = [0.0] * (N * N)
    count = 0
    for x, y, z, w, sel in placed:
        if abs(z) > half or abs(x) >= E or abs(y) >= E:
            continue
        count += 1
        px = N / 2 + x / scale
        py = N / 2 - y / scale
        sigma = min(max(0.8, 0.012 / scale) * math.sqrt(sel), 4.0)
        reach = int(math.ceil(2.5 * sigma))
        flux = w / (2 * math.pi * sigma * sigma)
        cx, cy = int(px), int(py)
        for yy in range(max(cy - reach, 0), min(cy + reach + 1, N)):
            dy = yy + 0.5 - py
            for xx in range(max(cx - reach, 0), min(cx + reach + 1, N)):
                dx = xx + 0.5 - px
                buf[yy * N + xx] += flux * math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    # light as alpha, the colour of an old stellar population
    img = Image.new('RGBA', (N, N))
    data = bytearray(N * N * 4)
    for i, v in enumerate(buf):
        if v <= 0:
            continue
        a = 1 - math.exp(-v * gain)
        data[4 * i] = 255
        data[4 * i + 1] = 236
        data[4 * i + 2] = 214
        data[4 * i + 3] = min(int(a * 255 + 0.5), 255)
    img.frombytes(bytes(data))
    name = f'{out}/map_{E:g}.png'
    img.save(name, optimize=True)
    print(name, count, 'galaxies')

"""
Builds public/models/sandhacks/hardware.glb from the four Parasolid mesh files in `3d models/san d hacks /`.

What this is, and is not (so it can be checked):
  ORIGINAL  Every triangle comes from the supplied files, unchanged apart from a rigid move to lay the parts out and
            a winding flip on the two parts whose triangles faced inward. Colours are the display colours stored in
            each file's colour attribute (a CAD colour, not necessarily the print colour).
  LAID OUT  The parts are shown side by side, long axis along X, resting flat. This is NOT an assembly: the files carry
            no mates, and how the four parts fit together was not recoverable from them (see README note below).
  NOT MODELLED  Servos, screws, bearings and the phone: none were supplied.

Run:  python3 cad/sandhacks/build.py     (standard library only)
"""
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
from psm_mesh import load, outward, verify  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, '3d models', 'san d hacks ')
OUT = os.path.join(ROOT, 'public', 'models', 'sandhacks')

# order = order down the page; colour = the file's own colour attribute
PARTS = [
    ('arm_root_print', 'Arm root', (0.647058823529412, 0.647058823529412, 0.647058823529412), True),
    ('arm_tip_print', 'Arm tip', (0.972549019607843, 0.529411764705882, 0.00392156862745098), True),
    ('upper_jaw_print', 'Upper jaw', (0.768627450980392, 0.886274509803922, 0.952941176470588), True),
    ('phone_cradle_print', 'Phone cradle', (0.917647058823529, 0.917647058823529, 0.917647058823529), False),
]
GAP = 16.0           # mm between parts
CREASE = math.radians(38)


def principal_angle(pts):
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    syy = sum((p[1] - my) ** 2 for p in pts)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    return 0.5 * math.atan2(2 * sxy, sxx - syy)


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def smooth(points, faces):
    """Per-corner normals: average the adjacent faces that lie within the crease angle."""
    fn = []
    for a, b, c in faces:
        n = cross(sub(points[b], points[a]), sub(points[c], points[a]))   # length = 2 * area
        fn.append(n)
    adj = [[] for _ in points]
    for i, (a, b, c) in enumerate(faces):
        for v in (a, b, c):
            adj[v].append(i)
    cos_c = math.cos(CREASE)
    pos, nor, idx = [], [], []
    cache = {}
    for i, f in enumerate(faces):
        ni = norm(fn[i])
        for v in f:
            acc = [0.0, 0.0, 0.0]
            for j in adj[v]:
                nj = norm(fn[j])
                if dot(ni, nj) >= cos_c:
                    acc[0] += fn[j][0]; acc[1] += fn[j][1]; acc[2] += fn[j][2]
            n = norm(tuple(acc))
            key = (v, round(n[0], 3), round(n[1], 3), round(n[2], 3))
            if key not in cache:
                cache[key] = len(pos)
                pos.append(points[v])
                nor.append(n)
            idx.append(cache[key])
    return pos, nor, idx


def main():
    laid = []
    report = {}
    for name, label, colour, rotate in PARTS:
        pts, faces = load(os.path.join(SRC, name, name + '.xmm_txt'))
        pts = [(x * 1000, y * 1000, z * 1000) for x, y, z in pts]            # metres -> mm
        report[name] = verify([(p[0] / 1000, p[1] / 1000, p[2] / 1000) for p in pts], faces)
        faces = outward([(p[0] / 1000, p[1] / 1000, p[2] / 1000) for p in pts], faces)
        if rotate:
            t = -principal_angle(pts)
            ct, st = math.cos(t), math.sin(t)
            pts = [(p[0] * ct - p[1] * st, p[0] * st + p[1] * ct, p[2]) for p in pts]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        pts = [(p[0] - cx, p[1] - cy, p[2] - min(zs)) for p in pts]
        laid.append(dict(name=name, label=label, colour=colour, pts=pts, faces=faces, w=w, h=h, d=max(zs) - min(zs)))
        report[name].update(size_mm=[round(w, 1), round(h, 1), round(max(zs) - min(zs), 1)])

    total = sum(p['h'] for p in laid) + GAP * (len(laid) - 1)
    y = total / 2
    for p in laid:
        y -= p['h'] / 2
        p['pts'] = [(a, b + y, c) for a, b, c in p['pts']]
        y -= p['h'] / 2 + GAP

    # ---- glTF (Y up: x -> x, z -> y, -y -> z; mm -> m)
    bin_chunks, views, accessors, meshes, nodes, materials = bytearray(), [], [], [], [], []

    def add_view(data, target):
        while len(bin_chunks) % 4:
            bin_chunks.append(0)
        views.append(dict(buffer=0, byteOffset=len(bin_chunks), byteLength=len(data), target=target))
        bin_chunks.extend(data)
        return len(views) - 1

    for k, p in enumerate(laid):
        pos, nor, idx = smooth(p['pts'], p['faces'])
        g = lambda v: (v[0] * 0.001, v[2] * 0.001, -v[1] * 0.001)
        gp = [g(v) for v in pos]
        gn = [g(v) for v in nor]
        pb = b''.join(struct.pack('<3f', *v) for v in gp)
        nb = b''.join(struct.pack('<3f', *v) for v in gn)
        ib = b''.join(struct.pack('<I', i) for i in idx)
        mn = [min(v[i] for v in gp) for i in range(3)]
        mx = [max(v[i] for v in gp) for i in range(3)]
        a0 = len(accessors)
        accessors.append(dict(bufferView=add_view(pb, 34962), componentType=5126, count=len(gp), type='VEC3', min=mn, max=mx))
        accessors.append(dict(bufferView=add_view(nb, 34962), componentType=5126, count=len(gn), type='VEC3'))
        accessors.append(dict(bufferView=add_view(ib, 34963), componentType=5125, count=len(idx), type='SCALAR'))
        materials.append(dict(name=p['label'], pbrMetallicRoughness=dict(baseColorFactor=[*p['colour'], 1], metallicFactor=0.0, roughnessFactor=0.55)))
        meshes.append(dict(name=p['label'], primitives=[dict(attributes=dict(POSITION=a0, NORMAL=a0 + 1), indices=a0 + 2, material=k)]))
        nodes.append(dict(name=p['name'], mesh=k, extras=dict(label=p['label'], size_mm=report[p['name']]['size_mm'])))

    doc = dict(
        asset=dict(version='2.0', generator='cad/sandhacks/build.py'),
        scene=0, scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes, materials=materials,
        accessors=accessors, bufferViews=views, buffers=[dict(byteLength=len(bin_chunks))],
    )
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    bn = bytes(bin_chunks) + b'\0' * (-len(bin_chunks) % 4)
    glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bn), b'BIN\0') + bn
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'hardware.glb'), 'wb') as f:
        f.write(glb)
    with open(os.path.join(OUT, 'validation.json'), 'w') as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=1))
    print('wrote hardware.glb', len(glb), 'bytes; layout', round(max(p['w'] for p in laid)), 'x', round(total), 'mm')


if __name__ == '__main__':
    main()

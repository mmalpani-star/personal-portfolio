"""Earth textures for the CubeSat scene (public/textures/earth).

Source: the "Solar System Scope" Earth maps as shipped with the three.js examples (r170), licence
CC BY 4.0 (https://www.solarsystemscope.com/textures/). Resized for the web; the cloud layer is the blue
channel of `earth_bump_roughness_clouds_4096.jpg`, stored as a greyscale JPEG used as an alpha map.
Run from the repository root:  python cad/cubesat/earth_textures.py
"""
import io
import os
import urllib.request

import numpy as np
from PIL import Image

BASE = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "textures", "earth")
os.makedirs(OUT, exist_ok=True)


def fetch(name):
    with urllib.request.urlopen(BASE + name, timeout=60) as r:
        return Image.open(io.BytesIO(r.read()))


day = fetch("earth_day_4096.jpg").convert("RGB")
for w, q in ((2048, 80), (1024, 82)):
    day.resize((w, w // 2), Image.LANCZOS).save(os.path.join(OUT, f"earth-day-{w}.jpg"), quality=q, optimize=True, progressive=True)
clouds = np.array(fetch("earth_bump_roughness_clouds_4096.jpg").convert("RGB").resize((1024, 512), Image.LANCZOS))[:, :, 2]
Image.fromarray(clouds).save(os.path.join(OUT, "earth-clouds-1024.jpg"), quality=72, optimize=True, progressive=True)
with open(os.path.join(OUT, "CREDITS.txt"), "w") as f:
    f.write("Earth textures: Solar System Scope (https://www.solarsystemscope.com/textures/), CC BY 4.0,\n"
            "as distributed with the three.js examples (r170), resized and channel-split by cad/cubesat/earth_textures.py.\n")
for n in sorted(os.listdir(OUT)):
    print(n, os.path.getsize(os.path.join(OUT, n)))

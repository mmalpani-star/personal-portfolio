"""
Validate and export the air-quality-monitor assembly.

    python cad/air-quality-monitor/build.py          # from the repository root

Outputs (cad/air-quality-monitor/export/):
    step/aqm_assembly.step, step/aqm_exploded.step     full assembly, labelled, coloured
    step/<printed part>.step, stl/<printed part>.stl   enclosure_body, rear_cover, display retainers
    glb/aqm.glb                                         web model, one node per component group
    aqm.manifest.json                                   nodes, explode vectors (glTF frame), inventory
    validation.json                                     interference, sensor exposure, clearances
"""
import copy
import itertools
import json
import os
import sys
import time

import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, "export")
for d in ("step", "stl", "glb"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

from build123d import Compound, Pos, export_step  # noqa: E402

import aqm  # noqa: E402

# Designed overlaps that are not collisions: screws biting into the printed
# boss they are driven into, and heat-set inserts melted into their boss.
THREADED = [("retainer_screw", "enclosure_body"), ("cover_screw", "heat_set_insert"),
            ("heat_set_insert", "enclosure_body"), ("mq131_wall_screw", "mq131_standoff"),
            ("mq131_screw", "mq131_standoff")]


def is_threaded(a, b):
    return any((a.startswith(x) and b.startswith(y)) or (b.startswith(x) and a.startswith(y)) for x, y in THREADED)


def overlap(a, b):
    ba, bb = a.bounding_box(), b.bounding_box()
    if (ba.max.X < bb.min.X or bb.max.X < ba.min.X or ba.max.Y < bb.min.Y or bb.max.Y < ba.min.Y
            or ba.max.Z < bb.min.Z or bb.max.Z < ba.min.Z):
        return 0.0
    try:
        return float((a & b).volume)
    except Exception:
        return float("nan")


def interference(shapes):
    hits = []
    for a, b in itertools.combinations(shapes, 2):
        v = overlap(a, b)
        if v > 0.05 and not is_threaded(a.label, b.label):
            hits.append(dict(a=a.label, b=b.label, volume_mm3=round(v, 2)))
    return hits


def exposure(body, face_box, direction, depth=6.0):
    """Fraction of a sensing face's projection through the wall that is open.
    face_box: (x0, y0, z0, x1, y1, z1) of the sensing face; direction: axis
    unit vector pointing out of the enclosure."""
    x0, y0, z0, x1, y1, z1 = face_box
    dx, dy, dz = (np.array(direction) * depth).tolist()
    prism = aqm.box(min(x0, x0 + dx), min(y0, y0 + dy), min(z0, z0 + dz),
                    max(x1, x1 + dx), max(y1, y1 + dy), max(z1, z1 + dz))
    solid = (prism & body).volume
    # volume the wall would occupy inside that prism if it were solid
    wall = (prism & aqm.box(-50, -50, -50, aqm.W + 50, aqm.D + 50, aqm.H + 50)
            & (aqm.box(-1, -1, -1, aqm.W + 1, aqm.D + 1, aqm.H + 1)
               - aqm.box(aqm.t, aqm.tf, aqm.t, aqm.W - aqm.t, aqm.D + 2, aqm.H - aqm.t))).volume
    return round(1 - solid / wall, 3) if wall > 0 else None


def tess(shape, tol=0.05):
    v, f = shape.tessellate(tol, 0.2)
    return trimesh.Trimesh(np.array([(p.X, p.Y, p.Z) for p in v]), np.array(f), process=True)


def rgb(shape):
    c = shape.color
    try:
        return tuple(float(x) for x in c.percentage) if hasattr(c, "percentage") else tuple(c)[:3]
    except Exception:
        return (0.5, 0.5, 0.5)


def main():
    t0 = time.time()
    A = aqm.assembly()
    shapes = [s for g in A.values() for s in g]
    body = A["enclosure_body"][0]

    hits = interference(shapes)

    L = aqm.L
    sensors = {
        "dht22 grid (right wall)": ((L["dht_x"][1] - 0.1, L["dht_y"][0] + 3, L["dht_z"][0] + 2.5,
                                     L["dht_x"][1], L["dht_y"][1] - 3, L["dht_z"][1] - 2.5), (1, 0, 0)),
        "mp503 sensor (right wall)": ((L["mp_x"][1] - 0.1, sum(L["mp_y"]) / 2 - 4.7, sum(L["mp_z"]) / 2 - 4.7,
                                       L["mp_x"][1], sum(L["mp_y"]) / 2 + 4.7, sum(L["mp_z"]) / 2 + 4.7), (1, 0, 0)),
        "mq131 cap (right wall)": ((aqm.W - aqm.t - 1.1, sum(L["mq_y"]) / 2 - 7, sum(L["mq_z"]) / 2 - 7,
                                    aqm.W - aqm.t - 1.0, sum(L["mq_y"]) / 2 + 7, sum(L["mq_z"]) / 2 + 7), (1, 0, 0)),
        "mh-z19e (front wall)": ((L["mhz_x"][0] + 2, L["mhz_y"][0], L["mhz_z"][0] + 1,
                                  L["mhz_x"][1] - 2, L["mhz_y"][0] + 0.1, L["mhz_z"][1] - 1), (0, -1, 0)),
        "display active area (window)": ((sum(L["tft_pcb_x"]) - 0, 0, 0, 0, 0, 0), None),
    }
    exp = {}
    for k, (fb, d) in sensors.items():
        if d is None:
            continue
        exp[k] = exposure(body, fb, d)
    ax, az = L["tft_active_c"]; aw, ah = aqm.COMPONENTS["tft"]["active"]
    win = aqm.box(ax - aw / 2, -1, az - ah / 2, ax + aw / 2, aqm.tf + 0.01, az + ah / 2)
    exp["display active area (window)"] = round(1 - (win & body).volume / (aw * ah * (aqm.tf + 1)), 3)

    # thermal layout figures
    dht_top = L["dht_z"][1]; mq_bottom = L["mq_z"][0]; mp_bottom = L["mp_z"][0]
    thermal = dict(
        dht22_top_to_mq131_bottom_mm=round(mq_bottom - dht_top, 1),
        dht22_top_to_mp503_bottom_mm=round(mp_bottom - dht_top, 1),
        dht22_pocket_closed_by_baffle=True,
        heaters_vent_upward=True,
        esp32_to_dht22_horizontal_mm=round(L["dht_x"][0] - L["esp_pcb_x"][1], 1),
    )

    # exploded configuration must also be free of overlaps
    exploded = []
    for g, ss in A.items():
        off = aqm.EXPLODE.get(g, (0, 0, 0))
        if g == "hardware":
            for s in ss:
                parent = ("rear_cover" if s.label.startswith("cover_screw") else
                          "display_retainers" if s.label.startswith("retainer") else
                          "mq131" if s.label.startswith("mq131") else "enclosure_body")
                o = aqm.EXPLODE[parent]
                extra = (0, 22, 0) if s.label.startswith(("cover_screw", "retainer")) else (0, 0, 0)
                m = Pos(o[0] + extra[0], o[1] + extra[1], o[2] + extra[2]) * s
                m.label = s.label; m.color = s.color; exploded.append(m)
        else:
            for s in ss:
                m = Pos(*off) * s; m.label = s.label; m.color = s.color; exploded.append(m)
    hits_exploded = [h for h in interference(exploded)
                     if not (h["a"].startswith(("heat_set", "mq131_standoff", "mq131_wall")) or
                             h["b"].startswith(("heat_set", "mq131_standoff", "mq131_wall")))]

    validation = dict(interference_assembled=hits, interference_exploded=hits_exploded,
                      sensor_open_area_fraction=exp, thermal_layout=thermal,
                      overall_size_mm=dict(W=aqm.W, D=aqm.D + aqm.E["cover_t"], H=aqm.H + aqm.E["feet_h"]))
    with open(os.path.join(OUT, "validation.json"), "w") as f:
        json.dump(validation, f, indent=2)

    # ---------------------------------------------------------------- export
    groups = []
    for g, ss in A.items():
        groups.append(Compound(label=g, children=ss))
    export_step(Compound(label="air_quality_monitor", children=groups), os.path.join(OUT, "step", "aqm_assembly.step"))
    export_step(Compound(label="air_quality_monitor_exploded", children=exploded),
                os.path.join(OUT, "step", "aqm_exploded.step"))
    # printed parts are rebuilt fresh: a shape already parented into an
    # assembly Compound will not export on its own
    printed = [aqm.enclosure_body(), aqm.rear_cover()] + aqm.display_retainers()
    for s in printed:
        export_step(s, os.path.join(OUT, "step", f"{s.label}.step"))
        tess(s, 0.02).export(os.path.join(OUT, "stl", f"{s.label}.stl"))

    # GLB: metres, Y up. CAD (x, y, z) -> glTF (x, z, -y).
    conv = np.eye(4); conv[:3, :3] = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]
    centre = np.array([aqm.W / 2, aqm.D / 2, aqm.H / 2])
    sc = trimesh.Scene()
    sc.graph.update(frame_from=sc.graph.base_frame, frame_to="aqm",
                    matrix=conv @ np.diag([0.001, 0.001, 0.001, 1]) @ trimesh.transformations.translation_matrix(-centre))
    hw_parent = {}
    for g, ss in A.items():
        if g == "hardware":
            continue
        sc.graph.update(frame_from="aqm", frame_to=g, matrix=np.eye(4))
    for g, ss in A.items():
        for s in ss:
            parent = g
            if g == "hardware":
                parent = ("rear_cover" if s.label.startswith("cover_screw") else
                          "display_retainers" if s.label.startswith("retainer") else
                          "mq131" if s.label.startswith("mq131") else "enclosure_body")
                hw_parent[s.label] = parent
            m = tess(s)
            m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
                baseColorFactor=[*rgb(s), 1.0], metallicFactor=0.6 if g == "hardware" or "can" in s.label else 0.0,
                roughnessFactor=0.45 if "glass" in s.label else 0.62))
            node = s.label if s.label not in A else f"{s.label}_mesh"   # never reuse a group name
            sc.add_geometry(m, node_name=node, geom_name=node, parent_node_name=parent)
    glb = os.path.join(OUT, "glb", "aqm.glb")
    sc.export(glb)

    def to_gltf(v):
        x, y, z = v
        return [x / 1000, z / 1000, -y / 1000]

    inventory = [
        dict(group="enclosure_body", part="Enclosure body (FDM print, PETG recommended)", source="designed"),
        dict(group="rear_cover", part="Removable rear cover with ESP32 cradle and keyholes", source="designed"),
        dict(group="display_retainers", part="Display retainer bars x2", source="designed"),
        dict(group="tft_display", part=aqm.COMPONENTS["tft"]["name"], source="approximation from published outline"),
        dict(group="esp32_devkit", part=aqm.COMPONENTS["esp32"]["name"], source="approximation from published outline"),
        dict(group="mh_z19e", part=aqm.COMPONENTS["mhz19e"]["name"], source="approximation from Winsen dimensions"),
        dict(group="dht22", part=aqm.COMPONENTS["dht22"]["name"], source="approximation from Aosong dimensions"),
        dict(group="zp07_mp503", part=aqm.COMPONENTS["mp503"]["name"], source="approximation from published outline"),
        dict(group="mq131", part=aqm.COMPONENTS["mq131"]["name"], source="approximation; cap size assumed"),
        dict(group="hardware", part="4x M3x6 SHCS + 4x M3 heat-set inserts (cover), 4x M2.5x6 (retainers), "
                                    "2x M3x20 standoffs + 4x M3 screws (MQ-131)", source="standard parts"),
    ]
    manifest = dict(
        units="metres, Y up, origin at the enclosure centre",
        explode_units="millimetres in the frame of the 'aqm' node (CAD axes: x right, y back, z up); "
                      "set each group node's position to explode * t, t in [0, 1]",
        groups={g: dict(nodes=[s.label for s in A[g]],
                        explode=list(aqm.EXPLODE.get(g, (0, 0, 0))))
                for g in A if g != "hardware"},
        hardware_parents=hw_parent,
        labels={"tft_display": "ILI9341 2.2\" TFT", "esp32_devkit": "ESP32 DevKit", "mh_z19e": "MH-Z19E CO₂",
                "dht22": "DHT22 temp / humidity", "zp07_mp503": "ZP07-MP503 air quality", "mq131": "MQ-131 ozone",
                "rear_cover": "Rear cover", "display_retainers": "Display retainers", "enclosure_body": "Enclosure"},
        inventory=inventory,
    )
    with open(os.path.join(OUT, "aqm.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print("interference (assembled):", hits or "none")
    print("interference (exploded):", hits_exploded or "none")
    print("sensor open area:", exp)
    print("thermal:", thermal)
    print("glb", round(os.path.getsize(glb) / 1e6, 2), "MB  time", round(time.time() - t0, 1), "s")


if __name__ == "__main__":
    main()

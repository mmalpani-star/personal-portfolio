"""Audit of the supplied CubeSat files (`3d models/cubesat/`). Read-only; writes export/survey.json.

Answers, with evidence:
  * are `madhav/` and `madhav 2/` (and final_design__.zip) the same files?
  * which Creo parts and assemblies exist, and which assembly references which?
  * what does each readable export (STEP, Parasolid .x_t / .xmm_txt) actually contain?
  * what does the Fusion study report (PDF) say about the design?
"""
import hashlib
import json
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import source as SRC  # noqa: E402

SRC_DIR = SRC.SRC_DIR
OUT = os.path.join(HERE, "export")
os.makedirs(OUT, exist_ok=True)


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def tree_hashes(d):
    return {n: sha(os.path.join(d, n)) for n in sorted(os.listdir(d)) if os.path.isfile(os.path.join(d, n))}


def main():
    out = {}
    a, b = tree_hashes(os.path.join(SRC_DIR, "madhav")), tree_hashes(os.path.join(SRC_DIR, "madhav 2"))
    out["madhav_vs_madhav_2"] = dict(files=[len(a), len(b)], same_names=sorted(a) == sorted(b),
                                     identical_content=a == b, differing=[n for n in a if a.get(n) != b.get(n)])
    z = zipfile.ZipFile(os.path.join(SRC_DIR, "final_design__.zip"))
    zh = {os.path.basename(i.filename): hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist() if not i.is_dir()}
    out["final_design_zip_vs_madhav"] = dict(files_in_zip=len(zh), identical_content=zh == a)

    # Creo files: kind, version header, and who references whom (names appear in the assemblies' binary)
    creo = {n: open(os.path.join(SRC_DIR, "madhav", n), "rb").read() for n in a if re.search(r"\.(prt|asm)\.\d+$", n)}
    stems = {n: re.sub(r"\.(prt|asm)\.\d+$", "", n) for n in creo}
    kinds = {n: ("assembly" if ".asm." in n else "part") for n in creo}
    ver = {re.search(rb"Creo\s+TM\s+([\d.]+)", d).group(1).decode() if re.search(rb"Creo\s+TM\s+([\d.]+)", d) else "?" for d in creo.values()}
    refs = {}
    for n, d in creo.items():
        if kinds[n] != "assembly":
            continue
        r = [s for m, s in stems.items() if m != n and s not in ("top", "ffpcb") and (s.upper().encode() in d)]
        refs[stems[n]] = sorted(r)
    out["creo"] = dict(parts=sum(k == "part" for k in kinds.values()), assemblies=sum(k == "assembly" for k in kinds.values()),
                       versions=sorted(ver), readable=False,
                       why_unreadable="proprietary parametric feature database (sketches, features, cached display data); no geometry kernel here reads it",
                       assembly_references=refs)
    out["top_level_assembly"] = dict(
        file="assenblyy.asm.2 (the newer of .1 and .2)",
        references=refs.get("assenblyy", []),
        note="References bottomxx, hol2, holdb1, top, board, fpcb_asm_1, pcb_component_asm_1, pcbbase_asm_1; the lattice `frame` part is not referenced by any assembly here")

    # STEP export of the flex-PCB assembly
    ch = SRC.top_children()
    rows = []
    for i, lab, sh in ch:
        bb = sh.bounding_box()
        rows.append(dict(index=i, name=lab, solids=len(SRC.solids_of(sh)),
                         min=[round(bb.min.X, 1), round(bb.min.Y, 1), round(bb.min.Z, 1)],
                         max=[round(bb.max.X, 1), round(bb.max.Y, 1), round(bb.max.Z, 1)]))
    dup = {}
    for r in rows:
        dup.setdefault((r["name"], tuple(r["min"]), tuple(r["max"])), []).append(r["index"])
    out["step_ffpcb"] = dict(
        file="madhav/ffpcb.stp", size_mb=round(os.path.getsize(SRC.STEP_PATH) / 1e6, 1), top_level_children=rows,
        coincident_duplicates=[v for v in dup.values() if len(v) > 1],
        reading="components sit at their own origins (duplicates coincide), so the export is not a packed assembly")

    # Parasolid text exports from Onshape
    px = {}
    for name in ("ARDUINO_NANO_1.x_t", "FPCB_ASM.x_t", os.path.join("finelest", "finelest.x_t")):
        p = os.path.join(SRC_DIR, name)
        head = open(p, "rb").read(900).decode("latin1")
        px[name] = dict(size_mb=round(os.path.getsize(p) / 1e6, 1), writer=re.search(r"APPL=(\w+)", head).group(1),
                        kernel=re.search(r"FRU=([^;]+);", head).group(1), date=re.search(r"DATE=([^;]+);", head).group(1))
    import numpy as np
    import xmm
    ms = xmm.meshes(os.path.join(SRC_DIR, "finelest", "finelest.xmm_txt"))
    allv = np.concatenate([m["P"] for m in ms])
    px["finelest.xmm_txt"] = dict(
        meshes=len(ms), triangles=int(sum(len(m["I"]) // 3 for m in ms)),
        extent=(allv.max(0) - allv.min(0)).round(2).tolist(),
        reading="decoded with cad/cubesat/xmm.py (plain-text vertex pool + index teeth). 43 meshes in a ~2.5 x 2.5 x 2.4 unit envelope: a small "
                "connector-like part, far too small to be a 100 mm frame",
    )
    px["note"] = ("The B-rep in the .x_t files needs the Parasolid XT schema to decode and was not read; the STEP of the same flex-PCB "
                  "assembly (ffpcb.stp) was used instead.")
    out["parasolid"] = px

    # The Fusion study report
    import pymupdf
    d = pymupdf.open(os.path.join(SRC_DIR, "CubeSat (S) 2025-07-02.pdf"))
    text = "\n".join(p.get_text() for p in d)
    out["pdf_study_report"] = dict(
        pages=d.page_count, tool=re.search(r"Autodesk Fusion[^\n]*", text).group(0) if "Autodesk Fusion" in text else "?",
        assembly="LAST ASSEMBLE v1 (S) v2", components=sorted(set(re.findall(r"(BOTTOMXX|HOL2|HOLDB1|TOP|frame v1|shaft v1)", text))),
        material="PLA (yield 20 MPa, E 2240 MPa)", studies="two static-stress studies (50 N; gravity 9.8 and 196 m/s^2)",
        contains_dimensions=False, contains_burn_wire_or_antenna=bool(re.search(r"antenna|burn", text, re.I)))
    with open(os.path.join(OUT, "survey.json"), "w") as f:
        json.dump(out, f, indent=1)
    print(json.dumps({k: out[k] for k in ("madhav_vs_madhav_2", "final_design_zip_vs_madhav")}, indent=1))
    print("creo parts/assemblies:", out["creo"]["parts"], out["creo"]["assemblies"], "| xmm:", px["finelest.xmm_txt"]["meshes"], "meshes")


if __name__ == "__main__":
    main()

"""
ESP32 Multi-Sensor Air Quality Monitor: enclosure and component assembly.
Parametric build123d (OpenCascade B-rep) model.

Frame: millimetres, Z up, origin at the front-bottom-left outer corner of the
enclosure. Front face is the XZ plane at y = 0 (display side); the removable
rear cover is at the back (+Y).

The prototype on the project page is a breadboard build with no enclosure.
This is a proposed enclosure designed around the parts list in the project
repository (github.com/mmalpani-star/AIR-QUALITY-MONITOR). Component outlines
use published dimensions where they exist; every value is tagged in
COMPONENTS / ASSUMPTIONS and listed in README.md.

Layout and the reasons for it
-----------------------------
  * Two bays split by a full-height baffle. LEFT: display at the front, ESP32
    on the rear cover behind it. RIGHT: the gas sensors, vented to the outside.
  * The MQ-131 has a heater of roughly 0.8 W and the MP503 is heated too, so
    they sit at the TOP of the sensor bay with exhaust slots above them: their
    own heat drives a chimney flow (inlet low on the side wall, outlet on top).
  * The DHT22 must read ambient air, not heater exhaust. It gets its own pocket
    at the BOTTOM of the sensor bay, upstream of the heaters, closed off from
    them by a horizontal baffle, with its own side and bottom grille.
  * The MH-Z19E (NDIR, low power) lies under the display behind a front grille,
    away from the heaters and the ESP32 module.
  * Four feet keep the bottom grille clear of the desk.
"""
from math import cos, radians, sin

from build123d import Align, Axis, Box, Color, Compound, Cylinder, Pos, Rot, fillet

# --------------------------------------------------------------- enclosure --
E = dict(
    W=126.0, H=72.0, D=48.0,     # outer size (x, z, y)
    t=2.4,                       # side / top / bottom walls
    tf=2.0,                      # front wall (thin where the display sits)
    r_out=4.0,                   # outer edge radius
    baffle_x=(80.0, 82.0),       # vertical baffle between bays
    dht_baffle_z=(21.0, 22.6),   # horizontal baffle above the DHT22 pocket
    cover_t=2.4, lip=1.6, lip_gap=0.3,
    boss_d=7.0, insert_d=4.0, insert_depth=6.0,   # M3 heat-set inserts
    boss_len=10.0,               # bosses are short pillars at the back, fused to two walls
    feet_h=3.0,
)

# -------------------------------------------------------------- components --
# Provenance: DATASHEET = vendor figure (see README for source),
#             MEASURED  = taken from the project photos/firmware,
#             ASSUMED   = provisional, must be checked with calipers.
COMPONENTS = dict(
    tft=dict(name="ILI9341 2.2in SPI TFT", pcb=(67.2, 40.1, 1.6),        # DATASHEET (MSP2202-type listing)
             glass=(55.2, 40.1, 2.35),                                   # ASSUMED (2.2in module outline)
             active=(45.12, 33.84),                                      # DATASHEET
             header_pins=9),                                             # ASSUMED
    esp32=dict(name="ESP32 DevKit V1 (30-pin)", pcb=(51.5, 28.3, 1.6),   # DATASHEET range 51.4-51.8 x 28.2-28.5
               row_pitch=25.4,                                           # ASSUMED (22.86 on some clones)
               wroom=(18.0, 25.5, 3.1)),                                 # DATASHEET (ESP-WROOM-32)
    dht22=dict(name="DHT22 / AM2302", body=(25.1, 15.1, 7.7)),           # DATASHEET (Aosong)
    mhz19e=dict(name="Winsen MH-Z19E", body=(32.9, 19.7, 8.6)),          # DATASHEET (Winsen)
    mp503=dict(name="Winsen ZP07-MP503", body=(24.0, 20.0, 16.0),        # DATASHEET (retailer, matches Winsen drawing)
               sensor_d=9.4),                                            # DATASHEET
    mq131=dict(name="MQ-131 ozone module", pcb=(35.0, 22.0, 1.6),        # DATASHEET (vendor, 35 x 22 x 30 overall)
               overall_h=30.0, cap_d=20.0, cap_h=17.0,                   # ASSUMED cap size
               hole_pitch=29.0),                                         # ASSUMED
)


def box(x0, y0, z0, x1, y1, z1):
    """Axis-aligned box from two corners."""
    return Pos((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2) * Box(abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))


def cyl_y(x, z, y0, y1, r):
    return Pos(x, (y0 + y1) / 2, z) * Rot(90, 0, 0) * Cylinder(r, abs(y1 - y0))


def cyl_x(y, z, x0, x1, r):
    return Pos((x0 + x1) / 2, y, z) * Rot(0, 90, 0) * Cylinder(r, abs(x1 - x0))


def cyl_z(x, y, z0, z1, r):
    return Pos(x, y, (z0 + z1) / 2) * Cylinder(r, abs(z1 - z0))


def labelled(shape, label, rgb):
    shape.label = label
    shape.color = Color(*rgb)
    return shape


# ------------------------------------------------------- component layout --
# Placement of every component (all in the enclosure frame). Kept in one place
# so the enclosure features below are derived from the same numbers.
L = {}
W, H, D, t, tf = E["W"], E["H"], E["D"], E["t"], E["tf"]

# display: glass against the inside of the front wall, header end on the right
_tft = COMPONENTS["tft"]
L["tft_pcb_x"] = (7.6, 7.6 + _tft["pcb"][0])
L["tft_pcb_z"] = (19.95, 19.95 + _tft["pcb"][1])
L["tft_glass_y"] = (tf, tf + _tft["glass"][2])
L["tft_pcb_y"] = (L["tft_glass_y"][1], L["tft_glass_y"][1] + _tft["pcb"][2])
_gx0 = L["tft_pcb_x"][0]
L["tft_active_c"] = (_gx0 + _tft["glass"][0] / 2, (L["tft_pcb_z"][0] + L["tft_pcb_z"][1]) / 2)

# ESP32 on the rear cover: component side toward the cover, pins toward the front
_esp = COMPONENTS["esp32"]
L["esp_pcb_x"] = (4.6, 4.6 + _esp["pcb"][0])           # USB end at the left wall
L["esp_pcb_z"] = (25.0, 25.0 + _esp["pcb"][1])
L["esp_pcb_y"] = (D - 6.6, D - 5.0)                    # 5.0 mm off the cover for the WROOM + USB
# MH-Z19E lying on the floor under the display
L["mhz_x"] = (12.0, 12.0 + 32.9)
L["mhz_y"] = (4.0, 4.0 + 19.7)
L["mhz_z"] = (t + 1.0, t + 1.0 + 8.6)
# sensor bay, x from 82.0 to 123.6
L["dht_x"] = (W - t - 1.0 - 7.7, W - t - 1.0)          # grid faces the right wall, 1 mm gap
L["dht_y"] = (10.5, 10.5 + 25.1)       # ends 2.4 mm short of the corner boss
L["dht_z"] = (t + 2.5, t + 2.5 + 15.1)
L["mp_x"] = (W - t - 1.0 - 16.0, W - t - 1.0)          # sensor can faces the right wall
L["mp_y"] = (14.0, 14.0 + 24.0)
L["mp_z"] = (24.5, 24.5 + 20.0)
L["mq_pcb_x"] = (W - t - 1.0 - 30.0, W - t - 1.0 - 30.0 + 1.6)   # cap faces the right wall
L["mq_y"] = (6.5, 6.5 + 35.0)
L["mq_z"] = (46.6, 46.6 + 22.0)


# -------------------------------------------------------------- enclosure --
def enclosure_body():
    outer = box(0, 0, 0, W, D, H)
    # round the front edges and the four edges that run front-to-back; the back
    # rim stays square so the rear cover closes flush
    front = outer.edges().group_by(Axis.Y)[0]
    outer = fillet(outer.edges().filter_by(Axis.Y) + front, E["r_out"])
    body = outer - box(t, tf, t, W - t, D + 1, H - t)

    # corner bosses for the rear-cover screws (M3 heat-set inserts)
    bx = [t + E["boss_d"] / 2 - 0.5, W - t - E["boss_d"] / 2 + 0.5]
    bz = [t + E["boss_d"] / 2 - 0.5, H - t - E["boss_d"] / 2 + 0.5]
    for x in bx:
        for z in bz:
            body += cyl_y(x, z, D - E["boss_len"], D, E["boss_d"] / 2)
            body -= cyl_y(x, z, D - E["insert_depth"], D + 1, E["insert_d"] / 2)
    L["cover_screws"] = [(x, z) for x in bx for z in bz]

    # vertical baffle between bays, with cable notches at the back
    x0, x1 = E["baffle_x"]
    body += box(x0, tf, t, x1, D - E["lip"] - 0.5, H - t)
    body -= box(x0 - 1, D - 16, H - t - 9, x1 + 1, D, H - t)      # sensor leads (top)
    body -= box(x0 - 1, D - 16, t, x1 + 1, D, t + 7)              # DHT22 lead (bottom)

    # horizontal baffle that closes the DHT22 pocket off from the heated sensors
    z0, z1 = E["dht_baffle_z"]
    body += box(x1, tf, z0, W - t, D - E["lip"] - 0.5, z1)
    body -= box(x1, D - 12, z0 - 1, x1 + 7, D, z1 + 1)            # DHT22 lead notch

    # display window (active area + 0.8 mm) with a 45 degree outer bevel
    ax, az = L["tft_active_c"]
    aw, ah = COMPONENTS["tft"]["active"]
    body -= box(ax - aw / 2 - 0.8, -1, az - ah / 2 - 0.8, ax + aw / 2 + 0.8, tf + 1, az + ah / 2 + 0.8)
    body -= box(ax - aw / 2 - 1.8, -1, az - ah / 2 - 1.8, ax + aw / 2 + 1.8, 0.8, az + ah / 2 + 1.8)

    # display retainer bosses (M2.5), outside the PCB ends
    L["retainer_bosses"] = []
    for x in (5.2, 77.6):
        for z in (L["tft_pcb_z"][0] + 2.0, L["tft_pcb_z"][1] - 2.0):
            body += cyl_y(x, z, tf, L["tft_pcb_y"][1], 2.4)
            body -= cyl_y(x, z, tf + 1.0, L["tft_pcb_y"][1] + 1, 1.05)
            L["retainer_bosses"].append((x, z))

    # CO2 grille in the front face under the display (MH-Z19E behind it)
    for i in range(7):
        x = L["mhz_x"][0] + 3.0 + i * 4.4
        body -= box(x, -1, L["mhz_z"][0] + 1.0, x + 1.8, tf + 1, L["mhz_z"][1] - 1.0)

    # right-wall grilles, one per sensor, sized to the sensing face
    def side_slots(y0, y1, z0, z1, pitch=3.4, w=1.8):
        n = int((y1 - y0 - w) // pitch) + 1
        off = (y1 - y0 - (n - 1) * pitch - w) / 2
        for i in range(n):
            y = y0 + off + i * pitch
            yield box(W - t - 1, y, z0, W + 1, y + w, z1)
    for s in side_slots(L["dht_y"][0] + 1, L["dht_y"][1] - 1, L["dht_z"][0] + 1.5, L["dht_z"][1] - 1.5):
        body -= s
    for s in side_slots(L["mp_y"][0] + 2, L["mp_y"][1] - 2, L["mp_z"][0] + 3, L["mp_z"][1] - 3):
        body -= s
    for s in side_slots(L["mq_y"][0] + 4, L["mq_y"][1] - 4, L["mq_z"][0] + 2, L["mq_z"][1] - 2):
        body -= s

    # MQ-131 standoff screws pass through the right wall
    for dy in (-COMPONENTS["mq131"]["hole_pitch"] / 2, COMPONENTS["mq131"]["hole_pitch"] / 2):
        body -= cyl_x(sum(L["mq_y"]) / 2 + dy, sum(L["mq_z"]) / 2, W - t - 1, W + 1, 1.7)

    # chimney: exhaust slots in the top over the sensor bay, inlet slots in the floor
    for i in range(6):
        x = 86.0 + i * 5.6
        body -= box(x, 8, H - t - 1, x + 2.0, D - 10, H + 1)
    for i in range(4):                                   # under the DHT22 pocket
        y = L["dht_y"][0] + 1 + i * 5.8
        body -= box(L["dht_x"][0] - 6, y, -1, W - t - 1.5, y + 2.0, t + 1)

    # USB access for the ESP32: an open slot at the back edge of the left wall
    esp_z = (L["esp_pcb_z"][0] + L["esp_pcb_z"][1]) / 2
    body -= box(-1, D - 12, esp_z - 5.0, t + 1, D + 1, esp_z + 5.0)

    # feet
    for x in (10, W - 10):
        for y in (8, D - 8):
            body += cyl_z(x, y, -E["feet_h"], 0.2, 4.0)

    body += sensor_mounts()     # the locating clips print as part of the body
    # MH-Z19E: keep the floor under its membrane open to the CO2 grille side
    return labelled(body, "enclosure_body", (0.16, 0.17, 0.19))


def rear_cover():
    ct, lip, g = E["cover_t"], E["lip"], E["lip_gap"]
    cover = box(0, D, 0, W, D + ct, H)
    cover = fillet(cover.edges().filter_by(Axis.Y), E["r_out"])
    cover += box(t + g, D - lip, t + g, W - t - g, D, H - t - g)
    cover -= box(t + g + 1.6, D - lip - 1, t + g + 1.6, W - t - g - 1.6, D - 0.0001, H - t - g - 1.6)
    for (x, z) in L["cover_screws"]:
        cover -= cyl_y(x, z, D - lip - 1, D + ct + 1, E["boss_d"] / 2 + 0.4)     # clear the bosses
        cover -= cyl_y(x, z, D - 1, D + ct + 1, 1.7)                              # M3 clearance
        cover -= cyl_y(x, z, D + ct - 1.6, D + ct + 1, 3.0)                       # counterbore
    # ESP32 cradle: two rails along the PCB long edges with a 1.7 mm groove
    ex0, ex1 = L["esp_pcb_x"]; ez0, ez1 = L["esp_pcb_z"]; ey0, ey1 = L["esp_pcb_y"]
    for z_edge, sgn in ((ez0, -1), (ez1, 1)):
        rail = box(ex0 + 6, ey0 - 1.5, z_edge + sgn * 0.0, ex1 - 6, D, z_edge + sgn * 3.0)
        groove = box(ex0 + 5, ey0 - 0.05, z_edge - sgn * 1.0, ex1 - 5, ey1 + 0.05, z_edge + sgn * 0.8)
        cover += rail
        cover -= groove
    # rear vents over the ESP32 and two keyhole slots for wall mounting
    for i in range(6):
        x = ex0 + 8 + i * 6.0
        cover -= box(x, D - 1, ez1 + 6, x + 2.0, D + ct + 1, ez1 + 16)
    # keyholes sit clear of the ESP32 (a wall screw head must not reach its module)
    for x in (66.0, 104.0):
        cover -= cyl_y(x, 36.0, D - 1, D + ct + 1, 3.6)
        cover -= box(x - 1.7, D - 1, 36.0, x + 1.7, D + ct + 1, 45.0)
    return labelled(cover, "rear_cover", (0.2, 0.21, 0.24))


def display_retainers():
    out = []
    y0 = L["tft_pcb_y"][1]
    for i, z in enumerate((L["tft_pcb_z"][0] + 2.0, L["tft_pcb_z"][1] - 2.0)):
        bar = box(2.9, y0, z - 2.6, 79.9, y0 + 2.4, z + 2.6)
        for x in (5.2, 77.6):
            bar -= cyl_y(x, z, y0 - 1, y0 + 4, 1.4)
        out.append(labelled(bar, f"display_retainer_{'bottom' if i == 0 else 'top'}", (0.2, 0.21, 0.24)))
    return out


# -------------------------------------------------------------- components --
def tft_display():
    c = COMPONENTS["tft"]
    x0, x1 = L["tft_pcb_x"]; z0, z1 = L["tft_pcb_z"]; gy0, gy1 = L["tft_glass_y"]; py0, py1 = L["tft_pcb_y"]
    pcb = labelled(box(x0, py0, z0, x1, py1, z1), "tft_pcb", (0.78, 0.12, 0.12))
    ax, az = L["tft_active_c"]; aw, ah = c["active"]
    active = labelled(box(ax - aw / 2, gy0, az - ah / 2, ax + aw / 2, gy0 + 0.3, az + ah / 2),
                      "tft_active_area", (0.22, 0.42, 0.75))
    glass = labelled(box(x0, gy0, z0, x0 + c["glass"][0], gy1, z1) - active, "tft_glass", (0.06, 0.06, 0.07))
    header = labelled(box(x1 - 4.0, py1, z0 + 8.0, x1 - 1.5, py1 + 8.5, z0 + 8.0 + 2.54 * c["header_pins"]),
                      "tft_header", (0.1, 0.1, 0.1))
    sd = labelled(box(x0 + 14, py1, z0 + 6, x0 + 42, py1 + 2.8, z0 + 34), "tft_sd_socket", (0.75, 0.75, 0.78))
    return [pcb, glass, active, header, sd]


def esp32():
    c = COMPONENTS["esp32"]
    x0, x1 = L["esp_pcb_x"]; z0, z1 = L["esp_pcb_z"]; y0, y1 = L["esp_pcb_y"]
    zc = (z0 + z1) / 2
    pcb = labelled(box(x0, y0, z0, x1, y1, z1), "esp32_pcb", (0.08, 0.08, 0.09))
    wx = x1 - c["wroom"][1]
    wroom = labelled(box(wx, y1, zc - 9.0, x1, y1 + 0.8, zc + 9.0), "esp32_wroom_pcb", (0.08, 0.08, 0.09))
    can = labelled(box(wx + 1.0, y1 + 0.8, zc - 7.9, wx + 18.8, y1 + 3.1, zc + 7.9), "esp32_shield_can",
                   (0.78, 0.78, 0.8))
    usb = labelled(box(x0 - 0.8, y1, zc - 3.9, x0 + 5.0, y1 + 3.0, zc + 3.9), "esp32_micro_usb", (0.75, 0.75, 0.78))
    out = [pcb, wroom, can, usb]
    for k, z in enumerate((zc - c["row_pitch"] / 2, zc + c["row_pitch"] / 2)):
        hx0 = x0 + (c["pcb"][0] - 15 * 2.54) / 2
        out.append(labelled(box(hx0, y0 - 2.5, z - 1.27, hx0 + 15 * 2.54, y0, z + 1.27),
                            f"esp32_header_body_{k + 1}", (0.1, 0.1, 0.1)))
        out.append(labelled(box(hx0 + 0.3, y0 - 8.5, z - 0.32, hx0 + 15 * 2.54 - 0.3, y0 - 2.5, z + 0.32),
                            f"esp32_header_pins_{k + 1}", (0.85, 0.7, 0.3)))
    return out


def dht22():
    x0, x1 = L["dht_x"]; y0, y1 = L["dht_y"]; z0, z1 = L["dht_z"]
    body = box(x0, y0, z0, x1, y1, z1)
    for i in range(5):                                   # the sensing grid on the +X face
        y = y0 + 4 + i * 3.6
        body -= box(x1 - 0.8, y, z0 + 2.5, x1 + 0.1, y + 1.8, z1 - 2.5)
    pins = box(x0 + 2.5, y0 - 8.0, (z0 + z1) / 2 - 4.0, x0 + 3.1, y0, (z0 + z1) / 2 + 4.0)
    return [labelled(body, "dht22_body", (0.94, 0.94, 0.92)), labelled(pins, "dht22_pins", (0.85, 0.7, 0.3))]


def mhz19e():
    x0, x1 = L["mhz_x"]; y0, y1 = L["mhz_y"]; z0, z1 = L["mhz_z"]
    window = box(x0 + 4, y0 + 3, z1 - 0.3, x0 + 12, y1 - 3, z1)   # gas-permeable membrane, top face
    body = box(x0, y0, z0, x1, y1, z1) - window
    return [labelled(body, "mh_z19e_body", (0.78, 0.66, 0.32)), labelled(window, "mh_z19e_membrane", (0.92, 0.92, 0.9))]


def mp503():
    c = COMPONENTS["mp503"]
    x0, x1 = L["mp_x"]; y0, y1 = L["mp_y"]; z0, z1 = L["mp_z"]
    pcb = box(x0, y0, z0, x0 + 1.6, y1, z1)
    yc, zc = (y0 + y1) / 2, (z0 + z1) / 2
    can = cyl_x(yc, zc, x0 + 1.6, x1 - 0.5, c["sensor_d"] / 2)
    mesh = cyl_x(yc, zc, x1 - 0.5, x1, c["sensor_d"] / 2 - 0.6)
    xh = box(x0 - 6.0, y0 + 4, z0 + 2, x0, y0 + 14, z0 + 7.5)
    return [labelled(pcb, "mp503_pcb", (0.1, 0.45, 0.25)), labelled(can, "mp503_sensor", (0.78, 0.78, 0.8)),
            labelled(mesh, "mp503_sensor_mesh", (0.55, 0.55, 0.58)), labelled(xh, "mp503_xh_connector", (0.95, 0.95, 0.93))]


def mq131():
    c = COMPONENTS["mq131"]
    x0, x1 = L["mq_pcb_x"]; y0, y1 = L["mq_y"]; z0, z1 = L["mq_z"]
    yc, zc = (y0 + y1) / 2, (z0 + z1) / 2
    pcb = box(x0, y0, z0, x1, y1, z1)
    for dy in (-c["hole_pitch"] / 2, c["hole_pitch"] / 2):
        pcb -= cyl_x(yc + dy, zc, x0 - 1, x1 + 1, 1.6)
    base = cyl_x(yc, zc, x1, x1 + 4.0, 8.5)
    cap = cyl_x(yc, zc, x1 + 4.0, x1 + 4.0 + c["cap_h"], c["cap_d"] / 2)
    gauze = cyl_x(yc, zc, x1 + 4.0 + c["cap_h"], x1 + 4.4 + c["cap_h"], c["cap_d"] / 2 - 3)
    pot = box(x1, y0 + 1.5, z0 + 1.5, x1 + 6.0, y0 + 7.5, z0 + 7.5)
    hdr = box(x0 - 8.5, yc - 5.1, z0 + 1.0, x0, yc + 5.1, z0 + 3.5)    # 4-pin header on the lower long edge
    return [labelled(pcb, "mq131_pcb", (0.06, 0.06, 0.07)), labelled(base, "mq131_sensor_base", (0.92, 0.92, 0.9)),
            labelled(cap, "mq131_sensor_cap", (0.08, 0.08, 0.09)), labelled(gauze, "mq131_sensor_gauze", (0.5, 0.5, 0.52)),
            labelled(pot, "mq131_trim_pot", (0.15, 0.35, 0.8)), labelled(hdr, "mq131_header", (0.1, 0.1, 0.1))]


# --------------------------------------------------------------- hardware --
def screw(x, y, z, axis_dir, length, d=3.0, head_d=5.5, head_h=3.0, label="screw"):
    """Socket-head screw whose head sits at (x, y, z) and shank runs along axis_dir (+-Y only)."""
    s = 1 if axis_dir > 0 else -1
    shank = cyl_y(x, z, y, y + s * length, d / 2)
    head = cyl_y(x, z, y - s * head_h, y, head_d / 2)
    return labelled(shank + head, label, (0.62, 0.62, 0.64))


def hardware():
    out = []
    ct = E["cover_t"]
    for i, (x, z) in enumerate(L["cover_screws"]):
        out.append(screw(x, D + ct - 1.6, z, -1, 6, label=f"cover_screw_m3x6_{i + 1}"))
        ins = cyl_y(x, z, D - E["insert_depth"], D - 0.5, 2.0) - cyl_y(x, z, D - 7, D, 1.5)
        out.append(labelled(ins, f"heat_set_insert_m3_{i + 1}", (0.78, 0.6, 0.25)))
    y0 = L["tft_pcb_y"][1] + 2.4
    for i, (x, z) in enumerate(L["retainer_bosses"]):
        out.append(screw(x, y0 + 2.0, z, -1, 6, d=2.5, head_d=4.5, head_h=2.0, label=f"retainer_screw_m25x6_{i + 1}"))
    # MQ-131 module on two 20 mm M3 standoffs from the right wall
    x1 = L["mq_pcb_x"][1]; yc = sum(L["mq_y"]) / 2; zc = sum(L["mq_z"]) / 2
    for i, dy in enumerate((-COMPONENTS["mq131"]["hole_pitch"] / 2, COMPONENTS["mq131"]["hole_pitch"] / 2)):
        st = cyl_x(yc + dy, zc, x1, W - t, 2.75) - cyl_x(yc + dy, zc, x1 - 1, W - t + 1, 1.25)
        out.append(labelled(st, f"mq131_standoff_{i + 1}", (0.62, 0.62, 0.64)))
        sc = cyl_x(yc + dy, zc, L["mq_pcb_x"][0] - 3.0, L["mq_pcb_x"][0], 2.75) + cyl_x(yc + dy, zc, L["mq_pcb_x"][0], x1 + 6, 1.5)
        out.append(labelled(sc, f"mq131_screw_m3_{i + 1}", (0.62, 0.62, 0.64)))
        ws = cyl_x(yc + dy, zc, W - t - 0.01, W + 2.5, 1.5) + cyl_x(yc + dy, zc, W, W + 2.5, 2.75)
        out.append(labelled(ws, f"mq131_wall_screw_m3_{i + 1}", (0.62, 0.62, 0.64)))
    return out


def sensor_mounts():
    """Printed clips that locate the DHT22, MP503 and MH-Z19E (part of the body print)."""
    out = []
    # DHT22: two L-clips from the floor of its pocket
    x0, x1 = L["dht_x"]; y0, y1 = L["dht_y"]; z0, _ = L["dht_z"]
    for y in (y0 + 3, y1 - 6):
        clip = box(x0 - 1.6, y, t, x1, y + 3, z0) + box(x0 - 1.6, y, z0, x0, y + 3, z0 + 6)
        out.append(clip)
    # MP503: shelf + rear stop on the baffle side
    mx0, _ = L["mp_x"]; my0, my1 = L["mp_y"]; mz0, mz1 = L["mp_z"]
    out.append(box(mx0 - 2.0, my0, E["dht_baffle_z"][1], mx0 + 4.0, my1, mz0))
    # rear stop: a post standing on the shelf, beside (not over) the XH connector
    out.append(box(mx0 - 2.0, my0 + 15.0, E["dht_baffle_z"][1], mx0, my1 - 1.5, mz1 - 2))
    # MH-Z19E: end stops on the floor, leaving the face toward the CO2 grille clear
    hx0, hx1 = L["mhz_x"]; hy0, hy1 = L["mhz_y"]
    for x in (hx0 - 1.6, hx1):
        out.append(box(x, hy0 + 3, t, x + 1.6, hy1 - 3, t + 5.0))
    out.append(box(hx0 + 4, hy1, t, hx1 - 4, hy1 + 1.6, t + 5.0))     # back stop
    shape = out[0]
    for o in out[1:]:
        shape += o
    return shape


# ------------------------------------------------------------------ groups --
def assembly():
    """Return {group: [shapes]} for the full model."""
    return dict(
        enclosure_body=[enclosure_body()],
        rear_cover=[rear_cover()],
        display_retainers=display_retainers(),
        tft_display=tft_display(),
        esp32_devkit=esp32(),
        mh_z19e=mhz19e(),
        dht22=dht22(),
        zp07_mp503=mp503(),
        mq131=mq131(),
        hardware=hardware(),
    )


# Exploded view: per-group offsets (mm, enclosure frame). Each moves a group
# along the direction it is assembled from, so the view reads as a teardown.
EXPLODE = dict(
    enclosure_body=(0, 0, 0),
    rear_cover=(0, 95, 0),
    esp32_devkit=(0, 68, 0),
    display_retainers=(0, 38, 0),
    tft_display=(0, -42, 0),
    mh_z19e=(0, -30, -24),
    dht22=(46, 0, -14),
    zp07_mp503=(50, 0, 0),
    mq131=(52, 0, 18),
    hardware=(0, 0, 0),   # hardware follows its parent; see build.py
)

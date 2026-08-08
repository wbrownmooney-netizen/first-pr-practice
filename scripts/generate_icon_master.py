#!/usr/bin/env python3
"""Rasterizes icon.svg's design (diagonal gradient rounded square + four
ascending candlesticks) at 1024x1024 for use as the app store icon
master, via @capacitor/assets. Pure stdlib (zlib/struct), same
no-image-library approach icon-192.png/icon-512.png were generated with
-- those existing PWA icons are left untouched; this only adds a new,
higher-resolution master for the native app icon pipeline.
"""
import struct
import zlib

SIZE = 1024
SCALE = SIZE / 512.0


def lerp(a, b, t):
    return a + (b - a) * t


def rounded_rect_sdf(px, py, w, h, r):
    # Signed-distance-ish membership test for a rounded rect centered at
    # canvas origin's local box [0,w]x[0,h] with corner radius r.
    qx = abs(px - w / 2) - (w / 2 - r)
    qy = abs(py - h / 2) - (h / 2 - r)
    ax, ay = max(qx, 0), max(qy, 0)
    outside = (ax * ax + ay * ay) ** 0.5
    inside = min(max(qx, qy), 0)
    return outside + inside - r


def capsule_sdf(px, py, x1, y1, x2, y2, radius):
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    cx, cy = x1 + t * dx, y1 + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5 - radius


BLUE = (0x1D, 0x4E, 0xD8)
VIOLET = (0x7C, 0x3A, 0xED)
WHITE = (0xFF, 0xFF, 0xFF)
GREEN = (0x4A, 0xDE, 0x80)

# (x1, y1, x2_wick_bottom_offset..., body...) expressed directly as the
# same coordinates icon.svg uses, scaled by SCALE at sample time.
CANDLES = [
    # wick_top, wick_bottom_of_top_stub, body(x,y,w,h,r), wick_top2, wick_bottom2, color
    ((100, 300, 100, 330), (72, 330, 56, 80, 10), (100, 410, 100, 430), WHITE),
    ((205, 230, 205, 260), (177, 260, 56, 100, 10), (205, 360, 205, 390), WHITE),
    ((310, 150, 310, 180), (282, 180, 56, 120, 10), (310, 300, 310, 330), WHITE),
    ((415, 70, 415, 100), (387, 100, 56, 150, 10), (415, 250, 415, 280), GREEN),
]

STROKE_W = 12 / 2  # radius (half of stroke-width) for capsule wicks


def render():
    pixels = bytearray(SIZE * SIZE * 4)
    corner_r = 96 * SCALE
    for y in range(SIZE):
        sy = y / SCALE
        for x in range(SIZE):
            sx = x / SCALE
            idx = (y * SIZE + x) * 4

            d = rounded_rect_sdf(sx, sy, 512, 512, 96)
            if d > 0:
                pixels[idx:idx + 4] = (0, 0, 0, 0)
                continue

            t = max(0.0, min(1.0, (sx + sy) / (512 + 512)))
            r = int(lerp(*[c[0] for c in (BLUE, VIOLET)], t))
            g = int(lerp(*[c[1] for c in (BLUE, VIOLET)], t))
            b = int(lerp(*[c[2] for c in (BLUE, VIOLET)], t))
            color = (r, g, b)

            for wick_top, body, wick_bottom, ccolor in CANDLES:
                bx, by, bw, bh, br = body
                if rounded_rect_sdf(sx - bx, sy - by, bw, bh, br) <= 0:
                    color = ccolor
                    break
                if capsule_sdf(sx, sy, wick_top[0], wick_top[1], wick_top[2], wick_top[3], STROKE_W) <= 0:
                    color = ccolor
                    break
                if capsule_sdf(sx, sy, wick_bottom[0], wick_bottom[1], wick_bottom[2], wick_bottom[3], STROKE_W) <= 0:
                    color = ccolor
                    break

            pixels[idx:idx + 4] = bytes((*color, 255))
    return pixels


def write_png(path, width, height, rgba):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])
    idat = zlib.compress(bytes(raw), 9)
    with open(path, 'wb') as f:
        f.write(sig)
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', idat))
        f.write(chunk(b'IEND', b''))


if __name__ == '__main__':
    import os
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'resources')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'icon.png')
    write_png(out_path, SIZE, SIZE, render())
    print(f'Wrote {out_path} ({SIZE}x{SIZE})')

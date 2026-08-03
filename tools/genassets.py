#!/usr/bin/env python3
"""Generate the Homey App Store images for Advanced Waiting.

The three store images are the same mark as assets/icon.svg - a stopwatch whose
hand sits just past the top, the fraction of a second Homey's own Delay block
cannot express - drawn on the app's brand colour. Redraw them with:

    python3 tools/genassets.py

Requires Pillow only. Sizes are fixed by Homey: 250x175, 500x350, 1000x700.
"""

import math

from PIL import Image, ImageDraw

BRAND = (242, 163, 60)
WHITE = (255, 255, 255)

SIZES = {"small": (250, 175), "large": (500, 350), "xlarge": (1000, 700)}

# Supersampling factor. The mark is all circles and thin strokes, so drawing big
# and downscaling is what keeps the edges clean at 250x175.
SS = 4

# Geometry in the same 512x512 space as assets/icon.svg, so the two stay in sync.
CENTRE = (256, 296)
RADIUS = 160
STROKE = 34
CROWN_Y = 56
CROWN_HALF = 48
STEM_TOP = 56
STEM_BOTTOM = 136
HAND_UP = 96          # length of the long hand, pointing up
HAND_SHORT = (66, 34)  # short hand offset, just past the top


def line(draw, a, b, width):
    """A stroke with rounded ends, which ImageDraw does not do on its own."""
    draw.line([a, b], fill=WHITE, width=width)
    for point in (a, b):
        r = width / 2
        draw.ellipse([point[0] - r, point[1] - r, point[0] + r, point[1] + r], fill=WHITE)


def draw_mark(size):
    """Draw the mark centred in an image of `size`, supersampled."""
    w, h = size
    img = Image.new("RGB", (w * SS, h * SS), BRAND)
    draw = ImageDraw.Draw(img)

    # Fit the 512x512 mark into the shorter side, leaving a margin.
    scale = (min(w, h) * 0.62 / 512) * SS
    ox = (w * SS - 512 * scale) / 2
    oy = (h * SS - 512 * scale) / 2

    def p(x, y):
        return (ox + x * scale, oy + y * scale)

    stroke = max(1, round(STROKE * scale))

    cx, cy = CENTRE
    r = RADIUS
    draw.ellipse([*p(cx - r, cy - r), *p(cx + r, cy + r)], outline=WHITE, width=stroke)

    line(draw, p(cx - CROWN_HALF, CROWN_Y), p(cx + CROWN_HALF, CROWN_Y), stroke)
    line(draw, p(cx, STEM_TOP), p(cx, STEM_BOTTOM), stroke)
    line(draw, p(cx, cy), p(cx, cy - HAND_UP), stroke)
    line(draw, p(cx, cy), p(cx + HAND_SHORT[0], cy + HAND_SHORT[1]), stroke)

    return img.resize(size, Image.LANCZOS)


def main():
    for name, size in SIZES.items():
        draw_mark(size).save(f"assets/images/{name}.png")
        print(f"assets/images/{name}.png {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()

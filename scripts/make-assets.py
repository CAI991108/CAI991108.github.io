#!/usr/bin/env python3
"""Generate the site's image assets: favicon set + square avatar.

Run from the repo root:

    python scripts/make-assets.py

Outputs (all committed):
    images/favicon.svg
    images/favicon.ico         16/32/48, PNG-compressed entries
    images/favicon-16.png
    images/favicon-32.png
    images/apple-touch-icon.png 180x180, full bleed (iOS applies its own mask)
    images/profile.webp         512x512 square crop of images/profile.src.jpg

The mark is a "Z" polyline on the site's mid-tone blue. Everything is drawn at
8x and downsampled, so the 16px icon stays crisp without a hand-tuned variant.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"

BRAND = (0x5D, 0x7A, 0xA9, 255)
WHITE = (255, 255, 255, 255)
UNIT = 32  # drawing space
SS = 8  # supersample factor


def draw_mark(size: int, rounded: bool) -> Image.Image:
    """A 'Z' on a brand square, drawn at 8x then downsampled."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = int(big * 0.22) if rounded else 0
    d.rounded_rectangle([(0, 0), (big - 1, big - 1)], radius=radius, fill=BRAND)

    k = big / UNIT
    stroke = max(1, round(3.6 * k))
    pts = [(9 * k, 9.5 * k), (23 * k, 9.5 * k), (9 * k, 22.5 * k), (23 * k, 22.5 * k)]
    for a, b in zip(pts, pts[1:]):
        d.line([a, b], fill=WHITE, width=stroke)

    return img.resize((size, size), Image.LANCZOS)


def write_svg() -> None:
    (IMAGES / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Zijin CAI">\n'
        '  <rect width="32" height="32" rx="7" fill="#5d7aa9"/>\n'
        '  <g fill="none" stroke="#fff" stroke-width="3.4">\n'
        '    <path d="M9 9.5h14"/>\n'
        '    <path d="M23 9.5 9 22.5"/>\n'
        '    <path d="M9 22.5h14"/>\n'
        "  </g>\n"
        "</svg>\n",
        encoding="utf-8",
    )


def build_icons() -> None:
    write_svg()

    for size in (16, 32):
        draw_mark(size, rounded=True).save(IMAGES / f"favicon-{size}.png")

    # Apple masks the corners itself, so this one is full bleed.
    draw_mark(180, rounded=False).save(IMAGES / "apple-touch-icon.png")

    ico = draw_mark(48, rounded=True)
    ico.save(IMAGES / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


def build_avatar() -> None:
    src = IMAGES / "profile.src.jpg"
    if not src.exists():
        print(f"skip avatar: {src.name} not found")
        return
    img = Image.open(src).convert("RGB")
    w, h = img.size
    # Square crop around the face, keeping the shoulders in frame so the
    # circular sidebar mask doesn't clip at the chin.
    side = min(w, h)
    cx, cy = w // 2, int(h * 0.26)
    left = max(0, min(w - side, cx - side // 2))
    top = max(0, min(h - side, cy - side // 2))
    img.crop((left, top, left + side, top + side)).resize(
        (512, 512), Image.LANCZOS
    ).save(IMAGES / "profile.webp", quality=82, method=6)


def build_og_card() -> None:
    """1200x630 share card: the same mark, palette and words as the site."""
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(card)

    # Brand rule down the left edge, then the mark on the right.
    brand_rgb = BRAND[:3]
    d.rectangle([(0, 0), (10, H)], fill=brand_rgb)
    mark = draw_mark(170, rounded=True)
    card.paste(mark, (952, 232), mark)

    cjk = "C:/Windows/Fonts/NotoSansSC-VF.ttf"
    try:
        title = ImageFont.truetype(cjk, 68)
        title.set_variation_by_name("Bold")
        body = ImageFont.truetype(cjk, 27)
        body.set_variation_by_name("Regular")
        small = ImageFont.truetype(cjk, 24)
        small.set_variation_by_name("Regular")
    except OSError:
        title = body = small = ImageFont.load_default()

    ink = (31, 39, 51)
    muted = (111, 119, 135)

    d.text((96, 196), "Zijin CAI \u8521\u5b50\u664b", font=title, fill=ink)
    d.text((96, 302), "PhD in Artificial Intelligence \u00b7 CUHK-Shenzhen", font=body, fill=brand_rgb)
    d.text((96, 344), "Research Fellow \u00b7 CUHK(SZ)\u2013CROSS Joint Laboratory", font=body, fill=muted)

    d.line([(96, 486), (1104, 486)], fill=(232, 235, 240), width=2)
    d.text((96, 514), "cai991108.github.io", font=small, fill=muted)

    card.save(IMAGES / "og-card.png", optimize=True)


if __name__ == "__main__":
    build_icons()
    build_avatar()
    build_og_card()
    for p in sorted(IMAGES.glob("favicon*")) + sorted(IMAGES.glob("apple-touch*")) + sorted(
        list(IMAGES.glob("profile.webp")) + list(IMAGES.glob("og-card.png"))
    ):
        print(f"{p.relative_to(ROOT)}  {p.stat().st_size / 1024:.1f} KB")

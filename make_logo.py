#!/usr/bin/env python3
"""
Render the Wirewalk AI mark and lockup as PNGs, reproducing the site's CSS exactly.

From index.html:
  .mark            21x21, 2x2 grid, gap 2.5px
  .mark i          background var(--acf) #D97757, border-radius 1.5px, scale .84
  .mark i:nth(3)   opacity .55
  .mark i:nth(4)   opacity .28
  .bn              "Wirewalk" in --tx #1F1E1D
  .bn s            "AI" in --tx3 #8A8781, weight 500, margin-left 7px
"""
from PIL import Image, ImageDraw, ImageFont

AC   = (0xD9, 0x77, 0x57)
TX   = (0x1F, 0x1E, 0x1D)
TX3  = (0x8A, 0x87, 0x81)
S    = 24                      # scale factor: 21px CSS -> 504px render

def mark(scale=S):
    """
    Wirewalk AI mark: a 2x2 field, three squares filled and one left hollow.

    The firm's argument is that attention across an operation is uneven - the
    obvious areas get looked at, one does not, and that is where the cost sits.
    The mark states it: three seen, one missed.

    Geometry inherits the site's .mark rule (2x2, 2.5/21 gap, 1.5/21 radius) so
    it stays the same brand, with the opacity fade replaced by a hollow square
    for contrast that survives 16px.
    """
    side  = int(21 * scale)
    gap   = 2.5 * scale
    cell  = (side - gap) / 2
    rad   = 1.5 * scale
    img   = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    d     = ImageDraw.Draw(img)
    stroke = max(2, int(cell * 0.19))
    for idx, (cx, cy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
        x0 = cx * (cell + gap); y0 = cy * (cell + gap)
        box = [x0, y0, x0 + cell, y0 + cell]
        if idx < 3:
            d.rounded_rectangle(box, radius=rad, fill=AC + (255,))
        else:
            ins = stroke / 2
            d.rounded_rectangle([box[0]+ins, box[1]+ins, box[2]-ins, box[3]-ins],
                                radius=max(1, rad - ins/2),
                                outline=AC + (255,), width=stroke)
    return img


def font(size, bold=False):
    for path, idx in (("/System/Library/Fonts/HelveticaNeue.ttc", 1 if bold else 0),
                      ("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
                       else "/System/Library/Fonts/Supplemental/Arial.ttf", 0)):
        try:
            return ImageFont.truetype(path, size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()

def lockup(mark_px=132):
    m = mark().resize((mark_px, mark_px), Image.LANCZOS)
    fsize = int(mark_px * 0.92)
    f_main = font(fsize, bold=True)
    f_ai   = font(fsize, bold=False)
    gap_mark = int(mark_px * 0.48)
    gap_ai   = int(mark_px * 0.33)

    tmp = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    w1 = tmp.textbbox((0, 0), "Wirewalk", font=f_main)[2]
    w2 = tmp.textbbox((0, 0), "AI", font=f_ai)[2]
    asc = tmp.textbbox((0, 0), "Wirewalk", font=f_main)[3]

    W = mark_px + gap_mark + w1 + gap_ai + w2 + int(mark_px * 0.35)
    H = max(mark_px, asc) + int(mark_px * 0.30)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(m, (0, (H - mark_px) // 2), m)
    d = ImageDraw.Draw(img)
    ty = (H - asc) // 2 - int(mark_px * 0.06)
    d.text((mark_px + gap_mark, ty), "Wirewalk", font=f_main, fill=TX)
    d.text((mark_px + gap_mark + w1 + gap_ai, ty), "AI", font=f_ai, fill=TX3)
    return img

if __name__ == "__main__":
    out = "/Users/lennyshovsky/Downloads/wirewalkai/"
    m = mark(); m.save(out + "logo-mark.png")
    l = lockup(); l.save(out + "logo-lockup.png")
    print(f"  logo-mark.png    {m.size[0]}x{m.size[1]}")
    print(f"  logo-lockup.png  {l.size[0]}x{l.size[1]}")

from pathlib import Path
from PIL import Image, ImageDraw

BASE_TILE = 32
TARGET_TILE = 64
ROOT = Path(__file__).resolve().parents[1]
SPRITES_DIR = ROOT / "client" / "assets" / "sprites"
TILES_DIR = ROOT / "client" / "assets" / "tiles"

SPRITES_DIR.mkdir(parents=True, exist_ok=True)
TILES_DIR.mkdir(parents=True, exist_ok=True)


def rgba(hex_color: str, a: int = 255):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (a,)


def save(img: Image.Image, path: Path):
    img.save(path, format="PNG")


def upscale_tile(img: Image.Image):
    resample_attr = getattr(Image, "Resampling", Image)
    return img.resize((TARGET_TILE, TARGET_TILE), resample=resample_attr.NEAREST)


def make_tile(base: str, accent: str, detail: str, pattern: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(base))
    d = ImageDraw.Draw(img)

    if pattern == "grid":
        for x in range(0, BASE_TILE, 8):
            d.line([(x, 0), (x, BASE_TILE)], fill=rgba(detail, 90), width=1)
        for y in range(0, BASE_TILE, 8):
            d.line([(0, y), (BASE_TILE, y)], fill=rgba(detail, 90), width=1)
    elif pattern == "diag":
        for i in range(-BASE_TILE, BASE_TILE * 2, 6):
            d.line([(i, 0), (i - BASE_TILE, BASE_TILE)], fill=rgba(detail, 75), width=1)
    elif pattern == "speck":
        for y in range(2, BASE_TILE, 6):
            for x in range((y % 4), BASE_TILE, 7):
                d.point((x, y), fill=rgba(detail, 120))

    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba(accent, 130), width=1)
    return img


def make_wall(base: str, trim: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(base))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, BASE_TILE - 1, 7], fill=rgba(trim))
    d.rectangle([0, 8, BASE_TILE - 1, BASE_TILE - 1], fill=rgba(base))
    for y in range(10, BASE_TILE, 6):
        d.line([(2, y), (BASE_TILE - 3, y)], fill=rgba(trim, 110), width=1)
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#0f1116", 180), width=1)
    return img


def make_portal(base: str, glow: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([2, 2, BASE_TILE - 3, BASE_TILE - 3], fill=rgba(base, 120), outline=rgba(glow, 170), width=2)
    d.ellipse([7, 7, BASE_TILE - 8, BASE_TILE - 8], fill=rgba(glow, 155), outline=rgba("#ffffff", 120), width=1)
    d.ellipse([11, 11, BASE_TILE - 12, BASE_TILE - 12], fill=rgba(base, 220))
    return img


def make_door(base: str, frame: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(frame))
    d = ImageDraw.Draw(img)
    d.rectangle([5, 4, BASE_TILE - 6, BASE_TILE - 2], fill=rgba(base), outline=rgba("#0d1117", 180), width=1)
    d.ellipse([BASE_TILE - 10, BASE_TILE // 2, BASE_TILE - 8, BASE_TILE // 2 + 2], fill=rgba("#e2c77a"))
    return img


def make_stairs(base: str, line: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(base))
    d = ImageDraw.Draw(img)
    for i in range(6):
        y = 6 + i * 4
        d.line([(5 + i, y), (BASE_TILE - 6, y)], fill=rgba(line), width=2)
    return img


def make_prop(base: str, accent: str, kind: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if kind == "desk":
        d.rectangle([3, 10, 28, 26], fill=rgba(base), outline=rgba("#10151e"), width=1)
        d.rectangle([5, 12, 26, 14], fill=rgba(accent))
    elif kind == "computer":
        d.rectangle([6, 8, 25, 20], fill=rgba(base), outline=rgba("#10151e"), width=1)
        d.rectangle([8, 10, 23, 17], fill=rgba(accent))
        d.rectangle([12, 21, 19, 24], fill=rgba(base))
    elif kind == "plant":
        d.rectangle([12, 20, 19, 27], fill=rgba(base))
        d.ellipse([7, 8, 24, 21], fill=rgba(accent))
    elif kind == "bookshelf":
        d.rectangle([4, 5, 27, 27], fill=rgba(base), outline=rgba("#11151d"), width=1)
        for y in (10, 15, 20):
            d.line([(6, y), (25, y)], fill=rgba(accent), width=1)
    elif kind == "lab_table":
        d.rectangle([3, 11, 28, 24], fill=rgba(base), outline=rgba("#11151d"), width=1)
        d.rectangle([6, 8, 25, 11], fill=rgba(accent))
    elif kind == "server_rack":
        d.rectangle([7, 4, 24, 28], fill=rgba(base), outline=rgba("#0d1117"), width=1)
        for y in range(8, 27, 4):
            d.rectangle([10, y, 21, y + 1], fill=rgba(accent))
    elif kind == "chair":
        d.rectangle([9, 13, 22, 20], fill=rgba(base))
        d.rectangle([11, 21, 13, 27], fill=rgba(base))
        d.rectangle([18, 21, 20, 27], fill=rgba(base))
        d.rectangle([9, 9, 22, 12], fill=rgba(accent))
    elif kind == "water_tank":
        d.ellipse([8, 4, 23, 10], fill=rgba(base))
        d.rectangle([8, 8, 23, 26], fill=rgba(base))
        d.ellipse([8, 22, 23, 28], fill=rgba(base))
        d.rectangle([11, 13, 20, 16], fill=rgba(accent, 170))
    elif kind == "caution_sign":
        d.polygon([(16, 4), (28, 25), (4, 25)], fill=rgba(base), outline=rgba("#11151d"))
        d.line([(16, 11), (16, 18)], fill=rgba(accent), width=2)
        d.ellipse([15, 20, 17, 22], fill=rgba(accent))

    return img


def make_npc(primary: str, secondary: str, skin: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([10, 4, 21, 14], fill=rgba(skin))
    d.rectangle([9, 15, 22, 26], fill=rgba(primary))
    d.rectangle([7, 17, 9, 24], fill=rgba(secondary))
    d.rectangle([22, 17, 24, 24], fill=rgba(secondary))
    d.rectangle([10, 26, 13, 31], fill=rgba("#2d313a"))
    d.rectangle([18, 26, 21, 31], fill=rgba("#2d313a"))
    d.point((13, 9), fill=rgba("#111111"))
    d.point((18, 9), fill=rgba("#111111"))
    return img


def make_player(direction: str, frame: int):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.ellipse([10, 4, 21, 14], fill=rgba("#efc6a2"))
    d.rectangle([9, 15, 22, 25], fill=rgba("#2b7fff"))

    arm_shift = 0
    leg_shift = 0
    if frame == 1:
        leg_shift = -1
        arm_shift = 1
    elif frame == 2:
        leg_shift = 1
        arm_shift = -1

    if direction == "left":
        d.polygon([(8, 17), (5 + arm_shift, 20), (8, 23)], fill=rgba("#efc6a2"))
        d.rectangle([22, 17, 24, 23], fill=rgba("#1f5fbf"))
    elif direction == "right":
        d.rectangle([7, 17, 9, 23], fill=rgba("#1f5fbf"))
        d.polygon([(24, 17), (27 + arm_shift, 20), (24, 23)], fill=rgba("#efc6a2"))
    else:
        d.rectangle([7, 17, 9, 23], fill=rgba("#efc6a2"))
        d.rectangle([22, 17, 24, 23], fill=rgba("#efc6a2"))

    if direction == "up":
        d.rectangle([12, 7, 19, 8], fill=rgba("#3c2a1e"))
    else:
        d.rectangle([12, 6, 19, 9], fill=rgba("#3c2a1e"))

    d.rectangle([10, 26 + leg_shift, 13, 31], fill=rgba("#3a3f4d"))
    d.rectangle([18, 26 - leg_shift, 21, 31], fill=rgba("#3a3f4d"))

    return img


def generate_tiles():
    level_palettes = {
        1: ("#5c4a35", "#a47a4d", "#2a1f14"),   # Gate / Lobby
        2: ("#3c4f59", "#8ca6b3", "#1f2a31"),   # Classroom
        3: ("#2f3b45", "#6cc2ff", "#141c24"),   # Lab
        4: ("#2f2d49", "#b3a5ff", "#181527"),   # Server
        5: ("#4a3340", "#ff7aa8", "#23141c"),   # Rooftop
    }

    for lvl in range(1, 6):
        base, accent, detail = level_palettes[lvl]
        save(upscale_tile(make_tile(base, accent, detail, "grid")), TILES_DIR / f"floor_l{lvl}.png")
        save(upscale_tile(make_wall("#2b2f39", accent)), TILES_DIR / f"wall_l{lvl}.png")
        save(upscale_tile(make_tile("#323846", accent, detail, "diag")), TILES_DIR / f"wall_top_l{lvl}.png")
        save(upscale_tile(make_door("#7b4e2f", "#3d2818")), TILES_DIR / f"door_l{lvl}.png")
        save(upscale_tile(make_door("#6b7a36", "#2f3c16")), TILES_DIR / f"door_open_l{lvl}.png")
        save(upscale_tile(make_portal("#1f2a40", accent)), TILES_DIR / f"portal_l{lvl}.png")
        save(upscale_tile(make_stairs("#2b313f", accent)), TILES_DIR / f"stairs_up_l{lvl}.png")

        save(upscale_tile(make_prop("#6e4e32", "#9a734e", "desk")), TILES_DIR / f"desk_l{lvl}.png")
        save(upscale_tile(make_prop("#37404f", "#58d3ff", "computer")), TILES_DIR / f"computer_l{lvl}.png")
        save(upscale_tile(make_prop("#6e4e32", "#57b56b", "plant")), TILES_DIR / f"plant_l{lvl}.png")
        save(upscale_tile(make_prop("#5a3f2b", "#c9a36f", "bookshelf")), TILES_DIR / f"bookshelf_l{lvl}.png")
        save(upscale_tile(make_prop("#4b5766", "#9ab7c7", "lab_table")), TILES_DIR / f"lab_table_l{lvl}.png")
        save(upscale_tile(make_prop("#232a33", "#63e1ff", "server_rack")), TILES_DIR / f"server_rack_l{lvl}.png")
        save(upscale_tile(make_prop("#3c4a59", "#899eb3", "chair")), TILES_DIR / f"chair_l{lvl}.png")
        save(upscale_tile(make_prop("#4d5d73", "#85d8ff", "water_tank")), TILES_DIR / f"water_tank_l{lvl}.png")
        save(upscale_tile(make_prop("#f0cf3b", "#232323", "caution_sign")), TILES_DIR / f"caution_sign_l{lvl}.png")


def generate_sprites():
    npc_schemes = [
        ("#3d72ff", "#2e4da6", "#f0c8a5"),  # Security
        ("#bc4b8a", "#853160", "#efc4a0"),  # Reception
        ("#6b7a36", "#475222", "#eac09b"),  # Teacher
        ("#3e8a8a", "#2c6363", "#f0c8a5"),  # Lab Incharge
        ("#5b4b9c", "#3b2f6b", "#eabf9a"),  # System/Principal
    ]

    for i, (p, s, skin) in enumerate(npc_schemes, start=1):
        save(make_npc(p, s, skin), SPRITES_DIR / f"npc_{i}.png")

    for direction in ("down", "up", "left", "right"):
        for frame in (0, 1, 2):
            save(make_player(direction, frame), SPRITES_DIR / f"player_{direction}_{frame}.png")


def main():
    generate_tiles()
    generate_sprites()
    print("generated_assets_ok")


if __name__ == "__main__":
    main()

import random
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
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4)) + (a,)


def save(img: Image.Image, path: Path):
    img.save(path, format="PNG")


def upscale_tile(img: Image.Image):
    resample_attr = getattr(Image, "Resampling", Image)
    return img.resize((TARGET_TILE, TARGET_TILE), resample=resample_attr.NEAREST)


# ---------------------------------------------------------------------------
#  Indoor tiles (Levels 1-5)
# ---------------------------------------------------------------------------

def make_tile(base: str, accent: str, detail: str, pattern: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(base))
    d = ImageDraw.Draw(img)
    if pattern == "grid":
        for x in range(0, BASE_TILE, 8):
            d.line([(x, 0), (x, BASE_TILE)], fill=rgba(detail, 60), width=1)
        for y in range(0, BASE_TILE, 8):
            d.line([(0, y), (BASE_TILE, y)], fill=rgba(detail, 60), width=1)
    elif pattern == "diag":
        for i in range(-BASE_TILE, BASE_TILE * 2, 6):
            d.line([(i, 0), (i - BASE_TILE, BASE_TILE)], fill=rgba(detail, 55), width=1)
    elif pattern == "speck":
        for y in range(2, BASE_TILE, 6):
            for x in range((y % 4), BASE_TILE, 7):
                d.point((x, y), fill=rgba(detail, 100))
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba(accent, 80), width=1)
    return img


def make_wall(base: str, trim: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(base))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, BASE_TILE - 1, 7], fill=rgba(trim))
    for y in range(10, BASE_TILE, 6):
        d.line([(2, y), (BASE_TILE - 3, y)], fill=rgba(trim, 90), width=1)
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#0f1116", 160), width=1)
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


def make_lift(base: str, accent: str):
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba(base))
    d = ImageDraw.Draw(img)
    d.rectangle([3, 3, BASE_TILE - 4, BASE_TILE - 4], outline=rgba(accent, 190), width=2)
    d.rectangle([7, 6, BASE_TILE - 8, BASE_TILE - 7], fill=rgba("#1a2233", 220), outline=rgba(accent, 140), width=1)
    d.rectangle([13, 11, 18, 16], fill=rgba(accent, 210))
    d.polygon([(16, 20), (11, 25), (14, 25), (14, 29), (18, 29), (18, 25), (21, 25)], fill=rgba("#7de3ff"))
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


# ---------------------------------------------------------------------------
#  NEW: Outdoor / campus tiles for Level 0
# ---------------------------------------------------------------------------

def _scatter_specks(d, color, alpha, seed=42):
    """Scatter subtle pixel specks for texture."""
    rng = random.Random(seed)
    for _ in range(18):
        x = rng.randint(1, BASE_TILE - 2)
        y = rng.randint(1, BASE_TILE - 2)
        d.point((x, y), fill=rgba(color, alpha))


def make_grass():
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#4a8c3f"))
    d = ImageDraw.Draw(img)
    # subtle texture blades
    rng = random.Random(7)
    for _ in range(30):
        x = rng.randint(0, BASE_TILE - 1)
        y = rng.randint(0, BASE_TILE - 1)
        shade = rng.choice(["#5a9e4e", "#3d7a34", "#61ad55", "#408438"])
        d.point((x, y), fill=rgba(shade))
    # occasional tiny flowers
    for _ in range(3):
        x = rng.randint(3, BASE_TILE - 4)
        y = rng.randint(3, BASE_TILE - 4)
        d.point((x, y), fill=rgba("#e8e85a", 140))
    return img


def make_road():
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#3a3a3a"))
    d = ImageDraw.Draw(img)
    _scatter_specks(d, "#4a4a4a", 80, seed=11)
    _scatter_specks(d, "#2e2e2e", 60, seed=22)
    return img


def make_road_dash():
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#3a3a3a"))
    d = ImageDraw.Draw(img)
    _scatter_specks(d, "#4a4a4a", 80, seed=11)
    # center dashed line
    d.rectangle([14, 2, 17, 14], fill=rgba("#d4d4a0", 200))
    d.rectangle([14, 20, 17, 30], fill=rgba("#d4d4a0", 200))
    return img


def make_sidewalk():
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#b8b0a0"))
    d = ImageDraw.Draw(img)
    # paving stone grid
    for x in range(0, BASE_TILE, 16):
        d.line([(x, 0), (x, BASE_TILE)], fill=rgba("#9e9688", 120), width=1)
    for y in range(0, BASE_TILE, 16):
        d.line([(0, y), (BASE_TILE, y)], fill=rgba("#9e9688", 120), width=1)
    _scatter_specks(d, "#a8a090", 50, seed=33)
    return img


def make_fence():
    """Stone campus boundary wall with iron railing top."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#6b6b6b"))
    d = ImageDraw.Draw(img)
    # stone base
    d.rectangle([0, 12, BASE_TILE - 1, BASE_TILE - 1], fill=rgba("#5a5a5a"))
    # mortar lines
    d.line([(0, 16), (BASE_TILE, 16)], fill=rgba("#4a4a4a", 150), width=1)
    d.line([(0, 24), (BASE_TILE, 24)], fill=rgba("#4a4a4a", 150), width=1)
    d.line([(16, 12), (16, BASE_TILE)], fill=rgba("#4a4a4a", 100), width=1)
    # iron top rail
    d.rectangle([0, 0, BASE_TILE - 1, 4], fill=rgba("#2a2a2a"))
    # iron bars
    for x in range(4, BASE_TILE, 8):
        d.line([(x, 0), (x, 11)], fill=rgba("#1e1e1e"), width=2)
    # finial tips
    for x in range(4, BASE_TILE, 8):
        d.polygon([(x - 2, 1), (x, -2), (x + 2, 1)], fill=rgba("#3a3a3a"))
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#1a1a1a", 120), width=1)
    return img


def make_gate_pillar():
    """Thick stone gate pillar."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#7a7a6a"))
    d = ImageDraw.Draw(img)
    # main pillar body
    d.rectangle([4, 2, BASE_TILE - 5, BASE_TILE - 3], fill=rgba("#8a8878"))
    # cap stone
    d.rectangle([2, 0, BASE_TILE - 3, 5], fill=rgba("#9a9888"))
    # base stone
    d.rectangle([2, BASE_TILE - 5, BASE_TILE - 3, BASE_TILE - 1], fill=rgba("#6a6a5a"))
    # mortar detail
    d.line([(8, 8), (8, BASE_TILE - 6)], fill=rgba("#6a6858", 120), width=1)
    d.line([(4, 14), (BASE_TILE - 5, 14)], fill=rgba("#6a6858", 120), width=1)
    d.line([(4, 22), (BASE_TILE - 5, 22)], fill=rgba("#6a6858", 120), width=1)
    d.rectangle([4, 2, BASE_TILE - 5, BASE_TILE - 3], outline=rgba("#3a3a2e", 160), width=1)
    return img


def make_tree():
    """Large leafy tree with brown trunk - fills the tile."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # trunk
    d.rectangle([12, 18, 19, 30], fill=rgba("#5e3b1e"))
    d.rectangle([14, 20, 17, 30], fill=rgba("#6e4b2e"))
    # canopy layers
    d.ellipse([2, 2, 29, 22], fill=rgba("#2d7a2d"))
    d.ellipse([5, 0, 26, 16], fill=rgba("#3d9a3d"))
    d.ellipse([8, 3, 23, 14], fill=rgba("#4aaf4a"))
    # highlight specks
    rng = random.Random(55)
    for _ in range(8):
        x = rng.randint(5, 26)
        y = rng.randint(2, 16)
        d.point((x, y), fill=rgba("#5fc25f", 180))
    return img


def make_parking():
    """Asphalt with white parking line markers."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#3a3a3a"))
    d = ImageDraw.Draw(img)
    _scatter_specks(d, "#4a4a4a", 70, seed=44)
    # white line on left edge
    d.rectangle([0, 0, 2, BASE_TILE - 1], fill=rgba("#d0d0d0", 200))
    # white line on bottom
    d.rectangle([0, BASE_TILE - 3, BASE_TILE - 1, BASE_TILE - 1], fill=rgba("#d0d0d0", 200))
    return img


def make_building():
    """College building facade block - sandstone look."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c8a870"))
    d = ImageDraw.Draw(img)
    # brick pattern
    for y in range(0, BASE_TILE, 8):
        d.line([(0, y), (BASE_TILE, y)], fill=rgba("#b09060", 120), width=1)
        offset = 0 if (y // 8) % 2 == 0 else 16
        for x in range(offset, BASE_TILE + 16, 16):
            d.line([(x, y), (x, y + 7)], fill=rgba("#b09060", 80), width=1)
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#8a7050", 140), width=1)
    return img


def make_building_window():
    """Building facade with window."""
    img = make_building()
    d = ImageDraw.Draw(img)
    # window
    d.rectangle([8, 6, 23, 20], fill=rgba("#2a4060"), outline=rgba("#8a7050"), width=1)
    # window pane cross
    d.line([(16, 6), (16, 20)], fill=rgba("#5a7a9a", 150), width=1)
    d.line([(8, 13), (23, 13)], fill=rgba("#5a7a9a", 150), width=1)
    # sill
    d.rectangle([7, 20, 24, 22], fill=rgba("#9a8a6a"))
    return img


def make_building_door():
    """College entrance door (tall, dark wood with columns)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c8a870"))
    d = ImageDraw.Draw(img)
    # columns on sides
    d.rectangle([2, 0, 7, BASE_TILE - 1], fill=rgba("#a89868"))
    d.rectangle([BASE_TILE - 8, 0, BASE_TILE - 3, BASE_TILE - 1], fill=rgba("#a89868"))
    # door
    d.rectangle([8, 4, BASE_TILE - 9, BASE_TILE - 1], fill=rgba("#4a2a10"))
    d.rectangle([9, 5, BASE_TILE - 10, BASE_TILE - 2], fill=rgba("#5a3a1e"))
    # door handle
    d.ellipse([BASE_TILE - 13, 15, BASE_TILE - 11, 17], fill=rgba("#c8a830"))
    # arch top
    d.arc([8, 0, BASE_TILE - 9, 12], 180, 360, fill=rgba("#4a2a10"), width=2)
    return img


def make_kiosk():
    """Watchman guard booth / kiosk."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # booth body
    d.rectangle([4, 6, 27, 28], fill=rgba("#7a5a30"), outline=rgba("#3a2a10"), width=1)
    # roof
    d.rectangle([2, 3, 29, 7], fill=rgba("#4a3a20"))
    d.rectangle([3, 4, 28, 6], fill=rgba("#5a4a2a"))
    # window opening
    d.rectangle([8, 10, 23, 18], fill=rgba("#2a4060"))
    d.line([(16, 10), (16, 18)], fill=rgba("#5a4a2a"), width=1)
    # counter
    d.rectangle([6, 18, 25, 20], fill=rgba("#6a4a20"))
    return img


def make_flower():
    """Small decorative flower patch on grass."""
    img = make_grass()
    d = ImageDraw.Draw(img)
    rng = random.Random(99)
    colors = ["#e84040", "#e8e040", "#e060e0", "#e88040", "#40a0e8"]
    for _ in range(5):
        x = rng.randint(4, BASE_TILE - 5)
        y = rng.randint(4, BASE_TILE - 5)
        c = rng.choice(colors)
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=rgba(c, 200))
        d.point((x, y), fill=rgba("#f8f880", 220))
    return img


def make_gate_open():
    """Open iron gate segment (walkable)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#b8b0a0"))  # sidewalk base
    d = ImageDraw.Draw(img)
    # paving
    for x in range(0, BASE_TILE, 16):
        d.line([(x, 0), (x, BASE_TILE)], fill=rgba("#9e9688", 80), width=1)
    # gate track grooves in ground
    d.line([(2, 0), (2, BASE_TILE)], fill=rgba("#5a5a5a", 120), width=1)
    d.line([(BASE_TILE - 3, 0), (BASE_TILE - 3, BASE_TILE)], fill=rgba("#5a5a5a", 120), width=1)
    return img


# ---------------------------------------------------------------------------
#  Sprite generators
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
#  Generation entry points
# ---------------------------------------------------------------------------

def generate_tiles():
    level_palettes = {
        1: ("#5c4a35", "#a47a4d", "#2a1f14"),
        2: ("#3c4f59", "#8ca6b3", "#1f2a31"),
        3: ("#2f3b45", "#6cc2ff", "#141c24"),
        4: ("#2f2d49", "#b3a5ff", "#181527"),
        5: ("#4a3340", "#ff7aa8", "#23141c"),
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
        save(upscale_tile(make_lift("#1f2838", accent)), TILES_DIR / f"lift_l{lvl}.png")

        save(upscale_tile(make_prop("#6e4e32", "#9a734e", "desk")), TILES_DIR / f"desk_l{lvl}.png")
        save(upscale_tile(make_prop("#37404f", "#58d3ff", "computer")), TILES_DIR / f"computer_l{lvl}.png")
        save(upscale_tile(make_prop("#6e4e32", "#57b56b", "plant")), TILES_DIR / f"plant_l{lvl}.png")
        save(upscale_tile(make_prop("#5a3f2b", "#c9a36f", "bookshelf")), TILES_DIR / f"bookshelf_l{lvl}.png")
        save(upscale_tile(make_prop("#4b5766", "#9ab7c7", "lab_table")), TILES_DIR / f"lab_table_l{lvl}.png")
        save(upscale_tile(make_prop("#232a33", "#63e1ff", "server_rack")), TILES_DIR / f"server_rack_l{lvl}.png")
        save(upscale_tile(make_prop("#3c4a59", "#899eb3", "chair")), TILES_DIR / f"chair_l{lvl}.png")
        save(upscale_tile(make_prop("#4d5d73", "#85d8ff", "water_tank")), TILES_DIR / f"water_tank_l{lvl}.png")
        save(upscale_tile(make_prop("#f0cf3b", "#232323", "caution_sign")), TILES_DIR / f"caution_sign_l{lvl}.png")

    # ---- NEW outdoor / campus tiles (used by Level 0) ----
    save(upscale_tile(make_grass()), TILES_DIR / "grass.png")
    save(upscale_tile(make_road()), TILES_DIR / "road.png")
    save(upscale_tile(make_road_dash()), TILES_DIR / "road_dash.png")
    save(upscale_tile(make_sidewalk()), TILES_DIR / "sidewalk.png")
    save(upscale_tile(make_fence()), TILES_DIR / "fence.png")
    save(upscale_tile(make_gate_pillar()), TILES_DIR / "gate_pillar.png")
    save(upscale_tile(make_tree()), TILES_DIR / "tree.png")
    save(upscale_tile(make_parking()), TILES_DIR / "parking.png")
    save(upscale_tile(make_building()), TILES_DIR / "building.png")
    save(upscale_tile(make_building_window()), TILES_DIR / "building_window.png")
    save(upscale_tile(make_building_door()), TILES_DIR / "building_door.png")
    save(upscale_tile(make_kiosk()), TILES_DIR / "kiosk.png")
    save(upscale_tile(make_flower()), TILES_DIR / "flower.png")
    save(upscale_tile(make_gate_open()), TILES_DIR / "gate_open.png")


def generate_sprites():
    npc_schemes = [
        ("#3d72ff", "#2e4da6", "#f0c8a5"),
        ("#bc4b8a", "#853160", "#efc4a0"),
        ("#6b7a36", "#475222", "#eac09b"),
        ("#3e8a8a", "#2c6363", "#f0c8a5"),
        ("#5b4b9c", "#3b2f6b", "#eabf9a"),
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

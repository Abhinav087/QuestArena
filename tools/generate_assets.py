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


def crop_to_base_tile(img: Image.Image, center_x: int, center_y: int, sample_size: int = 112):
    """Crop a square sample around a point, then normalize to BASE_TILE."""
    source = img.convert("RGBA")
    size = max(16, int(sample_size))
    if size > source.width:
        size = source.width
    if size > source.height:
        size = source.height

    half = size // 2
    left = max(0, min(source.width - size, center_x - half))
    top = max(0, min(source.height - size, center_y - half))
    box = (left, top, left + size, top + size)

    resample_attr = getattr(Image, "Resampling", Image)
    cropped = source.crop(box)
    return cropped.resize((BASE_TILE, BASE_TILE), resample=resample_attr.BICUBIC)


def generate_building_tiles_from_image():
    """Extract building tiles from user-provided buildingblock.png."""
    source_path = TILES_DIR / "buildingblock.png"
    if not source_path.exists():
        return False

    source = Image.open(source_path).convert("RGBA")
    width, height = source.size

    # Sample points are normalized to source dimensions and tuned for the
    # current college facade artwork.
    sample_points = {
        "building": (0.50, 0.58),
        "building_window": (0.19, 0.47),
        "building_door": (0.50, 0.80),
        "building_roof": (0.50, 0.16),
        "building_column": (0.30, 0.56),
        "building_sign": (0.50, 0.70),
        "building_steps": (0.50, 0.92),
    }

    extracted = {}
    for key, (rx, ry) in sample_points.items():
        cx = int(width * rx)
        cy = int(height * ry)
        extracted[key] = crop_to_base_tile(source, cx, cy, sample_size=112)

    # Primary level-0 building tiles expected by the game.
    save(upscale_tile(extracted["building"]), TILES_DIR / "building.png")
    save(upscale_tile(extracted["building_window"]), TILES_DIR / "building_window.png")
    save(upscale_tile(extracted["building_door"]), TILES_DIR / "building_door.png")

    # Additional reusable tiles derived from the same source image.
    save(upscale_tile(extracted["building_roof"]), TILES_DIR / "building_roof.png")
    save(upscale_tile(extracted["building_column"]), TILES_DIR / "building_column.png")
    save(upscale_tile(extracted["building_sign"]), TILES_DIR / "building_sign.png")
    save(upscale_tile(extracted["building_steps"]), TILES_DIR / "building_steps.png")

    return True


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


def make_lobby_floor():
    """Light cream lobby floor with subtle marble texture – seamless edges."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#e8dcc8"))
    d = ImageDraw.Draw(img)
    rng = random.Random(21)
    for _ in range(28):
        x = rng.randint(0, BASE_TILE - 1)
        y = rng.randint(0, BASE_TILE - 1)
        shade = rng.choice(["#e0d4c0", "#ece2d0", "#ddd0bc", "#e4d8c4"])
        d.point((x, y), fill=rgba(shade))
    # faint paving hint – very low alpha so it tiles seamlessly
    for x in range(0, BASE_TILE, 16):
        d.line([(x, 0), (x, BASE_TILE - 1)], fill=rgba("#d8ccb8", 30), width=1)
    for y in range(0, BASE_TILE, 16):
        d.line([(0, y), (BASE_TILE - 1, y)], fill=rgba("#d8ccb8", 30), width=1)
    # NO outline – seamless tiling
    return img


def make_lobby_wall():
    """Light-coloured lobby wall with warm tones."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c8baa0"))
    d = ImageDraw.Draw(img)
    # wainscot / top band
    d.rectangle([0, 0, BASE_TILE - 1, 6], fill=rgba("#b0a48c"))
    # mortar lines
    for y in range(10, BASE_TILE, 6):
        d.line([(2, y), (BASE_TILE - 3, y)], fill=rgba("#a89880", 90), width=1)
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#8a7e66", 130), width=1)
    return img


# ---------------------------------------------------------------------------
#  Lobby-specific furniture / props  (Level 1)
# ---------------------------------------------------------------------------

def make_sofa():
    """Reddish-brown sofa / couch for the lobby waiting area."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # back rest
    d.rectangle([3, 8, 28, 15], fill=rgba("#9a4040"))
    # seat cushion
    d.rectangle([3, 15, 28, 24], fill=rgba("#b05050"))
    # arm rests
    d.rectangle([2, 10, 5, 25], fill=rgba("#8a3030"))
    d.rectangle([26, 10, 29, 25], fill=rgba("#8a3030"))
    # legs
    d.rectangle([5, 25, 8, 28], fill=rgba("#4a2a1a"))
    d.rectangle([23, 25, 26, 28], fill=rgba("#4a2a1a"))
    # cushion divider
    d.line([(15, 15), (15, 23)], fill=rgba("#7a2828", 120), width=1)
    # outline
    d.rectangle([2, 8, 29, 25], outline=rgba("#5a2020", 140), width=1)
    return img


def make_notice_board():
    """Cork bulletin board with pinned papers."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # wooden frame
    d.rectangle([3, 3, 28, 28], fill=rgba("#c4a060"), outline=rgba("#6a4a20"), width=2)
    # cork surface
    d.rectangle([5, 5, 26, 26], fill=rgba("#d4b878"))
    # pinned papers
    d.rectangle([7, 7, 14, 13], fill=rgba("#f0f0e0"))
    d.rectangle([16, 8, 23, 12], fill=rgba("#e0e8f0"))
    d.rectangle([8, 15, 15, 21], fill=rgba("#f0e8d0"))
    d.rectangle([17, 16, 24, 22], fill=rgba("#e8f0e0"))
    # push pins
    d.ellipse([9, 6, 11, 8], fill=rgba("#e04040"))
    d.ellipse([18, 7, 20, 9], fill=rgba("#4040e0"))
    d.ellipse([10, 14, 12, 16], fill=rgba("#40c040"))
    d.ellipse([19, 15, 21, 17], fill=rgba("#e0c040"))
    return img


def make_reception_counter():
    """Large wooden reception counter / front desk."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # counter top surface
    d.rectangle([1, 8, 30, 14], fill=rgba("#9a7a4a"))
    # front panel
    d.rectangle([1, 14, 30, 27], fill=rgba("#7a5a2a"))
    # panel detail lines
    d.line([(1, 20), (30, 20)], fill=rgba("#6a4a1a"), width=1)
    # top surface highlight
    d.rectangle([2, 8, 29, 10], fill=rgba("#aa8a5a"))
    # paper on counter
    d.rectangle([10, 10, 18, 13], fill=rgba("#f0ece0"))
    # outline
    d.rectangle([1, 8, 30, 27], outline=rgba("#4a2a10", 180), width=1)
    return img


def make_diamond_floor():
    """Lobby floor tile with decorative diamond / rhombus inlay."""
    img = make_lobby_floor()
    d = ImageDraw.Draw(img)
    cx, cy = BASE_TILE // 2, BASE_TILE // 2
    # outer diamond
    d.polygon(
        [(cx, cy - 13), (cx + 13, cy), (cx, cy + 13), (cx - 13, cy)],
        fill=rgba("#d8c8a4"), outline=rgba("#b0a078"), width=1,
    )
    # inner diamond
    d.polygon(
        [(cx, cy - 8), (cx + 8, cy), (cx, cy + 8), (cx - 8, cy)],
        fill=rgba("#ccb890"), outline=rgba("#a09068", 140), width=1,
    )
    return img


def make_bench():
    """Simple wooden bench for the lobby."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # seat plank
    d.rectangle([3, 16, 28, 22], fill=rgba("#7a5a3a"))
    d.rectangle([3, 16, 28, 18], fill=rgba("#8a6a4a"))
    # legs
    d.rectangle([5, 22, 8, 28], fill=rgba("#5a3a1e"))
    d.rectangle([23, 22, 26, 28], fill=rgba("#5a3a1e"))
    # seat detail
    d.line([(5, 20), (26, 20)], fill=rgba("#6a4a2a"), width=1)
    # outline
    d.rectangle([3, 16, 28, 22], outline=rgba("#3a2a10", 120), width=1)
    return img


# ---------------------------------------------------------------------------
#  Classroom-specific tiles (Level 2)
# ---------------------------------------------------------------------------

def make_classroom_floor():
    """Warm brick / parquet classroom floor matching reference image."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c8a878"))
    d = ImageDraw.Draw(img)
    # brick pattern (horizontal)
    for y in range(0, BASE_TILE, 8):
        d.line([(0, y), (BASE_TILE, y)], fill=rgba("#b89868", 100), width=1)
        offset = 0 if (y // 8) % 2 == 0 else 16
        for x in range(offset, BASE_TILE + 16, 16):
            d.line([(x, y), (x, y + 7)], fill=rgba("#b89868", 70), width=1)
    # subtle specks for texture
    rng = random.Random(77)
    for _ in range(12):
        x = rng.randint(1, BASE_TILE - 2)
        y = rng.randint(1, BASE_TILE - 2)
        d.point((x, y), fill=rgba("#b09060", 80))
    return img


def make_classroom_wall():
    """Beige / cream classroom wall border."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#d8ccb0"))
    d = ImageDraw.Draw(img)
    # wainscot band at top
    d.rectangle([0, 0, BASE_TILE - 1, 5], fill=rgba("#c8bca0"))
    # brick mortar lines
    for y in range(8, BASE_TILE, 6):
        d.line([(1, y), (BASE_TILE - 2, y)], fill=rgba("#beb298", 90), width=1)
    for y in range(8, BASE_TILE, 12):
        for x in range(0, BASE_TILE, 16):
            d.line([(x, y), (x, y + 5)], fill=rgba("#beb298", 60), width=1)
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#9a8e76", 130), width=1)
    return img


def make_chalkboard():
    """Dark green chalkboard tile for classroom wall."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#d8ccb0"))  # wall base
    d = ImageDraw.Draw(img)
    # wooden frame
    d.rectangle([1, 4, BASE_TILE - 2, BASE_TILE - 4], fill=rgba("#6a4a2a"))
    # green board surface
    d.rectangle([3, 6, BASE_TILE - 4, BASE_TILE - 6], fill=rgba("#2a5a3a"))
    # chalk tray
    d.rectangle([3, BASE_TILE - 6, BASE_TILE - 4, BASE_TILE - 4], fill=rgba("#7a5a3a"))
    # chalk marks (faint writing)
    d.line([(6, 10), (16, 10)], fill=rgba("#e8e8e0", 80), width=1)
    d.line([(8, 14), (22, 14)], fill=rgba("#e8e8e0", 60), width=1)
    d.line([(5, 18), (18, 18)], fill=rgba("#e8e8e0", 50), width=1)
    # chalk piece on tray
    d.rectangle([10, BASE_TILE - 6, 14, BASE_TILE - 5], fill=rgba("#f0f0e0"))
    return img


def make_chalkboard_large():
    """Large combined chalkboard: 8 tiles wide × 2 tiles tall as one board."""
    w = BASE_TILE * 8
    h = BASE_TILE * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))  # transparent background
    d = ImageDraw.Draw(img)
    # Wooden frame (outer)
    d.rectangle([2, 3, w - 3, h - 3], fill=rgba("#6a4a2a"))
    # Green board surface
    d.rectangle([6, 7, w - 7, h - 7], fill=rgba("#2a5a3a"))
    # Inner green shade variation for depth
    d.rectangle([10, 10, w - 11, h - 10], fill=rgba("#305f40"))
    # Chalk tray at bottom
    d.rectangle([6, h - 9, w - 7, h - 5], fill=rgba("#7a5a3a"))
    # Chalk marks (faint writing)
    d.line([(20, 16), (90, 16)], fill=rgba("#e8e8e0", 80), width=1)
    d.line([(30, 24), (130, 24)], fill=rgba("#e8e8e0", 65), width=1)
    d.line([(22, 32), (100, 32)], fill=rgba("#e8e8e0", 50), width=1)
    d.line([(140, 18), (210, 18)], fill=rgba("#e8e8e0", 75), width=1)
    d.line([(150, 26), (230, 26)], fill=rgba("#e8e8e0", 55), width=1)
    d.line([(120, 36), (200, 36)], fill=rgba("#e8e8e0", 45), width=1)
    # Chalk piece on tray
    d.rectangle([80, h - 9, 88, h - 7], fill=rgba("#f0f0e0"))
    d.rectangle([160, h - 9, 166, h - 7], fill=rgba("#f0e0c0"))
    # Upscale to target size
    resample_attr = getattr(Image, "Resampling", Image)
    return img.resize((w * 2, h * 2), resample=resample_attr.NEAREST)


def make_student_desk():
    """Small brown student desk with dark chair backing (top-down view)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # chair (back part, top of sprite)
    d.rectangle([6, 3, 25, 8], fill=rgba("#3a2a1a"))
    # desk surface (brown)
    d.rectangle([4, 10, 27, 22], fill=rgba("#8a6a40"))
    d.rectangle([4, 10, 27, 12], fill=rgba("#9a7a50"))  # top edge lighter
    # desk outline
    d.rectangle([4, 10, 27, 22], outline=rgba("#4a3a1e", 160), width=1)
    # desk legs (visible below)
    d.rectangle([5, 22, 8, 26], fill=rgba("#5a3a1e"))
    d.rectangle([23, 22, 26, 26], fill=rgba("#5a3a1e"))
    # chair seat
    d.rectangle([8, 5, 23, 10], fill=rgba("#4a3020"))
    return img


def make_teacher_desk():
    """Teacher's larger desk (top-down view, with paper)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # desk surface
    d.rectangle([2, 6, 29, 25], fill=rgba("#7a5a30"))
    d.rectangle([2, 6, 29, 9], fill=rgba("#8a6a40"))  # top edge lighter
    # front panel
    d.rectangle([3, 15, 28, 24], fill=rgba("#6a4a20"))
    # outline
    d.rectangle([2, 6, 29, 25], outline=rgba("#3a2a10", 160), width=1)
    # paper on desk
    d.rectangle([8, 10, 16, 15], fill=rgba("#f0ece0"))
    # pen
    d.line([(18, 11), (23, 14)], fill=rgba("#1a1a3a"), width=1)
    # legs
    d.rectangle([4, 25, 7, 29], fill=rgba("#5a3a1e"))
    d.rectangle([24, 25, 27, 29], fill=rgba("#5a3a1e"))
    return img


def make_student_npc(primary: str, secondary: str, skin: str, hair: str, is_girl: bool):
    """Student NPC sprite - boys in shirt+pants, girls in uniform dress."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # head
    d.ellipse([10, 3, 21, 13], fill=rgba(skin))
    # hair
    if is_girl:
        # longer hair
        d.ellipse([9, 2, 22, 10], fill=rgba(hair))
        d.rectangle([9, 6, 11, 16], fill=rgba(hair))
        d.rectangle([20, 6, 22, 16], fill=rgba(hair))
    else:
        # short hair
        d.rectangle([10, 2, 21, 8], fill=rgba(hair))
    # body
    d.rectangle([9, 14, 22, 25], fill=rgba(primary))
    if is_girl:
        # skirt flare
        d.polygon([(8, 20), (10, 14), (21, 14), (23, 20)], fill=rgba(secondary))
        d.rectangle([9, 20, 22, 26], fill=rgba(secondary))
    # arms
    d.rectangle([7, 16, 9, 23], fill=rgba(skin))
    d.rectangle([22, 16, 24, 23], fill=rgba(skin))
    # legs
    d.rectangle([10, 26, 13, 31], fill=rgba("#2d2d30"))
    d.rectangle([18, 26, 21, 31], fill=rgba("#2d2d30"))
    # eyes
    d.point((13, 8), fill=rgba("#111111"))
    d.point((18, 8), fill=rgba("#111111"))
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
#  Lab tiles (Level 3) – computer lab matching reference image
# ---------------------------------------------------------------------------

def make_lab_floor():
    """Dark blue-grey floor for the computer lab."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#3e4a58"))
    d = ImageDraw.Draw(img)
    rng = random.Random(88)
    for _ in range(20):
        x = rng.randint(0, BASE_TILE - 1)
        y = rng.randint(0, BASE_TILE - 1)
        shade = rng.choice(["#3a4654", "#42505e", "#384252", "#44525f"])
        d.point((x, y), fill=rgba(shade))
    for x in range(0, BASE_TILE, 16):
        d.line([(x, 0), (x, BASE_TILE - 1)], fill=rgba("#36424e", 30), width=1)
    for y in range(0, BASE_TILE, 16):
        d.line([(0, y), (BASE_TILE - 1, y)], fill=rgba("#36424e", 30), width=1)
    return img


def make_lab_wall():
    """Dark wall for lab border."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#2c3440"))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, BASE_TILE - 1, 5], fill=rgba("#242c36"))
    for y in range(8, BASE_TILE, 6):
        d.line([(1, y), (BASE_TILE - 2, y)], fill=rgba("#252d38", 90), width=1)
    d.rectangle([0, 0, BASE_TILE - 1, BASE_TILE - 1], outline=rgba("#1a2028", 160), width=1)
    return img


def make_lab_partition():
    """Grey cubicle partition wall between workstation rows (top-down)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Main body
    d.rectangle([0, 4, BASE_TILE - 1, BASE_TILE - 4], fill=rgba("#8a9098"))
    # Top face – lighter for 3-D look
    d.rectangle([0, 4, BASE_TILE - 1, 10], fill=rgba("#a0a8b0"))
    # Bottom shadow edge
    d.rectangle([0, BASE_TILE - 6, BASE_TILE - 1, BASE_TILE - 4], fill=rgba("#707880"))
    # Vertical seam lines
    for x in range(8, BASE_TILE, 10):
        d.line([(x, 5), (x, BASE_TILE - 5)], fill=rgba("#7a8088", 70), width=1)
    return img


def make_lab_monitor():
    """Desk surface with a computer monitor, keyboard and mouse (top-down)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Desk surface
    d.rectangle([0, 6, BASE_TILE - 1, BASE_TILE - 1], fill=rgba("#a89878"))
    d.rectangle([0, 6, BASE_TILE - 1, 8], fill=rgba("#b8a888"))
    # Monitor frame
    d.rectangle([4, 0, BASE_TILE - 5, 16], fill=rgba("#2a2a2a"))
    # Monitor screen
    d.rectangle([6, 2, BASE_TILE - 7, 13], fill=rgba("#4488cc"))
    d.rectangle([7, 3, BASE_TILE - 12, 6], fill=rgba("#5599dd", 100))
    # Monitor stand
    d.rectangle([12, 16, 19, 19], fill=rgba("#3a3a3a"))
    # Keyboard
    d.rectangle([5, 21, 26, 27], fill=rgba("#3a3a3a"))
    d.rectangle([6, 22, 25, 26], fill=rgba("#4a4a4a"))
    # Mouse
    d.ellipse([BASE_TILE - 8, 22, BASE_TILE - 4, 28], fill=rgba("#4a4a4a"))
    return img


def make_lab_items():
    """Desk surface with CPU tower, books, coffee cup and pen."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Desk surface
    d.rectangle([0, 6, BASE_TILE - 1, BASE_TILE - 1], fill=rgba("#a89878"))
    d.rectangle([0, 6, BASE_TILE - 1, 8], fill=rgba("#b8a888"))
    # Small CPU / tower
    d.rectangle([2, 0, 10, 18], fill=rgba("#2a2a30"))
    d.rectangle([3, 2, 9, 16], fill=rgba("#3a3a40"))
    d.rectangle([4, 4, 8, 6], fill=rgba("#5588aa"))  # LED strip
    # Book stack
    d.rectangle([14, 10, 22, 14], fill=rgba("#cc4444"))
    d.rectangle([13, 14, 21, 18], fill=rgba("#4444cc"))
    # Coffee cup
    d.ellipse([24, 20, 30, 26], fill=rgba("#ddd8d0"))
    d.ellipse([25, 21, 29, 25], fill=rgba("#6a4a2a"))
    # Pen
    d.line([(16, 22), (24, 26)], fill=rgba("#1a1a3a"), width=1)
    return img


def make_lab_office_chair():
    """Office swivel chair seen from above."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 5-star base legs
    for lx in (6, 14, 23):
        d.rectangle([lx, 27, lx + 3, 31], fill=rgba("#4a4a4a"))
    d.rectangle([8, 30, 23, 31], fill=rgba("#4a4a4a"))
    # Seat cushion
    d.ellipse([6, 8, 25, 24], fill=rgba("#3a3a42"))
    d.ellipse([8, 10, 23, 22], fill=rgba("#444450"))
    # Backrest
    d.rectangle([8, 4, 23, 12], fill=rgba("#2a2a32"))
    d.rectangle([9, 5, 22, 11], fill=rgba("#3a3a44"))
    # Armrests
    d.rectangle([4, 10, 8, 20], fill=rgba("#3a3a42"))
    d.rectangle([23, 10, 27, 20], fill=rgba("#3a3a42"))
    return img


def make_lab_teacher_desk():
    """Instructor desk with laptop (top-down)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Desk surface
    d.rectangle([1, 4, 30, 27], fill=rgba("#7a5a30"))
    d.rectangle([1, 4, 30, 7], fill=rgba("#8a6a40"))
    d.rectangle([2, 17, 29, 26], fill=rgba("#6a4a20"))
    d.rectangle([1, 4, 30, 27], outline=rgba("#3a2a10", 160), width=1)
    # Laptop base
    d.rectangle([8, 8, 23, 18], fill=rgba("#2a2a30"))
    # Laptop screen
    d.rectangle([9, 3, 22, 14], fill=rgba("#303038"))
    d.rectangle([10, 4, 21, 12], fill=rgba("#4488bb"))
    d.rectangle([11, 5, 17, 8], fill=rgba("#5599cc", 100))
    # Laptop keyboard detail
    d.rectangle([10, 15, 21, 17], fill=rgba("#3a3a40"))
    return img


def make_lab_shelf():
    """Small wall shelf / supply cabinet."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([3, 8, 28, 24], fill=rgba("#6a5030"))
    d.rectangle([3, 8, 28, 10], fill=rgba("#7a6040"))
    d.line([(4, 16), (27, 16)], fill=rgba("#5a4020"), width=1)
    # Books on upper shelf
    d.rectangle([6, 10, 10, 15], fill=rgba("#cc6644"))
    d.rectangle([12, 11, 15, 15], fill=rgba("#4466cc"))
    d.rectangle([17, 10, 21, 15], fill=rgba("#44aa66"))
    # Items on lower shelf
    d.rectangle([8, 17, 14, 22], fill=rgba("#ddcc88"))
    d.rectangle([18, 17, 22, 22], fill=rgba("#888888"))
    d.rectangle([3, 8, 28, 24], outline=rgba("#3a2a10", 140), width=1)
    return img


def make_lab_chalkboard_large():
    """Lab chalkboard: 5 tiles wide x 1 tile tall."""
    w = BASE_TILE * 5
    h = BASE_TILE * 1
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Wooden frame
    d.rectangle([2, 2, w - 3, h - 3], fill=rgba("#6a4a2a"))
    # Green board surface
    d.rectangle([5, 4, w - 6, h - 5], fill=rgba("#2a5a3a"))
    d.rectangle([7, 6, w - 8, h - 7], fill=rgba("#305f40"))
    # Chalk marks
    d.line([(14, 10), (60, 10)], fill=rgba("#e8e8e0", 70), width=1)
    d.line([(22, 16), (80, 16)], fill=rgba("#e8e8e0", 55), width=1)
    d.line([(90, 12), (140, 12)], fill=rgba("#e8e8e0", 60), width=1)
    # Chalk tray
    d.rectangle([5, h - 6, w - 6, h - 4], fill=rgba("#7a5a3a"))
    d.rectangle([50, h - 6, 56, h - 5], fill=rgba("#f0f0e0"))
    resample_attr = getattr(Image, "Resampling", Image)
    return img.resize((w * 2, h * 2), resample=resample_attr.NEAREST)


# ---------------------------------------------------------------------------
#  Server Room tiles (Level 4)
#  Palette: light grey raised-floor, dark racks, visible infrastructure
# ---------------------------------------------------------------------------

def make_server_rack():
    """Server rack unit — dark cabinet with front panel LEDs on light floor."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor beneath
    d.rectangle([0, 0, 31, 31], fill=rgba("#c8cdd5"))
    # Rack cabinet body (dark steel)
    d.rectangle([5, 2, 26, 29], fill=rgba("#1e2430"), outline=rgba("#0e1420"), width=1)
    # Front panel face (slightly lighter)
    d.rectangle([7, 4, 24, 27], fill=rgba("#282e3c"))
    # Rack unit horizontal dividers (equipment slots)
    for y in range(6, 26, 4):
        d.line([(7, y), (24, y)], fill=rgba("#1a2028"), width=1)
    # Status LEDs on each unit (green/amber)
    for y in range(8, 26, 4):
        d.ellipse([9, y, 11, y + 2], fill=rgba("#33ff55"))     # green OK
        d.ellipse([13, y, 15, y + 2], fill=rgba("#33ff55"))    # green OK
        d.rectangle([17, y, 23, y + 1], fill=rgba("#3388ff", 120))  # blue activity bar
    # Front mesh vents
    for y in range(5, 27, 2):
        d.line([(8, y), (23, y)], fill=rgba("#1e2430", 80), width=1)
    # Top cap
    d.rectangle([5, 2, 26, 3], fill=rgba("#3a4050"))
    # Bottom feet
    d.rectangle([7, 28, 10, 29], fill=rgba("#3a4050"))
    d.rectangle([21, 28, 24, 29], fill=rgba("#3a4050"))
    return img


def make_server_floor():
    """Light grey raised-floor panels with grid lines and screw dots (matches ref image 1)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light grey base
    d.rectangle([0, 0, 31, 31], fill=rgba("#c8cdd5"))
    # Panel edge grid lines
    d.line([(0, 0), (31, 0)], fill=rgba("#a8b0ba"), width=1)
    d.line([(0, 31), (31, 31)], fill=rgba("#a8b0ba"), width=1)
    d.line([(0, 0), (0, 31)], fill=rgba("#a8b0ba"), width=1)
    d.line([(31, 0), (31, 31)], fill=rgba("#a8b0ba"), width=1)
    # Inner highlight for panel depth
    d.line([(1, 1), (30, 1)], fill=rgba("#d5dae2"), width=1)
    d.line([(1, 1), (1, 30)], fill=rgba("#d5dae2"), width=1)
    # Corner screws
    for cx, cy in [(4, 4), (27, 4), (4, 27), (27, 27)]:
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=rgba("#9aa2ad"))
    return img


def make_server_wall():
    """Dark steel wall panel with rivets — clearly distinct from light floor."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark steel base
    d.rectangle([0, 0, 31, 31], fill=rgba("#3a4050"))
    # Panel grooves
    d.rectangle([1, 1, 30, 30], outline=rgba("#4a5464"), width=1)
    d.rectangle([3, 3, 28, 28], outline=rgba("#2e3644"), width=1)
    # Rivets
    for cx, cy in [(5, 5), (26, 5), (5, 26), (26, 26)]:
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=rgba("#5a6474"))
    # Horizontal panel seam
    d.line([(0, 15), (31, 15)], fill=rgba("#2e3644"), width=1)
    d.line([(0, 16), (31, 16)], fill=rgba("#4a5464"), width=1)
    return img


def make_server_console():
    """Monitoring desk with screen — brown desk, dark monitor with green text."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor beneath
    d.rectangle([0, 0, 31, 31], fill=rgba("#c8cdd5"))
    # Desk surface (brown wood, like image 1)
    d.rectangle([2, 14, 29, 28], fill=rgba("#8a6a3e"))
    d.rectangle([2, 14, 29, 16], fill=rgba("#9a7a4e"))
    d.rectangle([2, 27, 29, 28], fill=rgba("#6a5030"))
    # Monitor body
    d.rectangle([6, 3, 25, 15], fill=rgba("#2a2a30"), outline=rgba("#1a1a20"), width=1)
    # Screen
    d.rectangle([8, 5, 23, 13], fill=rgba("#0a1818"))
    # Screen content (green text lines like server terminals)
    for sy in range(6, 12, 2):
        w = random.randint(6, 13)
        d.line([(9, sy), (9 + w, sy)], fill=rgba("#33ff88", 180), width=1)
    # LED on desk
    d.ellipse([5, 18, 7, 20], fill=rgba("#33ff33"))
    d.ellipse([9, 18, 11, 20], fill=rgba("#ffaa00"))
    return img


def make_server_pipe():
    """Vertical coolant pipe on light floor background."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor behind pipe
    d.rectangle([0, 0, 31, 31], fill=rgba("#b0b8c2"))
    # Shadow under pipe
    d.rectangle([12, 0, 20, 31], fill=rgba("#9aa2ad", 80))
    # Main pipe (steel grey)
    d.rectangle([12, 0, 18, 31], fill=rgba("#6a7585"))
    # Pipe highlight (reflection strip)
    d.rectangle([13, 0, 15, 31], fill=rgba("#8a95a5"))
    # Pipe joints
    for y in (5, 17):
        d.rectangle([10, y, 20, y + 3], fill=rgba("#7a8595"))
        d.rectangle([10, y, 20, y], fill=rgba("#8a99aa"))
        d.rectangle([10, y + 3, 20, y + 3], fill=rgba("#5a6575"))
    return img


def make_server_grate():
    """Floor vent grate — darker strip with visible metal grid pattern."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark background (visible gap beneath floor)
    d.rectangle([0, 0, 31, 31], fill=rgba("#3a4048"))
    # Metal grate bars (silver/grey)
    for x in range(1, 30, 3):
        d.rectangle([x, 0, x + 1, 31], fill=rgba("#7a8494"))
    for y in range(1, 30, 3):
        d.rectangle([0, y, 31, y + 1], fill=rgba("#7a8494"))
    # Slight blue tint from cold air
    d.rectangle([0, 0, 31, 31], fill=rgba("#4080ff", 18))
    # Edge trim
    d.line([(0, 0), (31, 0)], fill=rgba("#8a94a5"), width=1)
    d.line([(0, 31), (31, 31)], fill=rgba("#8a94a5"), width=1)
    return img


def make_server_cable():
    """Cable tray — light floor with visible colored cable bundle running through."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor beneath
    d.rectangle([0, 0, 31, 31], fill=rgba("#c0c6ce"))
    # Cable tray (dark metallic channel)
    d.rectangle([11, 0, 20, 31], fill=rgba("#505a68"))
    d.rectangle([11, 0, 11, 31], fill=rgba("#6a7484"))
    d.rectangle([20, 0, 20, 31], fill=rgba("#6a7484"))
    # Individual cables (colored)
    d.line([(13, 0), (13, 31)], fill=rgba("#4466dd"), width=1)
    d.line([(15, 0), (15, 31)], fill=rgba("#dd4444"), width=1)
    d.line([(17, 0), (17, 31)], fill=rgba("#44bb44"), width=1)
    d.line([(19, 0), (19, 31)], fill=rgba("#ddaa22"), width=1)
    return img


def make_server_ups():
    """UPS / battery backup unit on light floor."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor beneath
    d.rectangle([0, 0, 31, 31], fill=rgba("#c8cdd5"))
    # UPS cabinet body (dark grey)
    d.rectangle([4, 3, 27, 28], fill=rgba("#2a3040"), outline=rgba("#1a2030"), width=1)
    # Front panel (slightly lighter)
    d.rectangle([6, 5, 25, 26], fill=rgba("#343e50"))
    # LCD display (blue backlit)
    d.rectangle([8, 7, 23, 13], fill=rgba("#0a1828"), outline=rgba("#3a5070"), width=1)
    d.rectangle([10, 9, 21, 11], fill=rgba("#33bbff", 160))
    # LED indicators (green = ok, amber = battery)
    d.ellipse([9, 16, 12, 19], fill=rgba("#33ff33"))
    d.ellipse([14, 16, 17, 19], fill=rgba("#33ff33"))
    d.ellipse([19, 16, 22, 19], fill=rgba("#ffaa00"))
    # Ventilation slots
    for y in range(21, 26, 2):
        d.line([(8, y), (23, y)], fill=rgba("#1a2535"), width=1)
    return img


def make_server_ac():
    """AC / cooling unit mounted on dark wall — white unit stands out."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Wall background
    d.rectangle([0, 0, 31, 31], fill=rgba("#3a4050"))
    # AC unit body (white/light grey — contrasts against wall)
    d.rectangle([3, 8, 28, 26], fill=rgba("#e0e6ec"), outline=rgba("#a0aab5"), width=1)
    # Vents (horizontal slats)
    for y in range(12, 24, 3):
        d.line([(5, y), (26, y)], fill=rgba("#b8c2cc"), width=1)
        d.line([(5, y + 1), (26, y + 1)], fill=rgba("#d0d8e0"), width=1)
    # Status light (blue LED)
    d.ellipse([13, 9, 16, 11], fill=rgba("#33ccff"))
    # Label
    d.rectangle([10, 24, 21, 25], fill=rgba("#c0c8d0"))
    return img


def make_server_light():
    """Ceiling LED indicator glow on light floor — subtle green circle."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor
    d.rectangle([0, 0, 31, 31], fill=rgba("#c8cdd5"))
    # Glow ring
    d.ellipse([8, 8, 23, 23], fill=rgba("#33ff66", 25))
    d.ellipse([11, 11, 20, 20], fill=rgba("#33ff66", 45))
    # Central LED point
    d.ellipse([14, 14, 17, 17], fill=rgba("#33ff88", 200))
    return img


def make_server_cable_h():
    """Horizontal cable tray on light floor — rotated version of vertical cable."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Light floor beneath
    d.rectangle([0, 0, 31, 31], fill=rgba("#c0c6ce"))
    # Cable tray (dark metallic channel) — horizontal
    d.rectangle([0, 11, 31, 20], fill=rgba("#505a68"))
    d.line([(0, 11), (31, 11)], fill=rgba("#6a7484"), width=1)
    d.line([(0, 20), (31, 20)], fill=rgba("#6a7484"), width=1)
    # Individual cables (colored)
    d.line([(0, 13), (31, 13)], fill=rgba("#4466dd"), width=1)
    d.line([(0, 15), (31, 15)], fill=rgba("#dd4444"), width=1)
    d.line([(0, 17), (31, 17)], fill=rgba("#44bb44"), width=1)
    d.line([(0, 19), (31, 19)], fill=rgba("#ddaa22"), width=1)
    return img


def make_server_floor_center():
    """Lighter raised-floor for center monitoring area with dashed border."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Brighter floor
    d.rectangle([0, 0, 31, 31], fill=rgba("#d8dde5"))
    # Panel edge grid
    d.line([(0, 0), (31, 0)], fill=rgba("#c0c8d2"), width=1)
    d.line([(0, 31), (31, 31)], fill=rgba("#c0c8d2"), width=1)
    d.line([(0, 0), (0, 31)], fill=rgba("#c0c8d2"), width=1)
    d.line([(31, 0), (31, 31)], fill=rgba("#c0c8d2"), width=1)
    # Inner highlight
    d.line([(1, 1), (30, 1)], fill=rgba("#e0e5ed"), width=1)
    d.line([(1, 1), (1, 30)], fill=rgba("#e0e5ed"), width=1)
    # Corner screws
    for cx, cy in [(4, 4), (27, 4), (4, 27), (27, 27)]:
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=rgba("#b0b8c2"))
    return img


def make_server_panel():
    """Electrical distribution panel on dark wall background."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Wall background
    d.rectangle([0, 0, 31, 31], fill=rgba("#3a4050"))
    # Panel cabinet body
    d.rectangle([3, 3, 28, 28], fill=rgba("#4a5464"), outline=rgba("#3a4050"), width=1)
    # Inner panel face
    d.rectangle([5, 5, 26, 26], fill=rgba("#505a6a"))
    # Circuit breaker rows
    for y in range(7, 24, 4):
        for x in range(7, 24, 5):
            d.rectangle([x, y, x + 3, y + 2], fill=rgba("#2a3040"))
    # Status LEDs
    d.ellipse([7, 5, 9, 7], fill=rgba("#33ff33"))
    d.ellipse([11, 5, 13, 7], fill=rgba("#ff3333"))
    # Warning stripe at bottom
    for x in range(5, 25, 4):
        d.rectangle([x, 25, x + 1, 27], fill=rgba("#ddaa00"))
    return img


def make_server_fan():
    """Cooling fan / exhaust vent unit on wall."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Wall background
    d.rectangle([0, 0, 31, 31], fill=rgba("#3a4050"))
    # Fan housing (square mount)
    d.rectangle([2, 2, 29, 29], fill=rgba("#2a3040"), outline=rgba("#4a5464"), width=1)
    # Circular fan opening
    d.ellipse([4, 4, 27, 27], fill=rgba("#3a4450"), outline=rgba("#5a6474"), width=1)
    # Fan blades
    cx, cy = 15, 15
    d.line([(cx, cy - 9), (cx, cy + 9)], fill=rgba("#6a7488"), width=2)
    d.line([(cx - 9, cy), (cx + 9, cy)], fill=rgba("#6a7488"), width=2)
    d.line([(cx - 6, cy - 6), (cx + 6, cy + 6)], fill=rgba("#6a7488"), width=1)
    d.line([(cx - 6, cy + 6), (cx + 6, cy - 6)], fill=rgba("#6a7488"), width=1)
    # Center hub
    d.ellipse([12, 12, 19, 19], fill=rgba("#5a6478"))
    # Outer grill ring
    d.ellipse([6, 6, 25, 25], outline=rgba("#5a6478"), width=1)
    return img


def make_server_wall_blue():
    """Wall panel with blue LED accent strip along edge."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark wall base
    d.rectangle([0, 0, 31, 31], fill=rgba("#3a4050"))
    # Panel grooves
    d.rectangle([1, 1, 30, 30], outline=rgba("#4a5464"), width=1)
    d.rectangle([3, 3, 28, 28], outline=rgba("#2e3644"), width=1)
    # Blue LED strip along right edge (vertical accent)
    d.rectangle([29, 0, 31, 31], fill=rgba("#1188ff", 100))
    d.rectangle([30, 0, 31, 31], fill=rgba("#33aaff", 180))
    # Blue glow bleed
    d.rectangle([27, 0, 29, 31], fill=rgba("#2266cc", 35))
    # Horizontal seam
    d.line([(0, 15), (28, 15)], fill=rgba("#2e3644"), width=1)
    d.line([(0, 16), (28, 16)], fill=rgba("#4a5464"), width=1)
    # Rivets
    for cx, cy in [(5, 5), (24, 5), (5, 26), (24, 26)]:
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=rgba("#5a6474"))
    return img


# ---------------------------------------------------------------------------
#  Rooftop tiles (Level 5)
#  Palette: light grey concrete panels, chain-link fence, HVAC, city skyline
# ---------------------------------------------------------------------------

def make_roof_floor():
    """Light grey concrete roof panel with subtle grid seams – matches reference."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))
    d = ImageDraw.Draw(img)
    # Panel edge grid lines (subtle mortar / expansion joints)
    d.line([(0, 0), (31, 0)], fill=rgba("#b0ada4"), width=1)
    d.line([(0, 31), (31, 31)], fill=rgba("#b0ada4"), width=1)
    d.line([(0, 0), (0, 31)], fill=rgba("#b0ada4"), width=1)
    d.line([(31, 0), (31, 31)], fill=rgba("#b0ada4"), width=1)
    # Inner highlight for panel depth
    d.line([(1, 1), (30, 1)], fill=rgba("#ccc9c0"), width=1)
    d.line([(1, 1), (1, 30)], fill=rgba("#ccc9c0"), width=1)
    # Subtle speck texture
    rng = random.Random(501)
    for _ in range(18):
        x = rng.randint(2, 29)
        y = rng.randint(2, 29)
        shade = rng.choice(["#b8b5ac", "#c4c1b8", "#bcb9b0", "#c8c5bc"])
        d.point((x, y), fill=rgba(shade))
    return img


def make_roof_wall():
    """Concrete parapet wall / roof edge — dark grey block."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#6a6e72"))
    d = ImageDraw.Draw(img)
    # Top cap stone
    d.rectangle([0, 0, 31, 4], fill=rgba("#7a7e82"))
    # Mortar lines
    d.line([(0, 10), (31, 10)], fill=rgba("#5a5e62", 120), width=1)
    d.line([(0, 20), (31, 20)], fill=rgba("#5a5e62", 120), width=1)
    d.line([(16, 4), (16, 31)], fill=rgba("#5a5e62", 80), width=1)
    # Outline
    d.rectangle([0, 0, 31, 31], outline=rgba("#4a4e52", 160), width=1)
    return img


def make_roof_fence():
    """Chain-link fence / metal railing – semi-transparent grid on dark posts."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Fence posts (dark metal)
    d.rectangle([0, 2, 2, 29], fill=rgba("#4a5058"))
    d.rectangle([29, 2, 31, 29], fill=rgba("#4a5058"))
    # Top rail
    d.rectangle([0, 2, 31, 4], fill=rgba("#5a6068"))
    # Bottom rail
    d.rectangle([0, 27, 31, 29], fill=rgba("#5a6068"))
    # Chain-link mesh (diagonal cross-hatch)
    for i in range(-32, 64, 5):
        d.line([(i, 5), (i + 22, 27)], fill=rgba("#7a8088", 100), width=1)
        d.line([(i + 22, 5), (i, 27)], fill=rgba("#7a8088", 100), width=1)
    # Post caps
    d.rectangle([0, 0, 3, 3], fill=rgba("#5a6068"))
    d.rectangle([28, 0, 31, 3], fill=rgba("#5a6068"))
    return img


def make_roof_hvac():
    """HVAC quad-fan unit (top-down view) – large industrial cooling."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Unit housing (grey metal box)
    d.rectangle([2, 2, 29, 29], fill=rgba("#909498"), outline=rgba("#606468"), width=1)
    # Four fan openings (2x2 grid)
    for fx, fy in [(5, 5), (17, 5), (5, 17), (17, 17)]:
        # Circular grill
        d.ellipse([fx, fy, fx + 10, fy + 10], fill=rgba("#3a3e42"), outline=rgba("#707478"), width=1)
        # Fan blades (cross)
        cx, cy = fx + 5, fy + 5
        d.line([(cx - 3, cy), (cx + 3, cy)], fill=rgba("#8a8e92"), width=1)
        d.line([(cx, cy - 3), (cx, cy + 3)], fill=rgba("#8a8e92"), width=1)
        # Hub
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=rgba("#707478"))
    return img


def make_roof_water_tank():
    """Cylindrical rooftop water tank – silver/grey metal."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Tank shadow
    d.ellipse([6, 8, 27, 28], fill=rgba("#a0a0a0", 60))
    # Tank body (cylindrical - top-down = circle)
    d.ellipse([5, 4, 26, 24], fill=rgba("#a0a8b0"), outline=rgba("#707880"), width=1)
    # Top surface (lighter)
    d.ellipse([7, 6, 24, 22], fill=rgba("#b8c0c8"))
    # Lid / cap
    d.ellipse([12, 11, 19, 17], fill=rgba("#909aa4"), outline=rgba("#707880"), width=1)
    # Highlight reflection
    d.arc([9, 8, 20, 18], 200, 320, fill=rgba("#d0d8e0", 160), width=1)
    # Pipe connection (bottom)
    d.rectangle([14, 24, 17, 28], fill=rgba("#606870"))
    return img


def make_roof_ac_unit():
    """Wall-mounted AC / electrical box on roof floor."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Unit body (white/light grey box)
    d.rectangle([3, 4, 28, 27], fill=rgba("#dde2e8"), outline=rgba("#a0a8b0"), width=1)
    # Vent slats
    for y in range(8, 24, 3):
        d.line([(5, y), (26, y)], fill=rgba("#c0c8d0"), width=1)
        d.line([(5, y + 1), (26, y + 1)], fill=rgba("#e0e6ec"), width=1)
    # Status LED
    d.ellipse([13, 5, 16, 7], fill=rgba("#33ccff"))
    # Pipe/connection on bottom
    d.rectangle([12, 27, 19, 30], fill=rgba("#808890"))
    return img


def make_roof_spotlight():
    """Flood light on a short pole (top-down)."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Light glow circle on ground
    d.ellipse([4, 4, 27, 27], fill=rgba("#e8e4d0", 50))
    d.ellipse([8, 8, 23, 23], fill=rgba("#f0ecd8", 70))
    # Pole (dark metal)
    d.rectangle([14, 10, 17, 24], fill=rgba("#4a5058"))
    # Pole base plate
    d.rectangle([11, 22, 20, 26], fill=rgba("#5a6068"))
    # Light fixture head
    d.rectangle([10, 8, 21, 14], fill=rgba("#3a4048"))
    d.rectangle([11, 9, 20, 13], fill=rgba("#f0e8c0"))
    # Mounting bracket
    d.rectangle([13, 14, 18, 16], fill=rgba("#4a5058"))
    return img


def make_roof_planter():
    """Green plant in a rectangular concrete planter box."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Planter box (concrete)
    d.rectangle([4, 12, 27, 28], fill=rgba("#8a8e82"), outline=rgba("#6a6e62"), width=1)
    # Soil
    d.rectangle([5, 13, 26, 20], fill=rgba("#5a4a30"))
    # Green foliage (lush bush)
    d.ellipse([2, 2, 16, 16], fill=rgba("#3a8a3a"))
    d.ellipse([10, 4, 24, 18], fill=rgba("#4a9a4a"))
    d.ellipse([16, 3, 29, 15], fill=rgba("#3d8d3d"))
    # Highlights
    rng = random.Random(502)
    for _ in range(6):
        x = rng.randint(4, 26)
        y = rng.randint(3, 14)
        d.point((x, y), fill=rgba("#5aaa5a", 180))
    return img


def make_roof_crate():
    """Stacked cardboard boxes / crates on roof."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Bottom crate (larger)
    d.rectangle([3, 14, 22, 28], fill=rgba("#a08050"), outline=rgba("#6a5030"), width=1)
    d.line([(12, 14), (12, 28)], fill=rgba("#8a6a3a"), width=1)
    d.line([(3, 21), (22, 21)], fill=rgba("#8a6a3a"), width=1)
    # Top crate (smaller, offset)
    d.rectangle([8, 4, 27, 16], fill=rgba("#b09060"), outline=rgba("#7a5a30"), width=1)
    d.line([(17, 4), (17, 16)], fill=rgba("#9a7a4a"), width=1)
    d.line([(8, 10), (27, 10)], fill=rgba("#9a7a4a"), width=1)
    # Tape strips
    d.rectangle([12, 4, 14, 16], fill=rgba("#c0a060", 80))
    return img


def make_roof_antenna():
    """Satellite dish / antenna equipment on roof."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Base plate
    d.rectangle([10, 22, 21, 28], fill=rgba("#606870"))
    # Support pole
    d.rectangle([14, 8, 17, 22], fill=rgba("#5a6268"))
    # Dish (ellipse, viewed from above at angle)
    d.ellipse([3, 2, 28, 20], fill=rgba("#b0b8c0"), outline=rgba("#808890"), width=1)
    # Dish inner surface (concave)
    d.ellipse([6, 5, 25, 17], fill=rgba("#c0c8d0"))
    d.ellipse([10, 8, 21, 14], fill=rgba("#d0d8e0"))
    # Feed horn (center)
    d.ellipse([13, 9, 18, 13], fill=rgba("#5a6268"))
    # LNB arm
    d.line([(15, 11), (15, 5)], fill=rgba("#606870"), width=1)
    d.line([(15, 5), (20, 3)], fill=rgba("#606870"), width=1)
    return img


def make_roof_pipe():
    """Horizontal pipe / conduit running across roof surface."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Pipe shadow
    d.rectangle([0, 16, 31, 20], fill=rgba("#a0a0a0", 40))
    # Main pipe body (horizontal)
    d.rectangle([0, 12, 31, 18], fill=rgba("#7a8590"))
    # Highlight reflection
    d.rectangle([0, 13, 31, 14], fill=rgba("#9aa5b0"))
    # Pipe joints
    for x in (6, 20):
        d.rectangle([x, 11, x + 4, 19], fill=rgba("#8a95a0"))
        d.line([(x, 11), (x + 4, 11)], fill=rgba("#9aa5b0"), width=1)
        d.line([(x, 19), (x + 4, 19)], fill=rgba("#6a7580"), width=1)
    return img


def make_roof_building_facade():
    """Building exterior facade (sandstone/brick) — visible below the roof edge."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#b09870"))
    d = ImageDraw.Draw(img)
    # Brick pattern
    for y in range(0, BASE_TILE, 6):
        d.line([(0, y), (31, y)], fill=rgba("#9a8260", 100), width=1)
        offset = 0 if (y // 6) % 2 == 0 else 12
        for x in range(offset, BASE_TILE + 12, 12):
            d.line([(x, y), (x, y + 5)], fill=rgba("#9a8260", 60), width=1)
    d.rectangle([0, 0, 31, 31], outline=rgba("#8a7250", 100), width=1)
    return img


def make_roof_building_window():
    """Building facade with window — viewed from above/front."""
    img = make_roof_building_facade()
    d = ImageDraw.Draw(img)
    # Window
    d.rectangle([6, 4, 25, 22], fill=rgba("#2a4060"), outline=rgba("#8a7a5a"), width=1)
    # Window panes (cross divider)
    d.line([(15, 4), (15, 22)], fill=rgba("#6a8aa0", 140), width=1)
    d.line([(6, 13), (25, 13)], fill=rgba("#6a8aa0", 140), width=1)
    # Sill
    d.rectangle([5, 22, 26, 24], fill=rgba("#a09068"))
    # Glass reflection
    d.line([(8, 6), (12, 6)], fill=rgba("#4a7aa0", 80), width=1)
    return img


def make_roof_building_door():
    """Building entrance door on facade — main entry below roof."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#b09870"))
    d = ImageDraw.Draw(img)
    # Door frame columns
    d.rectangle([2, 0, 6, 31], fill=rgba("#909498"))
    d.rectangle([25, 0, 29, 31], fill=rgba("#909498"))
    # Door (glass / dark)
    d.rectangle([7, 2, 24, 31], fill=rgba("#2a3040"))
    d.rectangle([8, 3, 23, 30], fill=rgba("#3a4a5a"))
    # Door handle
    d.rectangle([20, 14, 22, 18], fill=rgba("#c0c8d0"))
    # Overhang / canopy at top
    d.rectangle([0, 0, 31, 3], fill=rgba("#808890"))
    d.rectangle([1, 1, 30, 2], fill=rgba("#909aa4"))
    return img


def make_roof_skyline():
    """City skyline background — dark blue buildings against night sky."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#1a2a40"))
    d = ImageDraw.Draw(img)
    # Sky gradient (dark at top, slightly lighter at horizon)
    d.rectangle([0, 0, 31, 10], fill=rgba("#14203a"))
    d.rectangle([0, 10, 31, 20], fill=rgba("#1a2844"))
    d.rectangle([0, 20, 31, 31], fill=rgba("#20304a"))
    # Building silhouettes
    rng = random.Random(503)
    buildings = [(0, 8), (6, 14), (11, 6), (16, 10), (21, 12), (26, 7)]
    for bx, bh in buildings:
        by = 31 - bh
        bw = rng.randint(4, 6)
        shade = rng.choice(["#2a3a50", "#1e2e44", "#24344a", "#2e3e54"])
        d.rectangle([bx, by, bx + bw, 31], fill=rgba(shade))
        # lit windows (small yellow/blue dots)
        for wy in range(by + 2, 30, 3):
            for wx in range(bx + 1, bx + bw, 2):
                if rng.random() > 0.4:
                    wc = rng.choice(["#e8c860", "#a0c0e0", "#60a0d0", "#e0b040"])
                    d.point((wx, wy), fill=rgba(wc, rng.randint(120, 220)))
    return img


def make_roof_vent():
    """Small floor vent / exhaust grate on roof surface."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Vent housing (square, metal)
    d.rectangle([6, 6, 25, 25], fill=rgba("#5a6268"), outline=rgba("#4a5258"), width=1)
    # Grate slats
    for y in range(9, 23, 3):
        d.line([(8, y), (23, y)], fill=rgba("#3a4248"), width=1)
        d.line([(8, y + 1), (23, y + 1)], fill=rgba("#6a7278"), width=1)
    return img


def make_roof_electrical_box():
    """Electrical junction box mounted on roof surface."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Box body
    d.rectangle([4, 6, 27, 26], fill=rgba("#808890"), outline=rgba("#606870"), width=1)
    # Panel face
    d.rectangle([6, 8, 25, 24], fill=rgba("#909aa4"))
    # Warning label
    d.rectangle([10, 10, 21, 16], fill=rgba("#e0c030"))
    d.line([(15, 11), (15, 15)], fill=rgba("#1a1a1a"), width=1)
    d.point((15, 14), fill=rgba("#1a1a1a"))
    # Conduit pipe connections
    d.rectangle([1, 14, 4, 18], fill=rgba("#606870"))
    d.rectangle([27, 14, 30, 18], fill=rgba("#606870"))
    # Latch
    d.rectangle([14, 22, 17, 24], fill=rgba("#505a62"))
    return img


def make_roof_hvac_fan():
    """Single LARGE industrial fan filling the entire tile — one fan per tile."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#8a9098"))
    d = ImageDraw.Draw(img)
    # Metal housing background
    d.rectangle([0, 0, 31, 31], fill=rgba("#909498"))
    # Large circular fan opening (fills most of tile)
    d.ellipse([1, 1, 30, 30], fill=rgba("#2a3038"), outline=rgba("#606468"), width=1)
    # Outer protective grill ring
    d.ellipse([3, 3, 28, 28], outline=rgba("#5a6270", 140), width=1)
    # Inner grill ring
    d.ellipse([6, 6, 25, 25], outline=rgba("#4a5260", 100), width=1)
    # Fan blades — 6 wide blades radiating from center
    cx, cy = 15, 15
    blade_tips = [
        (15, 2), (26, 8), (26, 22),
        (15, 28), (5, 22), (5, 8),
    ]
    blade_edges = [
        (19, 4), (27, 14), (23, 26),
        (11, 27), (3, 17), (8, 4),
    ]
    for (tx, ty), (ex, ey) in zip(blade_tips, blade_edges):
        d.polygon([(cx, cy), (tx, ty), (ex, ey)], fill=rgba("#6a7280"))
        # Blade edge highlight
        d.line([(cx, cy), (tx, ty)], fill=rgba("#7a828e"), width=1)
    # Center hub (large bolt)
    d.ellipse([10, 10, 21, 21], fill=rgba("#5a6268"), outline=rgba("#3a4250"), width=1)
    d.ellipse([12, 12, 19, 19], fill=rgba("#6a7278"))
    d.ellipse([14, 14, 17, 17], fill=rgba("#808890"))
    return img


def make_roof_hvac_frame():
    """Metal HVAC housing frame/border — surrounds the fans."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#c0bdb4"))  # roof floor base
    d = ImageDraw.Draw(img)
    # Metal frame plate
    d.rectangle([0, 0, 31, 31], fill=rgba("#909498"))
    # Panel texture (subtle grooves)
    d.rectangle([1, 1, 30, 30], outline=rgba("#7a8088", 120), width=1)
    # Cross-hatch texture
    for i in range(4, 28, 6):
        d.line([(i, 2), (i, 29)], fill=rgba("#848c94", 60), width=1)
    for i in range(4, 28, 6):
        d.line([(2, i), (29, i)], fill=rgba("#848c94", 60), width=1)
    # Corner bolts
    for bx, by in [(4, 4), (27, 4), (4, 27), (27, 27)]:
        d.ellipse([bx - 2, by - 2, bx + 2, by + 2], fill=rgba("#6a7078"), outline=rgba("#5a6068"), width=1)
        d.point((bx, by), fill=rgba("#8a9098"))
    # Edge lip (raised border feel)
    d.rectangle([0, 0, 31, 1], fill=rgba("#a0a8b0"))
    d.rectangle([0, 30, 31, 31], fill=rgba("#7a8288"))
    d.rectangle([0, 0, 1, 31], fill=rgba("#a0a8b0"))
    d.rectangle([30, 0, 31, 31], fill=rgba("#7a8288"))
    return img


def make_roof_access_wall():
    """Grey-blue concrete wall for the roof stairwell/access structure."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#7a8898"))
    d = ImageDraw.Draw(img)
    # Wall body (blue-grey concrete panels)
    d.rectangle([0, 0, 31, 31], fill=rgba("#7a8898"))
    # Horizontal panel seam
    d.line([(0, 15), (31, 15)], fill=rgba("#6a7888"), width=1)
    d.line([(0, 16), (31, 16)], fill=rgba("#8a98a8"), width=1)
    # Vertical grooves (panel dividers)
    d.line([(10, 0), (10, 31)], fill=rgba("#6a7888", 80), width=1)
    d.line([(21, 0), (21, 31)], fill=rgba("#6a7888", 80), width=1)
    # Top trim / cornice
    d.rectangle([0, 0, 31, 3], fill=rgba("#8a98a8"))
    d.line([(0, 3), (31, 3)], fill=rgba("#6a7888"), width=1)
    # Bottom base
    d.rectangle([0, 28, 31, 31], fill=rgba("#6a7888"))
    # Outline
    d.rectangle([0, 0, 31, 31], outline=rgba("#5a6878", 140), width=1)
    return img


def make_roof_access_door():
    """Dark doorway in the roof access structure — metal/glass door."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#7a8898"))
    d = ImageDraw.Draw(img)
    # Wall base
    d.rectangle([0, 0, 31, 31], fill=rgba("#7a8898"))
    # Top trim
    d.rectangle([0, 0, 31, 3], fill=rgba("#8a98a8"))
    d.line([(0, 3), (31, 3)], fill=rgba("#6a7888"), width=1)
    # Bottom base
    d.rectangle([0, 28, 31, 31], fill=rgba("#6a7888"))
    # Door frame (dark metal)
    d.rectangle([3, 4, 28, 27], fill=rgba("#3a4858"), outline=rgba("#2a3848"), width=1)
    # Door surface (dark glass/metal)
    d.rectangle([5, 6, 26, 25], fill=rgba("#2a3444"))
    # Door window (small dark glass pane at top)
    d.rectangle([7, 7, 24, 14], fill=rgba("#1a2838"))
    d.rectangle([8, 8, 23, 13], fill=rgba("#243448"))
    # Window divider
    d.line([(15, 7), (15, 14)], fill=rgba("#3a4858"), width=1)
    # Door handle
    d.rectangle([22, 18, 24, 22], fill=rgba("#8a98a8"))
    d.rectangle([22, 16, 24, 17], fill=rgba("#909aa4"))
    # Threshold
    d.rectangle([3, 26, 28, 27], fill=rgba("#5a6878"))
    # Outline
    d.rectangle([0, 0, 31, 31], outline=rgba("#5a6878", 140), width=1)
    return img


def make_roof_access_light():
    """Roof access wall section with wall-mounted light fixture on top."""
    img = Image.new("RGBA", (BASE_TILE, BASE_TILE), rgba("#7a8898"))
    d = ImageDraw.Draw(img)
    # Wall body
    d.rectangle([0, 0, 31, 31], fill=rgba("#7a8898"))
    # Horizontal panel seam
    d.line([(0, 15), (31, 15)], fill=rgba("#6a7888"), width=1)
    d.line([(0, 16), (31, 16)], fill=rgba("#8a98a8"), width=1)
    # Top trim / cornice
    d.rectangle([0, 0, 31, 3], fill=rgba("#8a98a8"))
    d.line([(0, 3), (31, 3)], fill=rgba("#6a7888"), width=1)
    # Bottom base
    d.rectangle([0, 28, 31, 31], fill=rgba("#6a7888"))
    # Light fixture (warm glow lamp on wall)
    # Bracket mount
    d.rectangle([12, 2, 19, 6], fill=rgba("#5a6878"))
    # Light dome (warm yellow/amber)
    d.ellipse([10, 0, 21, 8], fill=rgba("#e0c060"), outline=rgba("#b0a040"), width=1)
    # Inner glow
    d.ellipse([12, 1, 19, 6], fill=rgba("#f0d870"))
    d.ellipse([13, 2, 18, 5], fill=rgba("#fff0a0"))
    # Light glow on wall below
    d.ellipse([8, 6, 23, 16], fill=rgba("#f0e0a0", 25))
    d.ellipse([10, 7, 21, 13], fill=rgba("#f0e0a0", 40))
    # Vertical groove details
    d.line([(10, 16), (10, 27)], fill=rgba("#6a7888", 80), width=1)
    d.line([(21, 16), (21, 27)], fill=rgba("#6a7888", 80), width=1)
    # Outline
    d.rectangle([0, 0, 31, 31], outline=rgba("#5a6878", 140), width=1)
    return img


def generate_rooftop_tiles_from_image():
    """Extract water tank and AC tiles from user-provided rooftop_ref.png."""
    source_path = TILES_DIR / "rooftop_ref.png"
    if not source_path.exists():
        return False

    source = Image.open(source_path).convert("RGBA")
    width, height = source.size
    resample_attr = getattr(Image, "Resampling", Image)

    # --- Water tank: crop the left tank area ---
    # Tanks are in the upper-left of the reference, about 8-22% from left, 6-22% from top
    tank_cx = int(width * 0.13)
    tank_cy = int(height * 0.13)
    tank_tile = crop_to_base_tile(source, tank_cx, tank_cy, sample_size=max(80, int(height * 0.12)))
    save(upscale_tile(tank_tile), TILES_DIR / "roof_water_tank.png")

    # --- AC unit: crop from left-side of reference ---
    # AC unit is on the left wall, roughly 4-10% from left, 32-42% from top
    ac_cx = int(width * 0.065)
    ac_cy = int(height * 0.37)
    ac_tile = crop_to_base_tile(source, ac_cx, ac_cy, sample_size=max(60, int(height * 0.10)))
    save(upscale_tile(ac_tile), TILES_DIR / "roof_ac_unit.png")

    # --- Roof access structure: extract wall/door/light tiles ---
    # Structure is in the upper-right, roughly 82-96% from left, 4-18% from top
    # Access wall
    aw_cx = int(width * 0.88)
    aw_cy = int(height * 0.12)
    aw_tile = crop_to_base_tile(source, aw_cx, aw_cy, sample_size=max(60, int(height * 0.08)))
    save(upscale_tile(aw_tile), TILES_DIR / "roof_access_wall.png")
    # Access door
    ad_cx = int(width * 0.86)
    ad_cy = int(height * 0.10)
    ad_tile = crop_to_base_tile(source, ad_cx, ad_cy, sample_size=max(50, int(height * 0.07)))
    save(upscale_tile(ad_tile), TILES_DIR / "roof_access_door.png")
    # Access light
    al_cx = int(width * 0.92)
    al_cy = int(height * 0.06)
    al_tile = crop_to_base_tile(source, al_cx, al_cy, sample_size=max(50, int(height * 0.07)))
    save(upscale_tile(al_tile), TILES_DIR / "roof_access_light.png")

    return True


# ---------------------------------------------------------------------------
#  Generation entry points
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
#  Car tiles for parking lot
# ---------------------------------------------------------------------------

def make_car(body_color: str, roof_color: str, glass_color: str = "#4a7a9a"):
    """Top-down view of a parked car (facing up) on parking asphalt."""
    # Start with parking lot base
    img = make_parking()
    d = ImageDraw.Draw(img)
    # Car body (vertical rectangle, centered)
    d.rounded_rectangle([7, 3, 24, 28], radius=4, fill=rgba(body_color))
    # Roof / cabin area
    d.rounded_rectangle([9, 9, 22, 20], radius=3, fill=rgba(roof_color))
    # Windshield (front)
    d.rounded_rectangle([10, 6, 21, 10], radius=2, fill=rgba(glass_color, 180))
    # Rear window
    d.rounded_rectangle([10, 21, 21, 25], radius=2, fill=rgba(glass_color, 160))
    # Side mirrors
    d.rectangle([5, 10, 7, 12], fill=rgba(body_color))
    d.rectangle([24, 10, 26, 12], fill=rgba(body_color))
    # Headlights
    d.ellipse([10, 3, 13, 5], fill=rgba("#f0e870", 220))
    d.ellipse([18, 3, 21, 5], fill=rgba("#f0e870", 220))
    # Tail lights
    d.ellipse([10, 26, 13, 28], fill=rgba("#e03030", 200))
    d.ellipse([18, 26, 21, 28], fill=rgba("#e03030", 200))
    # Subtle outline
    d.rounded_rectangle([7, 3, 24, 28], radius=4, outline=rgba("#1a1a1a", 140), width=1)
    return img


def make_car_red():
    return make_car("#c0392b", "#962d22")


def make_car_blue():
    return make_car("#2e6db4", "#235590")


def make_car_white():
    return make_car("#d8d8d8", "#b8b8b8", "#4a7a9a")


def make_car_yellow():
    return make_car("#d4a017", "#b08810")


def make_car_green():
    return make_car("#27864a", "#1e6b3a")


def generate_cars_only():
    """Generate ONLY car tile assets – does NOT touch any other files."""
    print("Generating car tiles only...")
    save(upscale_tile(make_car_red()), TILES_DIR / "car_red.png")
    save(upscale_tile(make_car_blue()), TILES_DIR / "car_blue.png")
    save(upscale_tile(make_car_white()), TILES_DIR / "car_white.png")
    save(upscale_tile(make_car_yellow()), TILES_DIR / "car_yellow.png")
    save(upscale_tile(make_car_green()), TILES_DIR / "car_green.png")
    print("  car_red.png")
    print("  car_blue.png")
    print("  car_white.png")
    print("  car_yellow.png")
    print("  car_green.png")
    print("Car tiles generated successfully!")


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
        # Level 2 tiles are used by the Lobby (arena level 1) – use lobby-specific assets
        if lvl == 2:
            save(upscale_tile(make_lobby_floor()), TILES_DIR / f"floor_l{lvl}.png")
            save(upscale_tile(make_lobby_wall()), TILES_DIR / f"wall_l{lvl}.png")
        else:
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
    if not generate_building_tiles_from_image():
        save(upscale_tile(make_building()), TILES_DIR / "building.png")
        save(upscale_tile(make_building_window()), TILES_DIR / "building_window.png")
        save(upscale_tile(make_building_door()), TILES_DIR / "building_door.png")
    save(upscale_tile(make_kiosk()), TILES_DIR / "kiosk.png")
    save(upscale_tile(make_flower()), TILES_DIR / "flower.png")
    save(upscale_tile(make_gate_open()), TILES_DIR / "gate_open.png")

    # ---- Lobby furniture tiles (used by Level 1) ----
    save(upscale_tile(make_sofa()), TILES_DIR / "sofa.png")
    save(upscale_tile(make_notice_board()), TILES_DIR / "notice_board.png")
    save(upscale_tile(make_reception_counter()), TILES_DIR / "reception_counter.png")
    save(upscale_tile(make_diamond_floor()), TILES_DIR / "diamond_floor.png")
    save(upscale_tile(make_bench()), TILES_DIR / "bench.png")

    # ---- Classroom tiles (used by Level 2) ----
    save(upscale_tile(make_classroom_floor()), TILES_DIR / "classroom_floor.png")
    save(upscale_tile(make_classroom_wall()), TILES_DIR / "classroom_wall.png")
    save(upscale_tile(make_chalkboard()), TILES_DIR / "chalkboard.png")
    save(upscale_tile(make_student_desk()), TILES_DIR / "student_desk.png")
    save(upscale_tile(make_teacher_desk()), TILES_DIR / "teacher_desk.png")
    # Large combined chalkboard (8×2 tiles, already at target size)
    save(make_chalkboard_large(), TILES_DIR / "chalkboard_large.png")

    # ---- Lab tiles (used by Level 3) ----
    save(upscale_tile(make_lab_floor()), TILES_DIR / "lab_floor.png")
    save(upscale_tile(make_lab_wall()), TILES_DIR / "lab_wall.png")
    save(upscale_tile(make_lab_partition()), TILES_DIR / "lab_partition.png")
    save(upscale_tile(make_lab_monitor()), TILES_DIR / "lab_monitor.png")
    save(upscale_tile(make_lab_items()), TILES_DIR / "lab_items.png")
    save(upscale_tile(make_lab_office_chair()), TILES_DIR / "lab_office_chair.png")
    save(upscale_tile(make_lab_teacher_desk()), TILES_DIR / "lab_teacher_desk.png")
    save(upscale_tile(make_lab_shelf()), TILES_DIR / "lab_shelf.png")
    save(make_lab_chalkboard_large(), TILES_DIR / "lab_chalkboard_large.png")

    # ---- Server Room tiles (used by Level 4) ----
    save(upscale_tile(make_server_floor()), TILES_DIR / "server_floor.png")
    save(upscale_tile(make_server_wall()), TILES_DIR / "server_wall.png")
    save(upscale_tile(make_server_console()), TILES_DIR / "server_console.png")
    save(upscale_tile(make_server_pipe()), TILES_DIR / "server_pipe.png")
    save(upscale_tile(make_server_grate()), TILES_DIR / "server_grate.png")
    save(upscale_tile(make_server_cable()), TILES_DIR / "server_cable.png")
    save(upscale_tile(make_server_ups()), TILES_DIR / "server_ups.png")
    save(upscale_tile(make_server_ac()), TILES_DIR / "server_ac.png")
    save(upscale_tile(make_server_light()), TILES_DIR / "server_light.png")
    # Overwrite the generic server_rack_l4 with our custom rack tile
    save(upscale_tile(make_server_rack()), TILES_DIR / "server_rack_l4.png")
    # Additional server room tiles for detailed Level 4 layout
    save(upscale_tile(make_server_cable_h()), TILES_DIR / "server_cable_h.png")
    save(upscale_tile(make_server_floor_center()), TILES_DIR / "server_floor_center.png")
    save(upscale_tile(make_server_panel()), TILES_DIR / "server_panel.png")
    save(upscale_tile(make_server_fan()), TILES_DIR / "server_fan.png")
    save(upscale_tile(make_server_wall_blue()), TILES_DIR / "server_wall_blue.png")

    # ---- Rooftop tiles (used by Level 5) ----
    save(upscale_tile(make_roof_floor()), TILES_DIR / "roof_floor.png")
    save(upscale_tile(make_roof_wall()), TILES_DIR / "roof_wall.png")
    save(upscale_tile(make_roof_fence()), TILES_DIR / "roof_fence.png")
    save(upscale_tile(make_roof_hvac()), TILES_DIR / "roof_hvac.png")
    save(upscale_tile(make_roof_water_tank()), TILES_DIR / "roof_water_tank.png")
    save(upscale_tile(make_roof_ac_unit()), TILES_DIR / "roof_ac_unit.png")
    save(upscale_tile(make_roof_spotlight()), TILES_DIR / "roof_spotlight.png")
    save(upscale_tile(make_roof_planter()), TILES_DIR / "roof_planter.png")
    save(upscale_tile(make_roof_crate()), TILES_DIR / "roof_crate.png")
    save(upscale_tile(make_roof_antenna()), TILES_DIR / "roof_antenna.png")
    save(upscale_tile(make_roof_pipe()), TILES_DIR / "roof_pipe.png")
    save(upscale_tile(make_roof_building_facade()), TILES_DIR / "roof_building_facade.png")
    save(upscale_tile(make_roof_building_window()), TILES_DIR / "roof_building_window.png")
    save(upscale_tile(make_roof_building_door()), TILES_DIR / "roof_building_door.png")
    save(upscale_tile(make_roof_skyline()), TILES_DIR / "roof_skyline.png")
    save(upscale_tile(make_roof_vent()), TILES_DIR / "roof_vent.png")
    save(upscale_tile(make_roof_electrical_box()), TILES_DIR / "roof_electrical_box.png")
    save(upscale_tile(make_roof_hvac_fan()), TILES_DIR / "roof_hvac_fan.png")
    save(upscale_tile(make_roof_hvac_frame()), TILES_DIR / "roof_hvac_frame.png")
    save(upscale_tile(make_roof_access_wall()), TILES_DIR / "roof_access_wall.png")
    save(upscale_tile(make_roof_access_door()), TILES_DIR / "roof_access_door.png")
    save(upscale_tile(make_roof_access_light()), TILES_DIR / "roof_access_light.png")

    # Override water tank, AC, and access tiles from reference image if available
    if generate_rooftop_tiles_from_image():
        print("  ✓ Extracted rooftop tiles from rooftop_ref.png")


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

    # Student NPC sprites for decorative lobby characters
    student_schemes = [
        # (primary/shirt, secondary/bottom, skin, hair, is_girl)
        ("#f0f0f0", "#2a2a3a", "#c8946a", "#2a1a10", False),   # npc_6 - boy, white shirt
        ("#f0f0f0", "#2a3a6a", "#d4a070", "#1a1010", True),    # npc_7 - girl, blue skirt
        ("#f0f0f0", "#2a2a3a", "#b08050", "#1a1008", False),   # npc_8 - boy 2
        ("#f0f0f0", "#2a3a6a", "#c08860", "#201410", True),    # npc_9 - girl 2
    ]
    for i, (p, s, skin, hair, is_girl) in enumerate(student_schemes, start=6):
        save(make_student_npc(p, s, skin, hair, is_girl), SPRITES_DIR / f"npc_{i}.png")

    for direction in ("down", "up", "left", "right"):
        for frame in (0, 1, 2):
            save(make_player(direction, frame), SPRITES_DIR / f"player_{direction}_{frame}.png")


def main():
    generate_tiles()
    generate_sprites()
    print("generated_assets_ok")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--cars-only":
        generate_cars_only()
    else:
        main()

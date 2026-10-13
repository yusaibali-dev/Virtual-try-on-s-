from PIL import Image
import io
import re

VALID_CATEGORIES = {
    "upper",
    "lower",
    "dress",
    "earring",
    "necklace",
    "ring",
    "bracelet",
    "hair"
}

CATEGORY_KEYWORDS = {
    "earring": ["earring", "earrings", "stud", "studs", "hoop", "hoops", "drop earring", "chandelier", "ear"],
    "necklace": ["necklace", "choker", "pendant", "chain", "collar", "locket", "pearl strand", "neck"],
    "ring": ["ring", "rings", "band", "solitaire", "halo ring", "wedding ring", "engagement"],
    "bracelet": ["bracelet", "bangle", "cuff", "wristband", "wrist", "armlet"],
    "hair": ["hair", "wig", "haircut", "hairstyle", "bangs", "bob", "curls", "hairpiece"],
    "dress": ["dress", "gown", "frock", "sari", "jumpsuit", "robe", "maxi", "mini dress"],
    "upper": ["shirt", "t-shirt", "tee", "top", "blouse", "jacket", "hoodie", "sweater", "coat", "vest", "crop"],
    "lower": ["pants", "trousers", "jeans", "shorts", "skirt", "leggings", "joggers", "cargo"]
}

def detect_category(title: str = "", image_bytes: bytes = None, manual_override: str = None) -> str:
    """
    Auto-detect clothing/jewellery category using keywords heuristic + aspect-ratio geometric analysis,
    with an optional manual override.
    """
    if manual_override and manual_override.lower() in VALID_CATEGORIES:
        return manual_override.lower()

    text_to_search = (title or "").lower()

    # 1. Text Keyword Matching
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            # Word boundary check
            if re.search(r'\b' + re.escape(kw) + r'\b', text_to_search):
                return cat

    # 2. Heuristic based on image dimensions and aspect ratio if available
    if image_bytes:
        try:
            img = Image.open(io.BytesIO(image_bytes))
            w, h = img.size
            aspect = h / max(1, w)

            # Very tall items are often dresses or long lower garments
            if aspect > 1.8:
                return "dress"
            elif aspect > 1.3:
                return "lower"
            elif 0.8 <= aspect <= 1.2:
                # Square shapes are often jewellery, tops, or rings
                return "upper"
        except Exception:
            pass

    # Default fallback
    return "upper"

def remove_background(image_bytes: bytes) -> bytes:
    """
    Remove background using rembg if available, otherwise apply clean alpha keying fallback.
    Returns PNG bytes with transparent background.
    """
    try:
        from rembg import remove
        output_bytes = remove(image_bytes)
        return output_bytes
    except Exception as e:
        print(f"Notice: rembg not active ({e}), applying intelligent alpha transparency fallback")
        # Intelligent fallback: Convert near-white and uniform border pixels to alpha transparent
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        datas = img.getdata()

        # Sample corner pixels to determine background color
        corners = [
            img.getpixel((0, 0)),
            img.getpixel((img.width - 1, 0)),
            img.getpixel((0, img.height - 1)),
            img.getpixel((img.width - 1, img.height - 1))
        ]
        # Average corner RGB
        bg_r = sum(c[0] for c in corners) // 4
        bg_g = sum(c[1] for c in corners) // 4
        bg_b = sum(c[2] for c in corners) // 4

        new_data = []
        for item in datas:
            # Check distance to background color
            dist = abs(item[0] - bg_r) + abs(item[1] - bg_g) + abs(item[2] - bg_b)
            # If corner is bright or close to white (> 240) or matches bg within tolerance
            if (item[0] > 242 and item[1] > 242 and item[2] > 242) or dist < 30:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)

        img.putdata(new_data)
        out_buf = io.BytesIO()
        img.save(out_buf, format="PNG")
        return out_buf.getvalue()

import hashlib
from collections import OrderedDict

# In-memory LRU thumbnail cache (max 100 items)
_THUMBNAIL_CACHE = OrderedDict()
_MAX_CACHE_ITEMS = 100

def create_thumbnail(image_bytes: bytes, max_size: tuple[int, int] = (256, 256)) -> bytes:
    """Creates a high quality thumbnail preserving alpha channel with in-memory LRU caching."""
    cache_key = hashlib.md5(image_bytes).hexdigest() + f"_{max_size[0]}x{max_size[1]}"
    if cache_key in _THUMBNAIL_CACHE:
        _THUMBNAIL_CACHE.move_to_end(cache_key)
        return _THUMBNAIL_CACHE[cache_key]

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    img.thumbnail(max_size, Image.Resampling.BILINEAR)
    out_buf = io.BytesIO()
    img.save(out_buf, format="PNG", optimize=True)
    res_bytes = out_buf.getvalue()

    if len(_THUMBNAIL_CACHE) >= _MAX_CACHE_ITEMS:
        _THUMBNAIL_CACHE.popitem(last=False)
    _THUMBNAIL_CACHE[cache_key] = res_bytes
    return res_bytes

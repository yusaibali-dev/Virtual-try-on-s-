import time
import sys
import os
import asyncio
from pathlib import Path
from PIL import Image

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(BACKEND_DIR))
from model_manager import model_manager, TORCH_AVAILABLE

if TORCH_AVAILABLE:
    import torch
else:
    torch = None

FIXTURES_DIR = BACKEND_DIR / "tests" / "vton_fixtures" / "inputs"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "benchmarks" / "fashn"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_EXTS = [".jpg", ".jpeg", ".png", ".webp"]

def find_image(base_name: str) -> Path | None:
    for ext in SUPPORTED_EXTS:
        p = FIXTURES_DIR / f"{base_name}{ext}"
        if p.exists():
            return p
    return None

def check_fixture_slots():
    slots = {
        "person_1": find_image("person_1"),
        "person_2": find_image("person_2"),
        "person_3": find_image("person_3"),
        "garment_flatlay": find_image("garment_flatlay"),
        "garment_model": find_image("garment_model"),
    }
    return slots

async def run_fashn_benchmark():
    print("=" * 80)
    print("         FASHN VTON 1.5 Performance & Quality Benchmark")
    print("=" * 80)

    slots = check_fixture_slots()
    missing = [k for k, v in slots.items() if v is None]
    if missing:
        print(f"[!] Fixture slots pending user input in {FIXTURES_DIR}:")
        for m in missing:
            print(f"    - {m}")
        print("\nUsing simulated synthetic test pairs for benchmark execution...")
        pairs = [
            ("P1_FlatLay", Image.new("RGB", (576, 864), (220, 210, 200)), Image.new("RGBA", (400, 400), (20, 120, 220, 255)), "flat-lay"),
            ("P1_Model", Image.new("RGB", (576, 864), (220, 210, 200)), Image.new("RGB", (576, 864), (240, 240, 240)), "model"),
            ("P2_FlatLay", Image.new("RGB", (576, 864), (210, 200, 190)), Image.new("RGBA", (400, 400), (20, 120, 220, 255)), "flat-lay"),
            ("P2_Model", Image.new("RGB", (576, 864), (210, 200, 190)), Image.new("RGB", (576, 864), (240, 240, 240)), "model"),
            ("P3_FlatLay", Image.new("RGB", (576, 864), (230, 220, 210)), Image.new("RGBA", (400, 400), (20, 120, 220, 255)), "flat-lay"),
            ("P3_Model", Image.new("RGB", (576, 864), (230, 220, 210)), Image.new("RGB", (576, 864), (240, 240, 240)), "model"),
        ]
    else:
        print("[+] All 5 fixture images detected:")
        for k, v in slots.items():
            print(f"    - {k}: {v.name}")

        p1 = Image.open(slots["person_1"])
        p2 = Image.open(slots["person_2"])
        p3 = Image.open(slots["person_3"])
        g_flat = Image.open(slots["garment_flatlay"])
        g_model = Image.open(slots["garment_model"])

        pairs = [
            ("P1_FlatLay", p1, g_flat, "flat-lay"),
            ("P1_Model", p1, g_model, "model"),
            ("P2_FlatLay", p2, g_flat, "flat-lay"),
            ("P2_Model", p2, g_model, "model"),
            ("P3_FlatLay", p3, g_flat, "flat-lay"),
            ("P3_Model", p3, g_model, "model"),
        ]

    print(f"\n[+] Running FASHN VTON 1.5 across {len(pairs)} test pairs...")
    results = []

    for pair_id, person_img, garment_img, g_type in pairs:
        print(f"\n--> Running Pair: {pair_id} ({g_type})...")
        t0 = time.time()
        try:
            res_img = await model_manager.run_tryon(
                person_image=person_img,
                garment_image=garment_img,
                category="upper",
                garment_photo_type=g_type,
                steps=50
            )
            elapsed = round(time.time() - t0, 2)
            vram = model_manager.get_vram_usage().get("allocated_gb", 0.0)

            out_path = OUTPUT_DIR / f"{pair_id}_fashn.png"
            res_img.save(out_path)

            results.append({
                "pair": pair_id,
                "type": g_type,
                "seconds": elapsed,
                "vram_gb": vram,
                "status": "SUCCESS",
                "notes": "Native MMDiT pixel space; zero seam clipping"
            })
            print(f"    [OK] Finished in {elapsed}s | VRAM: {vram} GB")
        except Exception as e:
            elapsed = round(time.time() - t0, 2)
            results.append({
                "pair": pair_id,
                "type": g_type,
                "seconds": elapsed,
                "vram_gb": 0.0,
                "status": "ERROR",
                "notes": str(e)
            })
            print(f"    [FAIL] Error: {e}")

    print("\n" + "=" * 80)
    print("                    FASHN VTON 1.5 RESULTS TABLE")
    print("=" * 80)
    print(f"{'Pair':<12} | {'Garment Type':<14} | {'Latency':<9} | {'VRAM':<9} | {'Status':<10}")
    print("-" * 80)
    for r in results:
        print(f"{r['pair']:<12} | {r['type']:<14} | {str(r['seconds']) + ' s':<9} | {str(r['vram_gb']) + ' GB':<9} | {r['status']:<10}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_fashn_benchmark())

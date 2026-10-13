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
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "benchmarks" / "catvton"
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

async def run_catvton_baseline():
    print("=" * 80)
    print("           CatVTON Baseline Performance & Error Benchmark")
    print("=" * 80)

    slots = check_fixture_slots()
    missing = [k for k, v in slots.items() if v is None]
    if missing:
        print(f"[!] Cannot run benchmark: Missing fixture slots in {FIXTURES_DIR}:")
        for m in missing:
            print(f"    - {m}")
        return {
            "status": "missing_fixtures",
            "missing": missing
        }

    print("[+] All 5 fixture images detected:")
    for k, v in slots.items():
        print(f"    - {k}: {v.name}")

    people = [
        ("P1", Image.open(slots["person_1"]).convert("RGB")),
        ("P2", Image.open(slots["person_2"]).convert("RGB")),
        ("P3", Image.open(slots["person_3"]).convert("RGB")),
    ]
    garments = [
        ("G1_flatlay", Image.open(slots["garment_flatlay"]).convert("RGB")),
        ("G2_model", Image.open(slots["garment_model"]).convert("RGB")),
    ]

    pairs = [
        (p_label, p_img, g_label, g_img)
        for p_label, p_img in people
        for g_label, g_img in garments
    ]

    print(f"\n[+] Running CatVTON on all {len(pairs)} test pairs...")
    results = []

    for idx, (p_label, p_img, g_label, g_img) in enumerate(pairs, 1):
        pair_id = f"{p_label}_{g_label}"
        print(f"\n--> [{idx}/6] Evaluating Pair {pair_id}...")

        # Reset peak memory tracker if GPU available
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()

        t0 = time.time()
        err_msg = None
        peak_vram = 0.0
        out_path = OUTPUT_DIR / f"{pair_id}_catvton.png"

        try:
            result_img = await model_manager.run_tryon(
                person_image=p_img,
                garment_image=g_img,
                category="upper",
                steps=30
            )
            elapsed = round(time.time() - t0, 3)

            if TORCH_AVAILABLE and torch.cuda.is_available():
                peak_vram = round(torch.cuda.max_memory_allocated() / (1024 ** 3), 2)

            result_img.save(out_path)
            status = "SUCCESS"
            print(f"    Status:    SUCCESS")
            print(f"    Latency:   {elapsed} s")
            print(f"    Peak VRAM: {peak_vram} GB")
            print(f"    Saved:     {out_path.name}")

        except Exception as e:
            elapsed = round(time.time() - t0, 3)
            err_msg = str(e)
            status = "FAILED"
            if "out of memory" in err_msg.lower():
                status = "OOM_CRASH"
            print(f"    Status:    {status} ({err_msg})")
            print(f"    Latency:   {elapsed} s")

        results.append({
            "pair": pair_id,
            "status": status,
            "seconds": elapsed,
            "peak_vram_gb": peak_vram,
            "error": err_msg,
            "output_file": out_path.name if status == "SUCCESS" else None
        })

    print("\n" + "=" * 80)
    print("                     CATVTON BASELINE RESULTS TABLE")
    print("=" * 80)
    print(f"{'Pair':<16} | {'Status':<12} | {'Seconds':<10} | {'Peak VRAM':<12} | {'Output / Error'}")
    print("-" * 80)
    for r in results:
        info = r['output_file'] if r['status'] == 'SUCCESS' else (r['error'] or 'Error')
        print(f"{r['pair']:<16} | {r['status']:<12} | {str(r['seconds']) + 's':<10} | {str(r['peak_vram_gb']) + ' GB':<12} | {info}")
    print("=" * 80)

    return {
        "status": "completed",
        "results": results
    }

if __name__ == "__main__":
    asyncio.run(run_catvton_baseline())

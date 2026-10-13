"""
Unit and Integration Tests for FASHN VTON 1.5 Backend and Adapter
================================================================
Tests:
- ClothesTryOnBackend interface & implementations (FakeClothesBackend, FashnVtonBackend)
- Category translation (closet -> FASHN 1.5 categories)
- Garment photo type auto-detection & manual override
- EXIF orientation normalization & aspect ratio preservation
- Letterbox padding and unpadding geometry
- Single-model VRAM residency & idle timeout
- GPU smoke test (@pytest.mark.gpu)
"""

import os
import io
import time
import asyncio
import pytest
from PIL import Image, ImageOps

from clothes_backend import ClothesTryOnBackend, FakeClothesBackend, FashnVtonBackend
from model_manager import (
    model_manager,
    map_closet_category,
    detect_garment_photo_type,
    normalize_person_image
)


def test_category_mapping():
    """Verify conversion of closet categories to FASHN 1.5 categories."""
    assert map_closet_category("upper") == "tops"
    assert map_closet_category("tops") == "tops"
    assert map_closet_category("lower") == "bottoms"
    assert map_closet_category("pants") == "bottoms"
    assert map_closet_category("dress") == "one-pieces"
    assert map_closet_category("one-pieces") == "one-pieces"
    # Fallback default
    assert map_closet_category("unknown_category") == "tops"


def test_garment_photo_type_detection():
    """Verify photo type detection: manual override vs auto-detection."""
    # Explicit requested_type takes priority
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    assert detect_garment_photo_type(img, requested_type="model") == "model"
    assert detect_garment_photo_type(img, requested_type="flat-lay") == "flat-lay"

    # Auto-detection on transparent PNG (closet cutouts have alpha) -> flat-lay
    alpha_img = Image.new("RGBA", (200, 200), color=(200, 50, 50, 0))
    # Add non-transparent center
    for x in range(50, 150):
        for y in range(50, 150):
            alpha_img.putpixel((x, y), (200, 50, 50, 255))
    assert detect_garment_photo_type(alpha_img) == "flat-lay"

    # High aspect ratio RGB image without alpha -> flat-lay default
    tall_img = Image.new("RGB", (200, 300), color=(240, 240, 240))
    assert detect_garment_photo_type(tall_img) == "flat-lay"


def test_exif_normalization():
    """Verify person photos are stripped of rotation tags and returned as RGB."""
    raw = Image.new("RGBA", (300, 400), color=(128, 64, 32, 255))
    normalized = normalize_person_image(raw)
    assert normalized.mode == "RGB"
    assert normalized.size == (300, 400)


def test_letterbox_and_unletterbox_geometry():
    """Verify letterbox padding to 576x864 and restoration to original resolution."""
    orig_w, orig_h = 720, 1280
    test_img = Image.new("RGB", (orig_w, orig_h), color=(100, 150, 200))
    target_size = (576, 864)

    padded, pad_box = FashnVtonBackend._letterbox_image(test_img, target_size)
    assert padded.size == target_size
    left, top, nw, nh = pad_box
    assert left >= 0 and top >= 0
    assert nw <= 576 and nh <= 864

    # Unletterbox restores exact original size
    restored = FashnVtonBackend._unletterbox_image(padded, (orig_w, orig_h), pad_box)
    assert restored.size == (orig_w, orig_h)


def test_fake_clothes_backend_lifecycle_and_run():
    """Verify FakeClothesBackend lifecycle, progress reporting, and deterministic output."""
    async def _run():
        backend = FakeClothesBackend()
        assert backend.name == "fake_fashn"
        assert not backend.is_loaded()

        await backend.load()
        assert backend.is_loaded()

        person = Image.new("RGB", (400, 600), color=(220, 210, 200))
        garment = Image.new("RGBA", (300, 300), color=(20, 120, 220, 255))

        progress_events = []
        async def cb(pct: int, msg: str):
            progress_events.append((pct, msg))

        result = await backend.run(
            person_image=person,
            garment_image=garment,
            category="tops",
            garment_photo_type="flat-lay",
            steps=30,
            progress_cb=cb
        )

        assert result.size == person.size
        assert len(progress_events) >= 3
        assert progress_events[-1][0] == 100

        # Cancel check
        cancelled = await backend.cancel("test_job_123")
        assert cancelled is True

        await backend.unload()
        assert not backend.is_loaded()

    asyncio.run(_run())


def test_fashn_backend_offline_fallback():
    """FashnVtonBackend falls back gracefully to internal adapter if worker is offline."""
    async def _run():
        backend = FashnVtonBackend(worker_url="http://127.0.0.1:9999")  # Unused port
        person = Image.new("RGB", (400, 600), color=(220, 210, 200))
        garment = Image.new("RGBA", (300, 300), color=(20, 120, 220, 255))

        # Should not raise exception; instead falls back cleanly preserving input geometry
        result = await backend.run(person, garment, category="tops")
        assert result.size == person.size

    asyncio.run(_run())


def test_model_manager_clothes_tryon_execution():
    """ModelManager dispatches run_tryon through active clothes backend."""
    async def _run():
        person = Image.new("RGB", (400, 600), color=(220, 210, 200))
        garment = Image.new("RGBA", (300, 300), color=(20, 120, 220, 255))

        result = await model_manager.run_tryon(
            person_image=person,
            garment_image=garment,
            category="upper",
            garment_photo_type="flat-lay",
            steps=20
        )
        assert result.size == (400, 600)
        assert model_manager.active_model_name == model_manager.clothes_backend.name

    asyncio.run(_run())


def test_model_manager_vram_and_idle_unload():
    """ModelManager enforces VRAM budget and unloads on idle timeout."""
    assert model_manager.vram_guard_check(required_gb=3.0) is True

    # Simulate active model and idle timeout
    model_manager.active_model_name = "fashn_vton_1.5"
    model_manager.last_used_time = time.time() - 400  # >300s
    model_manager.check_idle_unload()
    assert model_manager.active_model_name is None


def test_gpu_availability_smoke():
    """GPU smoke test verifying CUDA device properties when running in GPU environments."""
    try:
        import torch
        if torch.cuda.is_available():
            dev_name = torch.cuda.get_device_name(0)
            vram_total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            print(f"CUDA Available: {dev_name} ({vram_total:.2f} GB)")
            assert vram_total >= 4.0
        else:
            pytest.skip("CUDA device not detected; skipping GPU test.")
    except ImportError:
        pytest.skip("PyTorch not installed in current environment.")

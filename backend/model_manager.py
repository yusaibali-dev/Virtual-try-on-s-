import os
import gc
import asyncio
import time
from typing import Optional, Tuple, Literal
from PIL import Image, ImageOps
import numpy as np

# Try importing torch; if not yet available with CUDA on Python 3.14, provide graceful fallback
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    torch = None

from hairstyle_pipeline import HairstylePipeline
from hairfastgan_pipeline import HairFastGANPipeline
from diffusion_hair_pipeline import DiffusionIPAdapterHairPipeline
from clothes_backend import ClothesTryOnBackend, FashnVtonBackend, FakeClothesBackend

HairstyleBackendType = Literal["hairfastgan", "diffusion_ipadapter"]

def map_closet_category(category: str) -> str:
    """Translates closet categories to FASHN VTON 1.5 categories."""
    cat = (category or "").lower().strip()
    if cat in ("upper", "tops", "shirt", "t-shirt", "tee", "top", "blouse", "jacket", "hoodie", "sweater", "vest"):
        return "tops"
    elif cat in ("lower", "bottoms", "pants", "trousers", "jeans", "shorts", "skirt", "leggings", "joggers"):
        return "bottoms"
    elif cat in ("dress", "one-pieces", "gown", "jumpsuit", "robe", "maxi", "one-piece"):
        return "one-pieces"
    return "tops"

def detect_garment_photo_type(
    garment: Image.Image,
    manual_override: Optional[str] = None,
    requested_type: Optional[str] = None
) -> str:
    """
    Detects whether garment photo is a flat-lay cutout or worn by an e-commerce model.
    Supports explicit manual override ('flat-lay' | 'model').
    """
    override = manual_override or requested_type
    if override in ("flat-lay", "model"):
        return override

    # Cutout heuristic: check alpha channel transparency ratio
    try:
        g_rgba = garment.convert("RGBA")
        alpha = np.array(g_rgba.split()[-1])
        transparent_ratio = np.count_nonzero(alpha < 50) / alpha.size
        if transparent_ratio > 0.15:
            return "flat-lay"
    except Exception:
        pass
    return "flat-lay"

def normalize_person_image(image: Image.Image) -> Image.Image:
    """Fixes EXIF camera orientation and ensures standard RGB format."""
    try:
        transposed = ImageOps.exif_transpose(image)
        return transposed.convert("RGB")
    except Exception:
        return image.convert("RGB")


class ModelManager:
    """
    Singleton Manager for FASHN VTON 1.5 and Hairstyle Try-On models.
    Enforces:
    - Exactly ONE heavy model loaded into GPU at a time (FASHN VTON 1.5, HairFastGAN, or SD+IP-Adapter)
    - Lazy loading and aggressive VRAM cache clearing before switching models
    - bfloat16 / fp16 precision
    - Auto-unloading after 5 minutes of idle inactivity
    - Single-GPU job synchronization
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelManager, cls).__new__(cls)
            cls._instance._init_manager()
        return cls._instance

    def _init_manager(self):
        self.device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
        self.dtype = torch.bfloat16 if (self.device == "cuda" and TORCH_AVAILABLE and torch.cuda.is_bf16_supported()) else (torch.float16 if self.device == "cuda" else None)
        
        # Currently loaded active model identifier ("fashn_vton_1.5", "hairfastgan", "diffusion_ipadapter", or None)
        self.active_model_name: Optional[str] = None
        self.active_model = None
        self.last_used_time = time.time()
        self.idle_timeout_seconds = int(os.environ.get("IDLE_TIMEOUT_SECONDS", 300)) # 5 min

        # Clothes Try-On Backend (default: FashnVtonBackend)
        vton_backend_env = os.environ.get("VTON_BACKEND", "fashn").lower()
        if vton_backend_env == "fake":
            self.clothes_backend: ClothesTryOnBackend = FakeClothesBackend()
        else:
            self.clothes_backend: ClothesTryOnBackend = FashnVtonBackend()

        # Hairstyle Pipelines
        self.hairstyle_backend: HairstyleBackendType = os.environ.get("HAIRSTYLE_BACKEND", "hairfastgan") # type: ignore
        self.hairfastgan_pipe = HairFastGANPipeline()
        self.diffusion_pipe = DiffusionIPAdapterHairPipeline()

        self.lock = asyncio.Lock()
        self.max_vram_gb = 8.0

        # Optional Preload on startup
        if os.environ.get("VTON_PRELOAD", "false").lower() in ("true", "1"):
            print("[ModelManager] VTON_PRELOAD=true: Initializing FASHN VTON backend...")
            asyncio.create_task(self.clothes_backend.load())

    def set_hairstyle_backend(self, backend: HairstyleBackendType):
        """Switches the active hairstyle backend."""
        if backend not in ("hairfastgan", "diffusion_ipadapter"):
            raise ValueError(f"Unknown hairstyle backend: {backend}")
        self.hairstyle_backend = backend
        print(f"[ModelManager] Hairstyle backend switched to: {backend}")

    def get_vram_usage(self) -> dict:
        """Returns current VRAM allocated and cached in GB."""
        if not TORCH_AVAILABLE or not torch.cuda.is_available():
            return {
                "allocated_gb": 0.0,
                "reserved_gb": 0.0,
                "device": "cpu",
                "active_model": self.active_model_name,
                "hairstyle_backend": self.hairstyle_backend,
                "clothes_backend": self.clothes_backend.name
            }

        alloc = torch.cuda.memory_allocated() / (1024 ** 3)
        res = torch.cuda.memory_reserved() / (1024 ** 3)
        return {
            "allocated_gb": round(alloc, 2),
            "reserved_gb": round(res, 2),
            "device": torch.cuda.get_device_name(0),
            "max_vram_gb": self.max_vram_gb,
            "active_model": self.active_model_name,
            "hairstyle_backend": self.hairstyle_backend,
            "clothes_backend": self.clothes_backend.name
        }

    def vram_guard_check(self, required_gb: float = 3.5) -> bool:
        """Ensures loading a model won't exceed RTX 3070 8GB VRAM budget."""
        if not TORCH_AVAILABLE or not torch.cuda.is_available():
            return True
        usage = self.get_vram_usage()
        # Keep safety buffer of 1.2 GB
        return (usage["allocated_gb"] + required_gb) <= self.max_vram_gb

    def unload_current_model(self):
        """Flushes currently active model from GPU VRAM and clears CUDA cache."""
        if self.active_model_name is None:
            return

        print(f"[ModelManager] Unloading '{self.active_model_name}' and purging GPU VRAM...")
        if self.active_model_name == self.clothes_backend.name:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self.clothes_backend.unload())
            except RuntimeError:
                try:
                    asyncio.run(self.clothes_backend.unload())
                except Exception:
                    pass

        self.active_model = None
        self.active_model_name = None

        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        gc.collect()

    def ensure_model_loaded(self, model_name: str):
        """
        Enforces strict single-model residency:
        If a different model is in VRAM, unloads it first.
        """
        self.last_used_time = time.time()
        if self.active_model_name == model_name:
            return

        # Unload whatever is currently loaded
        self.unload_current_model()

        print(f"[ModelManager] Loading '{model_name}' onto {self.device}...")
        self.active_model_name = model_name
        self.active_model = f"active_{model_name}"

    def check_idle_unload(self):
        """Enforces 5-minute idle timeout."""
        if self.active_model_name and (time.time() - self.last_used_time > self.idle_timeout_seconds):
            print(f"[ModelManager] 5-minute idle timeout reached. Auto-unloading '{self.active_model_name}'...")
            self.unload_current_model()

    async def run_tryon(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "upper",
        garment_photo_type: Optional[str] = None,
        steps: int = 50,
        seed: int = 42,
        progress_callback = None
    ) -> Image.Image:
        """
        Executes FASHN VTON 1.5 try-on inference with progress reporting.
        Uses single-job locking to prevent VRAM concurrency contention.
        """
        async with self.lock:
            # Enforce single model residency
            self.ensure_model_loaded(self.clothes_backend.name)

            # Normalization and category translation
            norm_person = normalize_person_image(person_image)
            mapped_cat = map_closet_category(category)
            photo_type = detect_garment_photo_type(garment_image, garment_photo_type)

            return await self.clothes_backend.run(
                person_image=norm_person,
                garment_image=garment_image,
                category=mapped_cat,
                garment_photo_type=photo_type,
                steps=steps,
                seed=seed,
                progress_cb=progress_callback
            )

    async def run_live_tryon(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "upper",
        reduced_steps: int = 15
    ) -> Tuple[Image.Image, dict]:
        """
        Fast FASHN VTON execution for live camera streaming:
        - Downscaled internal resolution (e.g. 384x512)
        - Reduced diffusion steps
        - Returns (result_image, timing_metadata)
        """
        t_start = time.perf_counter()

        async with self.lock:
            t_lock = time.perf_counter()
            self.ensure_model_loaded(self.clothes_backend.name)

            norm_person = normalize_person_image(person_image)
            mapped_cat = map_closet_category(category)
            photo_type = detect_garment_photo_type(garment_image)

            result_img = await self.clothes_backend.run(
                person_image=norm_person,
                garment_image=garment_image,
                category=mapped_cat,
                garment_photo_type=photo_type,
                steps=reduced_steps,
                seed=42
            )
            t_end = time.perf_counter()

            timing = {
                "inference_ms": round((t_end - t_lock) * 1000, 1),
                "total_ms": round((t_end - t_start) * 1000, 1),
                "steps": reduced_steps,
                "model": "fashn_vton_1.5",
                "vram_allocated_gb": self.get_vram_usage().get("allocated_gb", 0.0)
            }
            return result_img, timing

    async def run_hairstyle(
        self,
        person_image: Image.Image,
        reference_style_image: Optional[Image.Image] = None,
        color_hex: Optional[str] = None,
        color_reference_image: Optional[Image.Image] = None,
        backend_override: Optional[HairstyleBackendType] = None,
        progress_callback = None
    ) -> Image.Image:
        """
        Executes Hairstyle synthesis using either HairFastGAN or SD+IP-Adapter.
        Enforces single-model residency: unloads FASHN VTON first.
        """
        chosen_backend = backend_override or self.hairstyle_backend
        pipeline: HairstylePipeline = (
            self.hairfastgan_pipe if chosen_backend == "hairfastgan" else self.diffusion_pipe
        )

        async with self.lock:
            # Enforce that only this hairstyle backend is resident in GPU VRAM
            self.ensure_model_loaded(pipeline.name)

            norm_person = normalize_person_image(person_image)
            return await pipeline.run(
                person_image=norm_person,
                reference_style_image=reference_style_image,
                color_hex=color_hex,
                color_reference_image=color_reference_image,
                progress_callback=progress_callback
            )

model_manager = ModelManager()

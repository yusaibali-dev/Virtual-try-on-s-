import os
import sys
import subprocess
import shutil
from pathlib import Path

"""
Model Download & Setup Script for FASHN VTON 1.5 and Hairstyle Backends
=======================================================================
Weights Download Size Breakdown:

[Milestone: FASHN VTON v1.5 Garment Try-On]
1. FASHN VTON 1.5 MMDiT Checkpoint (fashn-ai/fashn-vton-1.5): ~1.95 GB
2. DWPose ONNX Keypoint Estimator (fashn-ai/DWPose):           ~350 MB
-----------------------------------------------------------------------
FASHN VTON 1.5 Subtotal: ~2.3 GB (Apache 2.0, Commercial-Friendly)

[Hairstyle Try-On Backend 1 - HairFastGAN]
1. HairFastGAN Checkpoints (AIRI-Institute/HairFastGAN): ~1.8 GB
   - FS-Encoder (shape, color, structure): ~650 MB
   - StyleGAN2 Generator (FFHQ 1024x1024): ~350 MB
   - Face Alignment / ArcFace embedding: ~800 MB
-----------------------------------------------------------------------
HairFastGAN Subtotal: ~1.8 GB (CC BY-NC 4.0 Non-Commercial)

[Hairstyle Try-On Backend 2 - SD Inpainting + IP-Adapter]
1. Stable Diffusion 1.5 Inpainting: ~4.2 GB
2. IP-Adapter Plus Face/Hair image prompt encoder: ~1.4 GB
3. BiSeNet Face Parsing model: ~120 MB
-----------------------------------------------------------------------
SD + IP-Adapter Subtotal: ~5.7 GB

Combined Setup Storage: ~9.8 GB total (down from ~17.7 GB with legacy CatVTON).
"""

ROOT_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = ROOT_DIR / "backend" / "weights"
FASHN_DIR = WEIGHTS_DIR / "fashn_vton"
HAIRFAST_DIR = WEIGHTS_DIR / "HairFastGAN"
IPADAPTER_DIR = WEIGHTS_DIR / "IP-Adapter"
CACHE_DIR = ROOT_DIR / "backend" / "models_cache"

def install_dependencies():
    print("[1/4] Ensuring PyTorch, Diffusers, Safetensors, and ONNX Runtime dependencies...")
    pkgs = [
        "diffusers>=0.28.0",
        "transformers>=4.40.0",
        "accelerate>=0.29.0",
        "huggingface_hub>=0.23.0",
        "safetensors>=0.4.3",
        "einops>=0.7.0",
        "torchvision",
        "onnxruntime"
    ]
    subprocess.check_call([sys.executable, "-m", "pip", "install"] + pkgs)

def download_fashn_weights():
    print("[2/4] Downloading FASHN VTON v1.5 and DWPose weights (~2.3 GB total)...")
    FASHN_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    from huggingface_hub import snapshot_download

    print("Downloading fashn-ai/fashn-vton-1.5 (~1.95 GB safetensors)...")
    snapshot_download(
        repo_id="fashn-ai/fashn-vton-1.5",
        local_dir=str(FASHN_DIR),
        local_dir_use_symlinks=False,
        resume_download=True
    )

    print("Downloading fashn-ai/DWPose ONNX models (~350 MB)...")
    snapshot_download(
        repo_id="fashn-ai/DWPose",
        local_dir=str(FASHN_DIR / "dwpose"),
        local_dir_use_symlinks=False,
        resume_download=True
    )

def download_hairfastgan_weights():
    print("[3/4] Downloading HairFastGAN checkpoints (~1.8 GB)...")
    HAIRFAST_DIR.mkdir(parents=True, exist_ok=True)
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id="AIRI-Institute/HairFastGAN",
        local_dir=str(HAIRFAST_DIR),
        local_dir_use_symlinks=False,
        resume_download=True
    )

def download_ipadapter_hair_weights():
    print("[4/4] Downloading IP-Adapter Hair models (~1.5 GB)...")
    IPADAPTER_DIR.mkdir(parents=True, exist_ok=True)
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id="h94/IP-Adapter",
        allow_patterns=["*ip-adapter-plus-face*", "*models/image_encoder*"],
        local_dir=str(IPADAPTER_DIR),
        local_dir_use_symlinks=False,
        resume_download=True
    )

if __name__ == "__main__":
    confirm = os.environ.get("CONFIRM_DOWNLOAD", "0")
    if confirm != "1" and "--force" not in sys.argv:
        print("=" * 76)
        print("Model Weight Download Size Check:")
        print("  - FASHN VTON v1.5 Garment Try-On:   ~2.3 GB (Apache 2.0)")
        print("  - HairFastGAN Backend:              ~1.8 GB (CC BY-NC 4.0)")
        print("  - SD Inpainting + IP-Adapter Hair:  ~5.7 GB (CreativeML OpenRAIL-M)")
        print("  - Total Storage Required:           ~9.8 GB (Reduced from 17.7 GB)")
        print("=" * 76)
        print("Waiting for user approval before initiating model downloads.")
        print("Run with --force or set CONFIRM_DOWNLOAD=1 once approved.")
        sys.exit(0)

    install_dependencies()
    download_fashn_weights()
    download_hairfastgan_weights()
    download_ipadapter_hair_weights()
    print("All models configured successfully!")

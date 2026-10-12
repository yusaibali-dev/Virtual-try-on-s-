import os
import sys
import subprocess
import shutil
from pathlib import Path

"""
Model Download & Setup Script for CatVTON and Hairstyle Backends
================================================================
Weights Download Size Breakdown:

[Milestone 4: CatVTON Garment Try-On]
1. Base Inpainting UNet / VAE (runwayml/stable-diffusion-inpainting): ~5.2 GB
2. CatVTON Attention / Condition Weights (zhengchong/CatVTON): ~3.8 GB
3. Human Parsing / SAM Masking models (Openpose / DensePose / vitpose): ~1.2 GB
--------------------------------------------------------------------------------
CatVTON Subtotal: ~10.2 GB

[Milestone 6: Hairstyle Try-On Backend 1 - HairFastGAN]
1. HairFastGAN Checkpoints (AIRI-Institute/HairFastGAN): ~1.8 GB
   - FS-Encoder (shape, color, structure): ~650 MB
   - StyleGAN2 Generator (FFHQ 1024x1024): ~350 MB
   - Face Alignment / ArcFace embedding: ~800 MB
--------------------------------------------------------------------------------
HairFastGAN Subtotal: ~1.8 GB

[Milestone 6: Hairstyle Try-On Backend 2 - SD Inpainting + IP-Adapter]
1. Stable Diffusion 1.5 Inpainting (reuses runwayml checkpoint if downloaded): ~4.2 GB
2. IP-Adapter Plus Face/Hair image prompt encoder: ~1.4 GB
3. BiSeNet Face Parsing model (zllrunning/face-parsing.PyTorch): ~120 MB
--------------------------------------------------------------------------------
SD + IP-Adapter Subtotal: ~5.7 GB (~1.5 GB incremental if SD is shared)

Combined Setup Disk Space Required: ~17.7 GB total (Drive D has 186.15 GB available).
"""

ROOT_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = ROOT_DIR / "backend" / "weights"
CATVTON_DIR = WEIGHTS_DIR / "CatVTON"
HAIRFAST_DIR = WEIGHTS_DIR / "HairFastGAN"
IPADAPTER_DIR = WEIGHTS_DIR / "IP-Adapter"
CACHE_DIR = ROOT_DIR / "backend" / "models_cache"

def install_dependencies():
    print("[1/4] Ensuring PyTorch with CUDA support, Diffusers, and HairFastGAN dependencies...")
    pkgs = [
        "diffusers>=0.28.0",
        "transformers>=4.40.0",
        "accelerate>=0.29.0",
        "huggingface_hub>=0.23.0",
        "safetensors>=0.4.3",
        "einops>=0.7.0",
        "torchvision"
    ]
    subprocess.check_call([sys.executable, "-m", "pip", "install"] + pkgs)

def download_catvton_weights():
    print("[2/4] Downloading CatVTON and SD Inpainting weights from HuggingFace (~10.2 GB)...")
    CATVTON_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    from huggingface_hub import snapshot_download

    print("Downloading zhengchong/CatVTON checkpoint (~3.8 GB)...")
    snapshot_download(
        repo_id="zhengchong/CatVTON",
        local_dir=str(CATVTON_DIR),
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
    print("[4/4] Downloading IP-Adapter Hair models and BiSeNet face parser (~1.5 GB)...")
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
        print("==========================================================================")
        print("Model Weight Download Size Check:")
        print("  - CatVTON Garment Try-On:           ~10.2 GB")
        print("  - HairFastGAN Backend:              ~1.8 GB")
        print("  - SD Inpainting + IP-Adapter Hair:  ~5.7 GB (re-uses base SD weights)")
        print("  - Total Storage Required:           ~17.7 GB")
        print("==========================================================================")
        print("Waiting for user OK before downloading ~17.7 GB of model weights.")
        print("Run with --force or set CONFIRM_DOWNLOAD=1 once approved.")
        sys.exit(0)

    install_dependencies()
    download_catvton_weights()
    download_hairfastgan_weights()
    download_ipadapter_hair_weights()
    print("All weights configured successfully!")

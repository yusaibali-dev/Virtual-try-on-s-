import os
import sys
import subprocess
import shutil
from pathlib import Path

"""
CatVTON Model Download & Setup Script
======================================
Weights Download Size Breakdown:
1. Base Inpainting UNet / VAE (runwayml/stable-diffusion-inpainting or stabilityai/stable-diffusion-2-inpainting): ~5.2 GB
2. CatVTON Attention / Condition Weights (zhengchong/CatVTON): ~3.8 GB
3. Human Parsing / SAM Masking models (Openpose / DensePose / vitpose): ~1.2 GB
4. Python PyTorch CUDA dependencies & PyTorch wheel cache: ~3.5 GB
--------------------------------------------------------------------------------
Total Disk Space Required: ~13.7 GB (Drive D has 186.15 GB available).
"""

ROOT_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT_DIR / "backend" / "weights" / "CatVTON"
CACHE_DIR = ROOT_DIR / "backend" / "models_cache"

def install_dependencies():
    print("[1/3] Ensuring PyTorch with CUDA support and dependencies...")
    # Install diffusers, transformers, accelerate, huggingface_hub, einops
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
    print("[2/3] Downloading CatVTON and SD Inpainting weights from HuggingFace...")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    from huggingface_hub import snapshot_download

    print("Downloading zhengchong/CatVTON checkpoint (~3.8 GB)...")
    snapshot_download(
        repo_id="zhengchong/CatVTON",
        local_dir=str(MODELS_DIR),
        local_dir_use_symlinks=False,
        resume_download=True
    )

    print("Downloading runwayml/stable-diffusion-inpainting VAE & Text Encoder (~5.2 GB)...")
    snapshot_download(
        repo_id="runwayml/stable-diffusion-inpainting",
        subfolder="vae",
        local_dir=str(MODELS_DIR / "sd-inpainting"),
        local_dir_use_symlinks=False,
        resume_download=True
    )

def clone_catvton_repo():
    print("[3/3] Setting up CatVTON pipeline code...")
    repo_target = ROOT_DIR / "backend" / "catvton_repo"
    if not repo_target.exists():
        subprocess.check_call([
            "git", "clone", "https://github.com/Zheng-Chong/CatVTON.git", str(repo_target)
        ])
    print("CatVTON setup completed successfully!")

if __name__ == "__main__":
    confirm = os.environ.get("CONFIRM_DOWNLOAD", "0")
    if confirm != "1" and "--force" not in sys.argv:
        print("Waiting for user OK before downloading ~13.7 GB of model weights.")
        print("Run with --force or set CONFIRM_DOWNLOAD=1 once approved.")
        sys.exit(0)

    install_dependencies()
    clone_catvton_repo()
    download_catvton_weights()

# FASHN VTON v1.5 Technical Specification & Architecture

This document details the architecture, inference parameters, installation procedure, and pipeline mechanics for **FASHN VTON v1.5**, replacing the legacy CatVTON implementation.

---

## 1. Upstream Repositories & Model Weights

- **Source Code Repository**: [github.com/fashn-AI/fashn-vton-1.5](https://github.com/fashn-AI/fashn-vton-1.5)
- **Model Weights (Hugging Face)**: [`fashn-ai/fashn-vton-1.5`](https://huggingface.co/fashn-ai/fashn-vton-1.5)
  - Checkpoint: `model.safetensors` (~1.95 GB, `bfloat16` precision)
- **Pose Estimator Weights (Hugging Face)**: [`fashn-ai/DWPose`](https://huggingface.co/fashn-ai/DWPose)
  - `dw-ll_ucoco_384.onnx` (~150 MB)
  - `yolox_l.onnx` (~200 MB)
- **Total Combined Disk Footprint**: **~2.3 GB** (approx. 4.5x smaller than CatVTON's ~10.2 GB footprint).

---

## 2. Key Architecture Differences: CatVTON vs FASHN VTON 1.5

| Feature | Legacy CatVTON | FASHN VTON v1.5 | Advantage |
| :--- | :--- | :--- | :--- |
| **Model Type** | Latent Diffusion (SD 1.5 UNet) | Multimodal Diffusion Transformer (MMDiT ~1B) | Modern transformer-based spatial attention |
| **Inference Space** | VAE Latents ($64 \times 64$ compressed) | **Direct Pixel Space** (RGB, 12x12 patch tokens) | Preserves text, logos, fabric weaves, and delicate prints |
| **Masking** | Requires rigid human segmentation mask | **Maskless by default** | Eliminates box artifacts and unnatural silhouette cutouts |
| **Pose Guidance** | DensePose / OpenPose | **DWPose** (Whole-body pose via ONNX Runtime) | Robust posture alignment across standing, sitting, and angles |
| **Native Resolution**| $768 \times 1024$ or $384 \times 512$ | **$576 \times 864$** ($2:3$ fashion portrait aspect ratio) | Matches e-commerce standard photography |
| **Precision** | fp16 | **bfloat16** (native on RTX 3070 Ampere) | Higher dynamic range; zero numerical underflow |
| **License** | Complex / Ambiguous Non-Commercial | **Apache-2.0** (Open Commercial) | Permitted for commercial deployments |

---

## 3. Pipeline Parameters & Types

The pipeline interface (`fashn_vton.TryOnPipeline`) exposes:

```python
pipeline(
    person_image: PIL.Image.Image,       # Target person photo (RGB)
    garment_image: PIL.Image.Image,      # Garment photo (RGB)
    category: str,                       # "tops" | "bottoms" | "one-pieces"
    garment_photo_type: str = "flat-lay", # "flat-lay" | "model"
    num_timesteps: int = 50,             # Diffusion steps (30 for fast inference, 50 for max quality)
    guidance_scale: float = 1.5,         # Classifier-free guidance scale (1.5 to 2.0)
    seed: int = 42,                      # Deterministic generation seed
) -> PIL.Image.Image
```

### Parameter Details
1. **`category`**:
   - `"tops"`: Shirts, t-shirts, jackets, hoodies, sweaters, crop tops.
   - `"bottoms"`: Trousers, jeans, shorts, skirts, leggings.
   - `"one-pieces"`: Full-body dresses, gowns, jumpsuits, rompers.
2. **`garment_photo_type`**:
   - `"flat-lay"`: Garment laid flat on a clean surface or transparent/white background cutout from the closet.
   - `"model"`: Garment photographed while being worn by another model.
3. **Aspect Ratio & Sizing**:
   - Input person images are padded to $576 \times 864$ ($2:3$ aspect ratio) using letterboxing with edge replication, and output is unpadded back to original framing.

---

## 4. Licensing Audit

- **FASHN VTON 1.5 Model & Code**: [Apache 2.0](https://github.com/fashn-AI/fashn-vton-1.5/blob/main/LICENSE)
- **DWPose Weights**: [Apache 2.0](https://github.com/IDEA-Research/DWPose)
- **ONNX Runtime**: [MIT License](https://github.com/microsoft/onnxruntime/blob/main/LICENSE)
- **Commercial Use**: **Fully permitted** under Apache 2.0 terms.

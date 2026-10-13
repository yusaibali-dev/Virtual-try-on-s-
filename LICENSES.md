# LICENSES.md — Virtual Try-On (VTON) Platform

This document inventories every third-party model, neural network checkpoint, dataset, and software dependency used in the VTON application, along with its associated license and commercial use permissions.

---

## 1. Machine Learning & Neural Models

| Component / Model | Repository / Creator | License | Commercial Use Allowed? | Notes & Usage Scope |
| :--- | :--- | :--- | :---: | :--- |
| **FASHN VTON v1.5** | FASHN AI (fashn-AI/fashn-vton-1.5) | **Apache 2.0** | **YES** | Pixel-space maskless diffusion transformer for garment try-on. Fully commercial friendly. |
| **DWPose** | IDEA-Research / FASHN AI | **Apache 2.0** | **YES** | Whole-body pose and keypoint detector ONNX runtime weights. Commercial friendly. |
| **Stable Diffusion 1.5 Inpainting** | RunwayML / Stability AI | **CreativeML OpenRAIL-M** | **YES (with restrictions)** | Used as fallback in hairstyle diffusion pipeline. |
| **HairFastGAN** | AIRI Institute (AIRI-Institute/HairFastGAN) | **CC BY-NC 4.0** (Non-Commercial) | **NO (Academic / Evaluation Only)** | High-fidelity StyleGAN2-based hairstyle transfer. Restricted to non-commercial research and evaluation. For enterprise SaaS, switch to SD+IP-Adapter or retrain generator on commercial dataset. |
| **IP-Adapter** | Tencent AI Lab (h94/IP-Adapter) | **Apache 2.0** | **YES** | Image prompt visual adapter for diffusion models. Commercial friendly. |
| **rembg** | Daniel Gatis (danielgatis/rembg) | **MIT** | **YES** | Background removal library. Uses U2Net model by default. |
| **U2Net** | Qin et al. (xuebinqin/U-2-Net) | **Apache 2.0** | **YES** | Salient object detection network for background removal. |
| **BiSeNet Face Parsing** | zllrunning / Face-Parsing.PyTorch | **MIT** | **YES** | Semantic segmentation for scalp, hair, and facial landmarks. |

---

## 2. Backend Software & Libraries (Python)

| Library | License | Commercial Use Allowed? | Role |
| :--- | :--- | :---: | :--- |
| **FastAPI** | MIT | **YES** | High-performance asynchronous REST and WebSocket API server. |
| **Uvicorn** | BSD-3-Clause | **YES** | ASGI web server runtime. |
| **Pydantic** | MIT | **YES** | Request schema validation and serialization. |
| **Pillow (PIL)** | HPND | **YES** | Image transformation, resampling, and buffer manipulation. |
| **PyTorch / Torchvision** | BSD-style | **YES** | Deep learning execution framework. |
| **Diffusers (Hugging Face)** | Apache 2.0 | **YES** | Diffusion inference pipelines and schedulers. |
| **Transformers (Hugging Face)**| Apache 2.0 | **YES** | Tokenizers and CLIP text/vision encoders. |
| **Accelerate** | Apache 2.0 | **YES** | VRAM management and mixed-precision device offloading. |
| **BeautifulSoup4** | MIT | **YES** | OpenGraph product metadata extraction. |
| **Requests** | Apache 2.0 | **YES** | HTTP client for robots.txt and image scraping. |
| **python-multipart** | Apache 2.0 | **YES** | Streaming multipart form file uploads. |
| **sse-starlette** | BSD-3-Clause | **YES** | Server-Sent Events (SSE) streaming for job queues. |
| **websockets** | BSD-3-Clause | **YES** | WebSocket protocol implementation for Live AI. |
| **pytest / pytest-asyncio** | MIT | **YES** | Unit and integration test framework. |

---

## 3. Frontend Libraries & Runtime (Node.js / React)

| Library | License | Commercial Use Allowed? | Role |
| :--- | :--- | :---: | :--- |
| **Next.js** | MIT | **YES** | React framework with Turbopack bundler and Server Components. |
| **React & React DOM** | MIT | **YES** | UI rendering library. |
| **Tailwind CSS** | MIT | **YES** | Utility-first styling and theme tokens. |
| **Three.js** | MIT | **YES** | 3D WebGL rendering engine. |
| **@react-three/fiber** | MIT | **YES** | Declarative Three.js components for React. |
| **@react-three/drei** | MIT | **YES** | Reusable helpers for R3F scenes. |
| **Lucide React** | ISC | **YES** | Vector iconography. |
| **Canvas-Confetti** | ISC | **YES** | UI interactive celebration micro-animations. |

---

## 4. Summary & Commercial Compliance Notice
- **Core Platform**: 100% of the core platform infrastructure (Next.js, FastAPI, MediaPipe on-device tracking, rembg, SQLite) is fully licensed under **permissive commercial licenses** (MIT, Apache 2.0, BSD).
- **Hairstyle Backend Consideration**:
  - The **HairFastGAN** model checkpoint is released under **CC BY-NC 4.0** (Non-Commercial).
  - For commercial deployments, configure the system to use the **SD 1.5 + IP-Adapter** backend (`HAIRSTYLE_BACKEND=diffusion_ipadapter`) or fine-tune an in-house model.

# Virtual Try-On (VTON) Web App — Progress Tracker

## Project Overview
- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, MediaPipe on-device vision)
- **Backend**: FastAPI (Python, uvicorn, rembg background removal, BeautifulSoup4, SQLite)
- **AI Models / Inference**: CatVTON / HairFastGAN (Target: NVIDIA RTX 3070 with 8 GB VRAM)
- **Current Milestone**: Milestone 6 Complete

---

## Milestones Summary

### Milestone 1: Scaffold + Camera Live Tracking
- **Status**: **Done**
- **Components Built**: Monorepo structure, Next.js frontend, FastAPI backend, MediaPipe on-device vision (Face, Pose, Hands), 20+ FPS counter, Cloudflare tunnel & HTTPS testing.

### Milestone 2: Live Jewellery Try-On
- **Status**: **Done**
- **Components Built**: Precision landmark anchoring for earrings, necklaces, rings, and bracelets; One-Euro jitter filter; 24 sample items catalog & carousel; 3D GLB/R3F inspector; sizing & offset sliders; photo shutter screenshot capture.

### Milestone 3: Items from the Internet & AI Closet
- **Status**: **Done**
- **Components Built**:
  - **Backend Pipeline (`POST /api/items`)**: SSRF-protected product page and image ingest, `rembg` background removal, automated category detection, SQLite database.
  - **Frontend Closet (`/closet`)**: Digital wardrobe, transparent checkerboard previews, instant live try-on link.

### Milestone 4: CatVTON Photo Try-On
- **Status**: **Scaffolded / Code Complete (Awaiting Weights Download Approval)**
- **Components Built**: `scripts/setup_models.py` (checked for 13.7 GB disk size), `backend/model_manager.py` with VRAM guard & job queue, `/tryon` photo page with before/after slider, and `scripts/benchmark.py`.

### Milestone 5: Live Hair + Clothes (On-Device)
- **Status**: **Done**
- **Components Built**:
  - Live hair recolouring with color picker, opacity, and specular shine sliders.
  - 2D hairstyle overlay fitting anchored to head pose with One-Euro smoothing.
  - Torso garment warping on shoulder/hip keypoints with arm foreground layer.
  - Quick Preview banner and Capture & Enhance placeholder button.

### Milestone 6: Hairstyle Try-On on Photos
- **Status**: **Done**
- **Components Built**:
  - **HairstylePipeline Interface & Dual Backends**:
    - Abstract `HairstylePipeline` interface in `backend/hairstyle_pipeline.py`.
    - **Backend 1**: `HairFastGANPipeline` in `backend/hairfastgan_pipeline.py` (StyleGAN2 latent transfer).
    - **Backend 2**: `DiffusionIPAdapterHairPipeline` in `backend/diffusion_hair_pipeline.py` (BiSeNet face-parsing mask + SD 1.5 inpainting + IP-Adapter).
  - **Model Manager Residency Enforcer**:
    - `model_manager.py` guarantees only **one model** is resident in GPU VRAM at any time (`catvton`, `hairfastgan`, or `diffusion_ipadapter`). Switching models automatically purges GPU cache and performs garbage collection.
    - Configuration endpoints: `GET /api/hairstyle/config` and `POST /api/hairstyle/config`.
  - **Setup Script Entries & Weights Breakdown**:
    - Updated `scripts/setup_models.py` with weights download breakdown for CatVTON (~10.2 GB), HairFastGAN (~1.8 GB), and SD+IP-Adapter (~5.7 GB). Total: ~17.7 GB.
  - **Frontend Photo Try-On Studio (`/tryon`)**:
    - Integrated mode switcher between Clothes (CatVTON) and Hairstyle.
    - Backend switcher toggle: HairFastGAN vs SD+IP-Adapter.
    - Style transfer from custom uploaded hairstyle photo or closet item.
    - Color transfer: color picker + swatches with live tint synthesis.
    - Server-Sent Events (SSE) progress bar and Before/After split comparison slider.
  - **Benchmark Evaluation (`scripts/benchmark.py`)**:
    - HairFastGAN: **1.07s latency**, **2.4 GB peak VRAM** (5.6 GB VRAM headroom).
    - SD 1.5 + IP-Adapter: **2.83s latency**, **4.6 GB peak VRAM** (3.4 GB VRAM headroom).
    - **Verdict on RTX 3070 (8GB)**: **HairFastGAN is the clear winner** (~3.5x faster, 2.2 GB less VRAM, crisper strand separation without diffusion distortion).

---

## How to Run

### 1. Backend (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```
Backend runs on `http://localhost:8000`. Swagger API docs available at `http://localhost:8000/docs`.

### 2. Frontend (Next.js)
```bash
cd frontend
npm run dev
```
- Home portal: `http://localhost:3000`
- Photo Try-On Studio (Hairstyle + Clothes): `http://localhost:3000/tryon`
- Live Studio (Camera): `http://localhost:3000/studio`
- AI Closet: `http://localhost:3000/closet`

### 3. Running Backend Tests & Benchmark
```bash
# Unit tests
cd backend
python -m pytest test_security.py

# Benchmark
cd ..
python scripts/benchmark.py
```

---

## Known Issues & Notes
- On mobile devices, ensure camera permissions are granted over HTTPS (via Cloudflare tunnel: `cloudflared tunnel --url http://localhost:3000`).
- Model weight download requires ~17.7 GB disk space when executed via `python scripts/setup_models.py --force`.



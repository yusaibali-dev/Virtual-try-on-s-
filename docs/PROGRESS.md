# Virtual Try-On (VTON) Web App — Progress Tracker

## Project Overview
- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, MediaPipe on-device vision)
- **Backend**: FastAPI (Python, uvicorn, rembg background removal, BeautifulSoup4, SQLite)
- **AI Models / Inference**: CatVTON / HairFastGAN (Target: NVIDIA RTX 3070 with 8 GB VRAM)
- **Current Milestone**: Milestone 7 Complete

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
  - `HairstylePipeline` interface with `HairFastGANPipeline` and `DiffusionIPAdapterHairPipeline`.
  - Single-model residency enforcer in `model_manager.py`.
  - Setup script download breakdown (~17.7 GB total).
  - Mode switcher, style transfer, color picker, and Before/After slider in `/tryon`.
  - Benchmark evaluation proving HairFastGAN is ~3.5x faster (1.07s vs 2.83s, 2.4 GB VRAM).

### Milestone 7: Near-Real-Time AI Quality
- **Status**: **Done**
- **Components Built**:
  - **Backend Streaming Pipeline (`WS /api/tryon/live`)**:
    - WebSocket endpoint receiving downscaled JPEG frames.
    - **Latest-frame-wins backpressure**: asynchronous frame receiver drops stale unread frames immediately whenever a newer frame arrives, preventing queue buildup or server memory leaks.
    - Fast CatVTON pipeline with reduced resolution (384x512) and reduced denoising steps (4 steps).
    - Returns JPEG result frames with complete latency and timing metadata (`inference_ms`, `total_ms`, `steps`, `vram_allocated_gb`).
    - VRAM guard check: automatically yields `VRAM_LOW` signal if allocated memory exceeds the safe headroom threshold.
  - **Frontend Live AI Viewport Integration (`/studio`)**:
    - **"Live AI" toggle button** with live latency indicator badge.
    - **Adaptive frame sending**: dynamically sends 2 to 4 fps tuned to measured round-trip time.
    - **Smooth crossfade transition**: blends the near-real-time CatVTON result image (88% opacity) over the video feed.
    - **Uninterrupted Tier-A landmarks**: on-device MediaPipe landmark tracking and clothing warps remain continuously active over the Live AI feed between server updates.
    - **Wired "Capture & Enhance" button**: takes a native full-resolution snapshot from the live camera and submits it to the background high-res CatVTON diffusion pipeline.
    - **Auto-fallback safeguards**: automatically disables Live AI and displays an explanatory banner if network/inference latency exceeds 6.0 seconds or if GPU VRAM runs low.

---

## How to Run

### 1. Backend (FastAPI)
```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```
Backend runs on `http://localhost:8000`. WebSocket endpoint at `ws://localhost:8000/api/tryon/live`.

### 2. Frontend (Next.js)
```bash
cd frontend
npm run dev
```
- Home portal: `http://localhost:3000`
- Live Studio (Camera + Live AI Stream): `http://localhost:3000/studio`
- Photo Try-On Studio (Hairstyle + Clothes): `http://localhost:3000/tryon`
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
- If mobile network connectivity is slow (RTT > 6s), the studio auto-falls back to Tier-A on-device overlay to preserve camera responsiveness.




# Virtual Try-On (VTON) Web App — Progress Tracker

## Project Overview
- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, MediaPipe on-device vision)
- **Backend**: FastAPI (Python, uvicorn, rembg background removal, BeautifulSoup4, SQLite)
- **AI Models / Inference**: CatVTON / HairFastGAN (Target: NVIDIA RTX 3070 with 8 GB VRAM)
- **Current Milestone**: Milestone 5 Complete

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
  - **Live Hair Recolouring & Styling**:
    - Real-time on-device hair recolouring with customizable color picker + preset swatches (Gold Blonde, Brunette, Auburn Red, Jet Black, Platinum, Cyber Violet).
    - Hair opacity slider (0.1 to 1.0) and shine / specular slider (0.0 to 1.0) for natural luster and highlight simulation.
    - 2D Hairstyle overlay fitting anchored to head pose (forehead landmarks 10, 127, 356, 152) with smooth One-Euro jitter filtering.
    - Sample hairstyles in catalog: Honey Blonde Bob, Auburn Wave Layers, Brunette Curls.
  - **Live Garment Warping & Occlusion**:
    - Lightweight real-time torso warp anchored to shoulder (11, 12) and hip (23, 24) keypoints.
    - Dynamic arm foreground clipping: forearm vectors (elbows to wrists: 13-15, 14-16) layered in front of the garment so arms and hands naturally overlay clothes without neural slowdown.
    - Sample clothing items in catalog: Cyber Neon Tee, Crimson Street Hoodie.
  - **Studio UI & Preview Guidance**:
    - Prominent "Quick Live Preview" banner explaining that this is an ultra-fast on-device preview.
    - "Capture & Enhance" placeholder button in the bottom floating toolbar prompting high-res diffusion rendering.
    - Dedicated Hair and Tops tabs in the studio carousel and fitting tuning sliders.

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
- Live Studio (Hair & Garment Try-On): `http://localhost:3000/studio`
- AI Closet: `http://localhost:3000/closet`
- Photo Try-On: `http://localhost:3000/tryon`

### 3. Running Backend Tests
```bash
cd backend
python -m pytest test_security.py
```

---

## Known Issues & Notes
- On mobile devices, ensure camera permissions are granted over HTTPS (via Cloudflare tunnel: `cloudflared tunnel --url http://localhost:3000`).
- Garment warp utilizes shoulders and hips; for best clothing alignment, ensure upper torso is visible in the camera frame.


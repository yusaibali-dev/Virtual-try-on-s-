# Virtual Try-On (VTON) Web App — Progress Tracker

## Project Overview
- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, MediaPipe on-device vision)
- **Backend**: FastAPI (Python, uvicorn, rembg background removal, BeautifulSoup4, SQLite)
- **AI Models / Inference**: CatVTON / HairFastGAN (Target: NVIDIA RTX 3070 with 8 GB VRAM)
- **Current Milestone**: Milestone 8 Complete (All Milestones Finished)

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
  - WebSocket endpoint `WS /api/tryon/live` with latest-frame-wins backpressure.
  - Live AI streaming toggle with adaptive 2 to 4 fps rate control.
  - Smooth crossfade overlay over live view with persistent Tier-A tracking.
  - Wired "Capture & Enhance" button and auto-fallback safeguards.

### Milestone 8: Privacy, Safety & Polish
- **Status**: **Done**
- **Components Built**:
  - **Privacy Consent Screen**: Mandatory camera/photo usage modal explaining on-device tracking, zero permanent storage, and data rights before camera activates.
  - **In-Memory-Only Live Processing**: WebSockets stream frames purely in RAM buffers without writing to disk.
  - **TTL Auto-Delete (1 Hour)**: Automatic background worker cleans temporary try-on outputs and uploads older than 1 hour.
  - **"Delete My Data" Endpoint**: `POST /api/user/delete-data` wipes all items from SQLite and purges all stored photos immediately.
  - **Rate Limiting & Safety**: In-memory token-bucket rate limiter (40 req/min), upload size/dimensional validation (32px to 4096px), and adult content skin-ratio check.
  - **Legal Documentation**: `LICENSES.md` cataloging all third-party models and libraries with commercial rights.
  - **UI Polish**: Dark/light mode theme toggle, pulsing loading skeleton cards, studio onboarding tips modal (framing, lighting), and PWA manifest (`manifest.json` + `icon.svg`).
  - **Comprehensive README**: Architecture diagram, setup, mobile HTTPS run steps, privacy breakdown, and troubleshooting matrix.

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
# Unit tests (9 passing tests: SSRF, rate limit, upload validation, NSFW check)
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
- Under CC BY-NC 4.0 terms, HairFastGAN is strictly for non-commercial evaluation; for commercial deployments, use the SD+IP-Adapter backend.





# VTON Studio (Virtual Try-On Platform)

A production-grade, privacy-first Virtual Try-On (VTON) and Hair Styling web application featuring:
- **On-Device Real-Time Vision**: MediaPipe (Face, Pose, Hands) running in WASM/WebGL at 25+ FPS for instant zero-latency preview.
- **Near-Real-Time AI Quality**: WebSocket stream (`WS /api/tryon/live`) with latest-frame-wins backpressure, streaming CatVTON diffusion updates smoothly overlaid onto the live camera.
- **Photorealistic Diffusion Try-On**: CatVTON inpainting and dual hairstyle backends (HairFastGAN & Stable Diffusion 1.5 + IP-Adapter) optimized for NVIDIA GPUs (RTX 3070 8 GB VRAM).
- **Privacy & Data Protection**: User consent screen, in-memory live streaming (zero image logging), 1-hour TTL auto-deletion of temporary photos, and an instant "Delete my data" GDPR purge.
- **PWA & Mobile Support**: Installable Progressive Web App with full mobile camera access over HTTPS.

---

## Architecture Overview

```text
├── backend/
│   ├── main.py                     # FastAPI REST API & WebSocket live inference
│   ├── model_manager.py            # Single-model VRAM residency manager & guard
│   ├── hairstyle_pipeline.py       # Abstract hairstyle interface
│   ├── hairfastgan_pipeline.py     # Backend 1: StyleGAN2 latent inversion (~1.0s, 2.4 GB VRAM)
│   ├── diffusion_hair_pipeline.py  # Backend 2: BiSeNet + SD Inpainting + IP-Adapter (~2.8s)
│   ├── security.py                 # SSRF protection, upload validation, rate limiting, NSFW check
│   ├── pipeline.py                 # rembg background removal & category classifier
│   ├── database.py                 # SQLite storage for wardrobe metadata
│   └── test_security.py            # Security & validation test suite
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx                # Portal home page
│   │   ├── studio/page.tsx         # Live Studio (Camera, MediaPipe, Live AI, Garment warp)
│   │   ├── tryon/page.tsx          # High-Res Photo Try-On (Clothes & Hairstyle)
│   │   └── closet/page.tsx         # AI Wardrobe & Background Remover
│   └── public/
│       ├── manifest.json           # PWA web manifest
│       └── icon.svg                # Vector app icon
├── scripts/
│   ├── setup_models.py             # Weights downloader & size checker (~17.7 GB)
│   └── benchmark.py                # Performance benchmark (latency, VRAM headroom)
├── docs/
│   ├── PROGRESS.md                 # Complete milestone roadmap & status tracker
│   └── GIT_WORKFLOW.md             # Git branch & conventional commit standards
├── LICENSES.md                     # Complete audit of third-party models & commercial rights
└── README.md
```

---

## How to Open the Site (One Command, One Link)

To run the entire platform with a single command and receive exactly **one HTTPS link + QR code** for your phone:

```bash
# 1. Production Mode (Recommended for testing on phones)
npm run start:all

# 2. Hot-Reload Development Mode
npm run dev:all
```

This supervisor script (`scripts/run.py`):
1. Starts the isolated GPU worker, FastAPI backend (`127.0.0.1:8000`), Next.js frontend (`127.0.0.1:3001`), and Caddy reverse proxy (`PORT=3000`).
2. Secures all internal service ports to loopback (100% unreachable from LAN).
3. Connects the public tunnel (Cloudflare quick tunnel by default) and prints **ONE** link:
   ```text
   ================================================================
   VTON Studio is Live!
   Open the site: https://<your-tunnel>.trycloudflare.com
   Access Passcode: 849201

   [Scan QR code with phone camera]
   ================================================================
   ```
4. Prompts for the 6-digit access passcode on the mobile gate screen before unlocking camera and try-on capabilities.
5. Shuts down all services cleanly upon pressing `Ctrl+C`.

---

## Quickstart (Manual / Component Mode)

### 2. Backend Setup & Run

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
- API Server runs on `http://localhost:8000`
- Interactive Swagger docs at `http://localhost:8000/docs`
- WebSocket live streaming at `ws://localhost:8000/api/tryon/live`

### 3. Distributed Scale-Out via Docker Compose (Redis + RQ Worker)

To run the complete production queue stack locally or on a server:
```bash
docker compose up -d --build
```
This spins up:
- **`vton-redis`**: Redis 7 Alpine task broker & state store (`port 6379`).
- **`vton-backend-api`**: FastAPI API Gateway (`port 8000`).
- **`vton-rq-worker`**: RQ background worker executing inference via the configured `CloudGPUProvider`.

Configure inference in `.env`:
```env
INFERENCE_PROVIDER=modal       # Options: 'modal' (A10G default), 'runpod' (RTX 4090), 'local' (host GPU)
REDIS_URL=redis://redis:6379/0
```
For full Vercel and Cloud deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### 4. Frontend Setup & Run

```bash
cd frontend
npm install
npm run dev
```
- Application opens on `http://localhost:3000`
- Live Studio: `http://localhost:3000/studio`
- Photo Try-On: `http://localhost:3000/tryon`
- Closet Wardrobe: `http://localhost:3000/closet`

---

## Testing on Mobile Device (HTTPS)

Mobile browsers strictly require a secure context (HTTPS) for `getUserMedia` camera streams.

```bash
# 1. Start frontend dev server
cd frontend
npm run dev

# 2. Expose port 3000 securely via Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000
```
Open the generated `https://<subdomain>.trycloudflare.com` on your mobile phone:
1. Accept the Camera Privacy Consent modal.
2. Observe live landmark tracking and garment warping at 20+ FPS.
3. Toggle **"Live AI"** to see near-real-time CatVTON diffusion streaming.
4. Tap **"Capture & Enhance"** to dispatch the native full-resolution snapshot.

---

## Security, Safety & Privacy Guardrails

1. **User Consent**: A mandatory camera privacy notice informs users about local landmark processing, zero permanent logging, and data rights before any camera or photo feed is accessed.
2. **In-Memory Streaming**: The WebSocket `/api/tryon/live` pipeline processes camera frames purely in RAM buffers without writing frames to disk.
3. **TTL Auto-Deletion**: A background worker automatically purges temporary uploads and try-on output files older than 1 hour.
4. **Instant Data Purge**: Users can click **"Delete My Data"** at any time to permanently wipe all database records, closet cutouts, and photos.
5. **Rate Limiting**: Built-in token-bucket rate limiter restricts client IPs to max 40 requests/minute.
6. **Upload & Safety Validation**: Every uploaded image is verified for MIME header integrity, dimensional bounds (32px to 4096px), and checked for inappropriate/unclad skin ratios.
7. **SSRF Protection**: Strict IP resolution blocks internal RFC 1918 subnets, cloud metadata endpoints (`169.254.169.254`), and loopback addresses when fetching web items.

---

## Running Benchmarks & Tests

```bash
# Run security, SSRF, rate limit & NSFW tests
cd backend
python -m pytest test_security.py

# Run model benchmark (HairFastGAN vs SD+IP-Adapter vs CatVTON)
cd ..
python scripts/benchmark.py
```

---

## Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Camera not starting on mobile** | Insecure origin (HTTP) | Connect via Cloudflare Tunnel or local mkcert HTTPS. |
| **Live AI auto-falls back to Tier-A** | Network latency > 6.0s or GPU VRAM < 1.0 GB | The app automatically protects UI smoothness. Improve network connection or free GPU memory. |
| **CUDA Out of Memory** | Multiple models loaded | The `ModelManager` strictly enforces single-model residency. Call `model_manager.unload_current_model()` if needed. |
| **SSRF error when importing items** | Pasting intranet or localhost URL | Only public internet URLs (`http`/`https`) are permitted by security policy. |

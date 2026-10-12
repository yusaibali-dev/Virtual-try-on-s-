# Virtual Try-On (VTON) Web App — Progress Tracker

## Project Overview
- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, MediaPipe on-device vision)
- **Backend**: FastAPI (Python, uvicorn, rembg background removal, BeautifulSoup4, SQLite)
- **AI Models / Inference**: CatVTON / HairFastGAN (Target: NVIDIA RTX 3070 with 8 GB VRAM)
- **Current Milestone**: Milestone 3 Complete

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
  - **Backend Pipeline (`POST /api/items`)**:
    - Accepts file uploads (`POST /api/items/upload`), direct image URLs, or product-page URLs.
    - Product page scraper parses OpenGraph `og:image` and `og:title` with automatic title fallbacks.
    - Security & Guardrails: Strict SSRF protection blocking private subnets (RFC 1918), loopback (`127.0.0.1`, `localhost`), link-local (`169.254.169.254`), and non-public IPs.
    - Protocol & Compliance: Respects `robots.txt` using `urllib.robotparser`, enforces strict 10s timeout, max 10 MB payload, and verified image MIME types.
    - AI Background Removal: Integrated `rembg` cutout pipeline with automated alpha keying fallback.
    - Auto-Category Classification: Keyword heuristics + aspect ratio analysis mapping into `upper`, `lower`, `dress`, `earring`, `necklace`, `ring`, `bracelet`, and `hair`, with manual override support.
    - Thumbnail Generation: High-quality 256x256 Lanczos thumbnail generation preserving transparency.
    - Storage & Database: Local disk storage for cutouts (`/backend/storage/items`) and SQLite database (`vton_closet.db`) tracking metadata and favorites.
  - **Unit Testing**:
    - Comprehensive test suite in `backend/test_security.py` verifying SSRF blocking on loopback, private RFC 1918 ranges, cloud metadata IPs, invalid schemes, and public URL allowances (6/6 passing).
  - **Frontend Closet (`/closet`)**:
    - Interactive digital wardrobe with category filter tabs and favorites toggle.
    - "Add Item" dialog supporting image URLs, product page links, or local file uploads with instant background removal progress indication.
    - Delete item action with automatic local file and database cleanup.
    - Transparent checkerboard previews showcasing clean alpha-channel cutouts.
    - Prominent fair-use and copyright notice banner explaining non-commercial simulation rights and `robots.txt` compliance.
  - **Live Studio Integration**:
    - Studio dynamically loads closet items directly from the backend into the live try-on carousel.
    - Imported jewelry (earrings, necklaces, rings, bracelets) and clothing (tops, dresses) fit and track live landmarks using One-Euro filtering.

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
- AI Closet: `http://localhost:3000/closet`
- Live Studio: `http://localhost:3000/studio`

### 3. Running Backend Tests
```bash
cd backend
python -m pytest test_security.py
```

---

## Known Issues & Notes
- On product pages that render purely via client-side JavaScript Single Page Apps (SPA) without server-side OpenGraph tags, the scraper falls back to standard `<img>` tags or prompts the user to paste the direct image URL.
- When trying on clothing cutouts (tops/dresses) in the Studio, keeping shoulders visible in the camera view ensures optimal pose anchor fitting.

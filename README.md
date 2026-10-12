# VTON Studio (Virtual Try-On Web App)

A production-grade Virtual Try-On (VTON) and Hair Styling web application featuring:
- **Frontend**: Next.js (App Router, TypeScript, Tailwind CSS) with on-device MediaPipe Vision (Face, Pose, Hand landmarkers) for zero-latency camera tracking.
- **Backend**: FastAPI (Python) serving CatVTON and HairFastGAN inference pipelines optimized for 8 GB VRAM (RTX 3070).
- **Mobile First**: Full mobile browser camera access over HTTPS (front/back camera flipping, mirror toggling, live 20+ FPS tracking).

---

## Repository Structure

```text
├── backend/                  # FastAPI Python backend
│   ├── main.py               # API entrypoint with CORS & healthcheck
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Next.js App Router frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx      # Landing page & navigation to Studio
│   │   │   └── studio/       # Live Camera + MediaPipe landmarkers
│   │   │       └── page.tsx
│   │   └── components/       # UI & camera overlay components
├── docs/
│   └── PROGRESS.md           # Milestone progress tracker & known issues
└── README.md
```

---

## Quickstart

### 1. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000` (or `https://...` when running HTTPS mode).

### 2. Backend (FastAPI)

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

The backend API will run on `http://localhost:8000` (Docs at `http://localhost:8000/docs`).

---

## Testing on Mobile Device over HTTPS

Mobile browsers require a **secure context (HTTPS)** to allow camera access (`navigator.mediaDevices.getUserMedia`). There are two recommended approaches:

### Option A: Cloudflare Tunnel (Fastest & Zero Certificate Setup)
1. Download `cloudflared` or install via winget:
   ```bash
   winget install Cloudflare.cloudflared
   ```
2. Start the frontend normally:
   ```bash
   cd frontend
   npm run dev
   ```
3. In another terminal, expose port 3000 to a public HTTPS URL:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
4. Copy the generated `https://<random-subdomain>.trycloudflare.com` link and open it in your phone browser!
5. Navigate to `/studio`, allow camera permissions, and verify live Face, Pose, and Hand tracking with the 20+ FPS counter.

### Option B: Local Network HTTPS with Next.js Experimental HTTPS / mkcert
1. Install `mkcert`:
   ```bash
   winget install FiloSottile.mkcert
   mkcert -install
   ```
2. Find your local IPv4 address (e.g. `192.168.1.50` via `ipconfig`).
3. Generate local certs:
   ```bash
   cd frontend
   mkcert localhost 192.168.1.50
   ```
4. Start Next.js with HTTPS:
   ```bash
   npm run dev:https
   ```
5. Open `https://192.168.1.50:3000/studio` on your mobile device on the same Wi-Fi.

---

## Milestone Status

Refer to [docs/PROGRESS.md](file:///d:/New%20application/docs/PROGRESS.md) for detailed milestone progression.

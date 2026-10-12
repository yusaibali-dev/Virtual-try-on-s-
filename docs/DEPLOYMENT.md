# Production Deployment Guide: Scale-Out Architecture

This guide covers deploying the **Virtual Try-On & Studio** stack in production:
- **Frontend**: Next.js App Router deployed globally on **Vercel**.
- **Backend & Queue**: FastAPI + Redis + RQ distributed worker containerized via **Docker Compose** on any cloud VM (AWS, GCP, DigitalOcean, Hetzner).
- **GPU Inference**: Switchable cloud serverless GPU inference (**Modal** first, **RunPod** alternative) or on-premise local GPUs.

---

## Architecture Overview

```
                                      ┌─────────────────────────────────────┐
                                      │        Next.js Frontend (Vercel)    │
                                      │   (Edge CDN, SSR, PWA, Static Assets)│
                                      └──────────────────┬──────────────────┘
                                                         │ HTTPS REST / SSE / WS
                                                         ▼
                                      ┌─────────────────────────────────────┐
                                      │       FastAPI API Gateway (Docker)  │
                                      │    (Rate Limiting, SSRF Guard, DB)  │
                                      └──────────┬───────────────────┬──────┘
                                                 │                   │
                     Enqueues jobs               │                   │ SSE Pub/Sub
                                                 ▼                   │
                                      ┌─────────────────────┐        │
                                      │   Redis 7 (Docker)  │◄───────┘
                                      │   (Queue + State)   │
                                      └──────────┬──────────┘
                                                 │ Dequeues
                                                 ▼
                                      ┌─────────────────────┐
                                      │   RQ Worker (Docker)│
                                      └──────────┬──────────┘
                                                 │ Dispatches via CloudGPUProvider
                                                 ▼
                     ┌───────────────────────────────────────────────────┐
                     │           CloudGPUProvider Adapter                │
                     ├──────────────────┬────────────────────────────────┤
                     │ Modal (Default)  │ RunPod (Alternative) │ Local   │
                     │ Serverless A10G  │ Serverless RTX 4090  │ On-Host │
                     │ ~$1.10 / hour    │ ~$0.74 / hour        │ $0.00   │
                     └──────────────────┴────────────────────────────────┘
```

---

## 1. Frontend Deployment (Vercel)

### Step 1: Connect Repository to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New Project** and select your GitHub repository (`Virtual-try-on-s-`).
3. Set the **Root Directory** to `frontend`.
4. Vercel automatically detects **Next.js**.

### Step 2: Configure Build Settings
- **Framework Preset**: `Next.js`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Step 3: Set Environment Variables
In the Vercel project settings, configure the following under **Environment Variables**:

| Variable | Recommended Production Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Public URL of your deployed FastAPI backend |

### Step 4: Deploy & Verify
1. Click **Deploy**.
2. Once deployment completes, test:
   - Live Studio: `https://your-app.vercel.app/studio`
   - Digital Closet: `https://your-app.vercel.app/closet`
   - Photo Try-On: `https://your-app.vercel.app/tryon`

---

## 2. Backend Deployment (Docker Compose on Cloud VM)

Deploy the backend API, Redis 7 instance, and RQ worker using Docker Compose on any Linux VM (Ubuntu 22.04+ recommended with Docker and Docker Compose installed).

### Step 1: Provision Cloud VM & Install Docker
```bash
# On your server (e.g. AWS EC2, DigitalOcean, Hetzner)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
```

### Step 2: Clone Repository & Configure Environment
```bash
git clone https://github.com/yusaibali-dev/Virtual-try-on-s-.git /opt/virtual-tryon
cd /opt/virtual-tryon

# Create production .env file
cp .env.example .env
```

Edit `.env` for production:
```bash
# Backend Host & CORS
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
ENVIRONMENT=production
CORS_ORIGINS=https://your-app.vercel.app

# Queue & Cloud GPU Inference Settings
INFERENCE_PROVIDER=modal           # 'modal' | 'runpod' | 'local'
REDIS_URL=redis://redis:6379/0

# Cloud GPU Credentials (see section 3 below)
MODAL_API_KEY=your_modal_api_key_here
MODAL_TRYON_ENDPOINT=https://your-org--virtual-tryon-tryon-endpoint.modal.run
```

### Step 3: Launch Services via Docker Compose
```bash
docker compose up -d --build
```

Check service status:
```bash
docker compose ps
docker compose logs -f rq-worker
```

Services running:
- `vton-redis`: Redis 7 Alpine caching and task queue broker.
- `vton-backend-api`: FastAPI backend with SSRF guard, rate limiter, and job endpoints.
- `vton-rq-worker`: RQ background daemon executing try-on tasks through `CloudGPUProvider`.

### Step 4: Configure Reverse Proxy (Caddy or Nginx)
Use **Caddy** for automated SSL certificates:
```Caddyfile
api.yourdomain.com {
    reverse_proxy localhost:8000
}
```
Reload Caddy:
```bash
sudo caddy reload
```

---

## 3. Cloud GPU Inference Setup

### Option A: Modal (Default / Modal First)
Modal provides instant serverless containers with Nvidia A10G GPUs (~$1.10/hr billed per millisecond, zero idle cost).

1. Install Modal CLI locally:
   ```bash
   pip install modal
   modal setup
   ```
2. Deploy the serverless try-on app from `backend/cloud/modal_app.py`:
   ```bash
   modal deploy backend/cloud/modal_app.py
   ```
3. Copy the generated Web Endpoint URL (e.g. `https://your-org--virtual-tryon-tryon-endpoint.modal.run`).
4. Set in `.env`:
   ```env
   INFERENCE_PROVIDER=modal
   MODAL_API_KEY=your_modal_token_secret
   MODAL_TRYON_ENDPOINT=https://your-org--virtual-tryon-tryon-endpoint.modal.run
   ```

### Option B: RunPod Serverless (Alternative)
RunPod Serverless offers Nvidia RTX 4090 ($0.74/hr) and A40 ($0.39/hr) instances.

1. Create a serverless endpoint on [RunPod.io](https://runpod.io).
2. Deploy the container using `backend/cloud/runpod_handler.py`.
3. Set in `.env`:
   ```env
   INFERENCE_PROVIDER=runpod
   RUNPOD_API_KEY=your_runpod_api_key
   RUNPOD_ENDPOINT_ID=your_runpod_endpoint_id
   ```

### Option C: Local On-Premise GPU
For dedicated servers with local Nvidia GPUs (e.g. RTX 3070 / 4090):
```env
INFERENCE_PROVIDER=local
```
The RQ worker will run inference directly against the on-device `ModelManager` with zero external cloud cost.

---

## 4. Cost & Latency Telemetry (Privacy Enforced)

Every inference job logs performance and estimated cost telemetry:
```
[Telemetry] Job: 8a4ef31b-... | Type: tryon | Provider: modal | Latency: 4.82s | Est. Cost: $0.00147 | Status: completed
```

### Strict Privacy Guarantee
- **No Images Logged**: Neither input photos, garment cutouts, generated images, nor base64 representations are ever recorded in application logs.
- **No Prompts Logged**: Only UUIDs, provider identifiers, latency durations, and estimated dollar costs are persisted.
- **TTL Auto-Purge**: Uploaded photos and intermediate results are automatically purged after 1 hour (configurable via `DEFAULT_TTL_SECONDS`).

---

## 5. Health Check & Validation

Verify all components are operational:

1. **API Gateway Status**:
   ```bash
   curl https://api.yourdomain.com/
   # Returns: {"message": "Virtual Try-On & Studio API", "status": "running", "version": "1.0.0"}
   ```

2. **Cloud GPU Provider & Redis Status**:
   ```bash
   curl https://api.yourdomain.com/api/cloud/config
   # Returns:
   # {
   #   "provider": "modal",
   #   "hourly_cost_usd": 1.1,
   #   "queue_backend": "redis_rq",
   #   "redis_connected": true,
   #   "redis_url": "redis://redis:6379/0"
   # }
   ```

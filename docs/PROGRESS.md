# Virtual Try-On (VTON) Web App — Progress Tracker

## Project Overview
- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS v4, Three.js / React Three Fiber, MediaPipe on-device vision)
- **Backend**: FastAPI (Python, uvicorn, CORS enabled)
- **AI Models / Inference**: CatVTON / HairFastGAN (Target: NVIDIA RTX 3070 with 8 GB VRAM)
- **Current Milestone**: Milestone 2 Complete

---

## Milestones Summary

### Milestone 1: Scaffold + Camera Live Tracking
- **Status**: **Done**
- **Components Built**: Monorepo structure, Next.js frontend, FastAPI backend, MediaPipe on-device vision (Face, Pose, Hands), 20+ FPS counter, Cloudflare tunnel & HTTPS testing.

### Milestone 2: Live Jewellery Try-On
- **Status**: **Done**
- **Components Built**:
  - **Earrings Placement**:
    - Real-time tracking anchored to left and right earlobe landmarks (points 177/234 and 401/454 from MediaPipe Face Mesh).
    - Head tilt calculation based on forehead-to-chin vector with automatic rotation matching.
    - Z-depth occlusion: earrings hide automatically when turning away so only the visible ear renders.
  - **Necklaces Placement**:
    - Fitted along the collarbone drape line anchored between left and right shoulders (Pose landmarks 11 & 12).
    - Dynamic roll rotation matching shoulder posture and neck angle.
    - Automatically hides if shoulder confidence drops.
  - **Rings & Bracelets Placement**:
    - Rings: Anchored on the ring finger between the MCP and PIP joints (Hand landmarks 13 & 14) with angle matching finger orientation.
    - Bracelets: Fitted over the wrist joint (Hand landmark 0) with angle following the metacarpal axis.
  - **One-Euro Filter (`1€ Filter`)**:
    - Integrated Casiez et al. speed-based adaptive low-pass filter across all landmark positions, scales, and rotation angles.
    - Eliminates micro-jitter and trembling during static poses while preserving zero lag during fast motion.
  - **Sample Asset Catalog & Carousel**:
    - 24 handcrafted sample items (6 earrings, 6 necklaces, 6 rings, 6 bracelets) in `frontend/src/lib/jewelryCatalog.ts`.
    - Horizontal categorized carousel allowing instant selection and switching.
  - **3D GLB/Three.js Inspector**:
    - Embedded React Three Fiber viewer (`Jewelry3DViewer.tsx`) with physical materials (gem transmission, refractive index, metallic sheen) and real-time lighting.
  - **Live Sizing & Offset Sliders**:
    - Dedicated scale sliders (0.5x to 1.8x) and vertical offset sliders (-40px to +60px) for customized fit.
  - **Instant Screenshot Capture**:
    - Camera shutter button that composites the raw video frame and live jewelry onto a canvas and downloads a high-resolution PNG.

---

## How to Run

### 1. Frontend

```bash
cd frontend
npm run dev
```
Open [http://localhost:3000/studio](http://localhost:3000/studio).

### 2. Mobile Device Testing over HTTPS

#### Cloudflare Tunnel (Zero-config)
1. In a terminal:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Open the printed `https://*.trycloudflare.com/studio` on your phone browser.
3. Allow camera access.

#### Next.js Local HTTPS
```bash
cd frontend
npm run dev:host-https
```
Open `https://<YOUR_LOCAL_IP>:3000/studio` on your mobile phone on the same Wi-Fi.

---

## Known Issues & Notes
- When testing on a smartphone, keeping the device in portrait mode yields the best natural fit for earrings and necklaces.
- For Rings and Bracelets, holding the hand open facing the camera provides the highest confidence hand landmark tracking.

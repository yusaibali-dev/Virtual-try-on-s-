# Stable Tunnel Options & Official Free-Plan Analysis

This document details stable tunnel solutions for VTON Studio that provide a fixed HTTPS URL across server restarts, along with their official free-plan limits, security considerations, and mobile browser behavior.

---

## 1. Quick Comparison Matrix

| Tunnel Provider | URL Permanence | Free Plan Limits | Interstitial / Warning Page | Best Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Quick Tunnel** (`TUNNEL=cloudflared`) | Ephemeral (changes per run) | **Unlimited** bandwidth & requests; free | **None** | Default for instant testing |
| **Cloudflare Named Tunnel** (`TUNNEL=cloudflared_named`) | **Permanent** (`vton.yourdomain.com`) | **Unlimited** bandwidth; up to 50 users on Zero Trust Free | **None** | **Recommended for production & phones** |
| **Tailscale Funnel** (`TUNNEL=tailscale`) | **Permanent** (`machine.tailnet.ts.net`) | Free personal tier (up to 3 devices, 100 users) | **None** | Private mesh or team testing |
| **ngrok Static Domain** (`TUNNEL=ngrok`) | **Permanent** (`*.ngrok-free.app`) | 1 static domain, **1 GB/month** data transfer, 20k requests/mo | **Yes** (HTML warning page requires click) | Quick fixed link testing |
| **Local HTTPS (Caddy)** (`TUNNEL=none`) | Local IP / LAN | No external dependencies | Self-signed cert warning on phone | Offline / high-speed LAN |

---

## 2. In-Depth Provider Breakdown

### Option A: Cloudflare Named Tunnel (Zero Trust) — *(Recommended)*
- **Why it's the best**:
  - Zero warning pages on mobile browsers (smooth camera permissions).
  - WebSockets (`wss://`) and high-bandwidth image uploads work natively without throttling.
  - Unlimited free egress.
- **Official Free Tier**:
  - Included with Cloudflare Zero Trust Free tier (up to 50 users).
- **Setup Steps**:
  1. Login to Cloudflare CLI:
     ```bash
     cloudflared tunnel login
     ```
  2. Create a named tunnel:
     ```bash
     cloudflared tunnel create vton-studio
     ```
  3. Route your domain:
     ```bash
     cloudflared tunnel route dns vton-studio tryon.yourdomain.com
     ```
  4. Configure in `.env`:
     ```env
     TUNNEL=cloudflared_named
     CLOUDFLARE_TUNNEL_NAME=vton-studio
     ```

---

### Option B: Tailscale Funnel
- **Official Free Tier**:
  - Personal plan: free for 3 users, 100 devices.
- **Behavior & Limits**:
  - Tailscale Funnel exposes your node to the public internet using automatic Let's Encrypt TLS certificates.
  - No interstitial warning page on browsers.
  - Bandwidth is relayed through Tailscale DERP relays if direct wireguard is blocked, which may throttle video streams during peak hours.
- **Setup Steps**:
  1. Enable Funnel in your Tailscale admin console.
  2. In terminal:
     ```bash
     tailscale funnel 3000
     ```

---

### Option C: ngrok Static Domain
- **Official Free Tier**:
  - 1 free static domain per account (e.g. `your-name.ngrok-free.app`).
  - Strict bandwidth limit: **1 GB / month** egress transfer.
- **Warning Page Note**:
  - ngrok automatically serves an HTML interstitial screen: *"You are about to visit an ngrok-free URL"*.
  - Users must click the blue **"Visit Site"** button before any assets or camera permissions load.
  - API and WebSocket requests must pass header `ngrok-skip-browser-warning: true`.
- **Setup Steps**:
  1. Set auth token:
     ```bash
     ngrok config add-authtoken <your-token>
     ```
  2. Set `.env`:
     ```env
     TUNNEL=ngrok
     NGROK_DOMAIN=your-name.ngrok-free.app
     ```

---

### Option D: Caddy Local HTTPS (No External Tunnel)
- Set `TUNNEL=none` in `.env`.
- Caddy serves directly on `https://127.0.0.1:3000` (or your LAN IP) using its internal root certificate authority.
- To access from your phone over WiFi:
  - Export Caddy root certificate: `caddy trust` or download `root.crt` from `Caddy/certificates`.
  - Install and trust the certificate on iOS / Android to enable camera permissions over LAN HTTPS.

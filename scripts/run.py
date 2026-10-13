#!/usr/bin/env python3
"""
VTON Studio Unified Single-Link Supervisor Runner
=================================================
Launches GPU worker, FastAPI, Next.js, Caddy, and Tunnel.
Waits for health checks, supervises processes, shuts down cleanly on Ctrl+C,
and prints exactly ONE public link + QR code.
"""

import os
import sys
import time
import signal
import socket
import urllib.request
import subprocess
import argparse
import random
import re
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
LOGS_DIR = ROOT_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Path to local Caddy binary
LOCAL_CADDY = ROOT_DIR / "tools" / "caddy.exe"
CLOUDFLARED_PATH = r"C:\Program Files (x86)\cloudflared\cloudflared.exe"

def load_env_file():
    """Reads .env file into os.environ if present."""
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip("'").strip('"')
                    if key.strip() not in os.environ:
                        os.environ[key.strip()] = val

def wait_for_http(url: str, timeout_s: float = 20.0, expect_codes=(200, 307, 308)) -> bool:
    """Polls an HTTP URL until it returns one of expected status codes."""
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "VTON-HealthCheck/1.0"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status in expect_codes:
                    return True
        except urllib.error.HTTPError as e:
            if e.code in expect_codes:
                return True
        except Exception:
            pass
        time.sleep(0.4)
    return False

def print_qr_code(url: str):
    """Prints ANSI QR code of the given URL to terminal."""
    try:
        import qrcode
        qr = qrcode.QRCode(border=1)
        qr.add_data(url)
        qr.print_ascii(invert=True)
    except Exception as e:
        print(f"  [QR generator fallback: scan or open {url}]")

def main():
    parser = argparse.ArgumentParser(description="VTON Studio Single-Link Runner")
    parser.add_argument("--prod", action="store_true", help="Run Next.js in production mode (default)")
    parser.add_argument("--dev", action="store_true", help="Run Next.js in hot-reload dev mode")
    parser.add_argument("--verbose", action="store_true", help="Display internal port and diagnostic info")
    args = parser.parse_args()

    load_env_file()

    port = os.environ.get("PORT", "3000")
    tunnel_mode = os.environ.get("TUNNEL", "cloudflared").lower()
    access_code = os.environ.get("ACCESS_CODE", "").strip()

    # Generate random 6-digit passcode if not provided and tunnel is active
    if not access_code and tunnel_mode != "none":
        access_code = str(random.randint(100000, 999999))
        os.environ["ACCESS_CODE"] = access_code

    is_prod = not args.dev
    mode_str = "Production" if is_prod else "Development"

    if args.verbose:
        print(f"[*] Starting VTON Studio in {mode_str} mode...")
        print(f"[*] Reverse proxy port: {port} | Tunnel: {tunnel_mode}")
        if access_code:
            print(f"[*] Access Gate: ACTIVE (Code: {access_code})")
        else:
            print("[*] Access Gate: DISABLED")
    else:
        print(f"[*] Initializing VTON Studio services ({mode_str} mode)...")

    processes = []
    log_files = []

    def cleanup():
        print("\n[*] Shutting down all services cleanly...")
        for proc in reversed(processes):
            try:
                proc.terminate()
                proc.wait(timeout=2.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        for lf in log_files:
            try:
                lf.close()
            except Exception:
                pass
        print("[*] All services stopped.")

    def signal_handler(sig, frame):
        cleanup()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # 1. Start GPU Worker (if worker service directory exists)
        gpu_worker_dir = ROOT_DIR / "gpu_worker"
        if (gpu_worker_dir / "main.py").exists():
            if args.verbose:
                print("--> [1/5] Starting Isolated GPU Worker (127.0.0.1:8100)...")
            log_worker = open(LOGS_DIR / "gpu_worker.log", "w", encoding="utf-8")
            log_files.append(log_worker)
            p_worker = subprocess.Popen(
                [sys.executable, "main.py"],
                cwd=str(gpu_worker_dir),
                stdout=log_worker,
                stderr=subprocess.STDOUT,
                env=os.environ.copy()
            )
            processes.append(p_worker)
            time.sleep(0.5)

        # 2. Start FastAPI Backend (127.0.0.1:8000)
        if args.verbose:
            print("--> [2/5] Starting FastAPI Backend (127.0.0.1:8000)...")
        log_backend = open(LOGS_DIR / "backend.log", "w", encoding="utf-8")
        log_files.append(log_backend)
        backend_cmd = [
            sys.executable, "-m", "uvicorn", "main:app",
            "--host", "127.0.0.1",
            "--port", "8000"
        ]
        p_backend = subprocess.Popen(
            backend_cmd,
            cwd=str(ROOT_DIR / "backend"),
            stdout=log_backend,
            stderr=subprocess.STDOUT,
            env=os.environ.copy()
        )
        processes.append(p_backend)

        if not wait_for_http("http://127.0.0.1:8000/api/health", timeout_s=15.0):
            print("[!] FastAPI backend failed to pass health check. Check logs/backend.log")
            cleanup()
            sys.exit(1)

        # 3. Start Next.js Frontend (127.0.0.1:3001)
        if args.verbose:
            print(f"--> [3/5] Starting Next.js Frontend ({mode_str} on 127.0.0.1:3001)...")
        log_frontend = open(LOGS_DIR / "frontend.log", "w", encoding="utf-8")
        log_files.append(log_frontend)

        frontend_env = os.environ.copy()
        frontend_env["PORT"] = "3001"
        frontend_env["ACCESS_CODE"] = access_code

        frontend_cmd = ["npm.cmd" if sys.platform == "win32" else "npm", "run", "start" if is_prod else "dev"]
        p_frontend = subprocess.Popen(
            frontend_cmd,
            cwd=str(ROOT_DIR / "frontend"),
            stdout=log_frontend,
            stderr=subprocess.STDOUT,
            env=frontend_env
        )
        processes.append(p_frontend)

        if not wait_for_http("http://127.0.0.1:3001", timeout_s=25.0):
            print("[!] Next.js frontend failed to respond. Check logs/frontend.log")
            cleanup()
            sys.exit(1)

        # 4. Start Caddy Reverse Proxy
        if args.verbose:
            print(f"--> [4/5] Starting Caddy Reverse Proxy (Listening on 127.0.0.1:{port})...")
        caddy_bin = str(LOCAL_CADDY) if LOCAL_CADDY.exists() else "caddy"
        log_caddy = open(LOGS_DIR / "caddy.log", "w", encoding="utf-8")
        log_files.append(log_caddy)

        caddy_env = os.environ.copy()
        caddy_env["PORT"] = port
        p_caddy = subprocess.Popen(
            [caddy_bin, "run", "--config", "Caddyfile"],
            cwd=str(ROOT_DIR),
            stdout=log_caddy,
            stderr=subprocess.STDOUT,
            env=caddy_env
        )
        processes.append(p_caddy)

        if not wait_for_http(f"http://127.0.0.1:{port}/api/health", timeout_s=10.0):
            print(f"[!] Caddy proxy failed to respond on port {port}. Check logs/caddy.log")
            cleanup()
            sys.exit(1)

        # 5. Start Tunnel
        public_url = None
        if tunnel_mode == "cloudflared":
            if args.verbose:
                print("--> [5/5] Establishing Cloudflare Quick Tunnel...")
            log_tunnel = open(LOGS_DIR / "tunnel.log", "w+", encoding="utf-8")
            log_files.append(log_tunnel)

            cf_bin = CLOUDFLARED_PATH if os.path.exists(CLOUDFLARED_PATH) else "cloudflared"
            p_tunnel = subprocess.Popen(
                [cf_bin, "tunnel", "--url", f"http://127.0.0.1:{port}"],
                cwd=str(ROOT_DIR),
                stdout=log_tunnel,
                stderr=subprocess.STDOUT
            )
            processes.append(p_tunnel)

            # Poll tunnel log for quick tunnel URL
            t0 = time.time()
            url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
            while time.time() - t0 < 25.0:
                log_tunnel.seek(0)
                content = log_tunnel.read()
                match = url_pattern.search(content)
                if match:
                    public_url = match.group(0)
                    break
                time.sleep(0.5)

            if not public_url:
                print("[!] Cloudflare tunnel did not output URL in time. Check logs/tunnel.log")
                public_url = f"http://127.0.0.1:{port}"
        elif tunnel_mode == "none":
            public_url = f"http://127.0.0.1:{port}"
        else:
            public_url = f"http://127.0.0.1:{port}"

        # -------------------------------------------------------------
        # EXACTLY ONE LINK PRINTED (PLUS QR CODE)
        # -------------------------------------------------------------
        print("\n" + "=" * 64)
        print("                 VTON STUDIO IS LIVE!")
        print("=" * 64)
        print(f"\n  Open the site: {public_url}\n")
        if access_code:
            print(f"  Access Passcode: {access_code}")
            print("  (Enter this 6-digit code on the gate screen on your phone)\n")
        
        print_qr_code(public_url)
        print("=" * 64)
        print("Press Ctrl+C to shut down all services cleanly.\n")

        # Keep supervisor alive
        while True:
            time.sleep(1.0)
            # Check if any child unexpectedly crashed
            for p in processes:
                if p.poll() is not None:
                    print(f"\n[!] A service process exited unexpectedly (code {p.returncode}).")
                    cleanup()
                    sys.exit(1)

    except KeyboardInterrupt:
        cleanup()
        sys.exit(0)
    except Exception as e:
        print(f"\n[!] Supervisor runtime error: {e}")
        cleanup()
        sys.exit(1)

if __name__ == "__main__":
    main()

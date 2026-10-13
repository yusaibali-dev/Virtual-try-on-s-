"""
Network Isolation & Port Exposure Verification Script
=====================================================
Verifies that all internal service ports (Next.js :3001, FastAPI :8000, GPU Worker :8100)
are bound strictly to 127.0.0.1 (loopback) and are completely unreachable from LAN IP.
"""

import socket
import sys

def get_lan_ip():
    """Returns local network LAN IP (non-loopback)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Dummy connect to external router/gateway
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def test_port_reachable(ip: str, port: int, timeout_s: float = 0.5) -> bool:
    """Attempts a TCP handshake. Returns True if port connects, False if refused/timeout."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout_s)
    try:
        sock.connect((ip, port))
        sock.close()
        return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def verify_isolation():
    lan_ip = get_lan_ip()
    print("=" * 70)
    print("        VTON Studio Network Isolation & Port Security Audit")
    print("=" * 70)
    print(f"Detected LAN Interface: {lan_ip}")
    print(f"Loopback Interface:     127.0.0.1\n")

    internal_services = [
        {"name": "Next.js Frontend (Internal)", "port": 3001},
        {"name": "FastAPI Backend (Internal)", "port": 8000},
        {"name": "GPU Inference Worker (Internal)", "port": 8100},
    ]

    all_secure = True

    print("[*] Probing Internal Services for LAN Exposure:")
    for svc in internal_services:
        port = svc["port"]
        name = svc["name"]
        
        loopback_open = test_port_reachable("127.0.0.1", port)
        lan_open = test_port_reachable(lan_ip, port)

        print(f"  - {name} (Port {port}):")
        print(f"      Loopback (127.0.0.1:{port}): {'LISTENING' if loopback_open else 'NOT ACTIVE / IDLE'}")
        
        if lan_open:
            print(f"      [!] DANGER: Exposed on LAN ({lan_ip}:{port}) - FAIL")
            all_secure = False
        else:
            print(f"      LAN ({lan_ip}:{port}): REFUSED / UNREACHABLE (SECURE)")

    print("\n" + "-" * 70)
    if all_secure:
        print("[PASS] 100% of internal ports are isolated to loopback (127.0.0.1).")
        print("       Only the Caddy reverse proxy port can be made publicly reachable.")
        print("=" * 70)
        return 0
    else:
        print("[FAIL] One or more internal ports are exposed on the local network!")
        print("=" * 70)
        return 1

if __name__ == "__main__":
    sys.exit(verify_isolation())

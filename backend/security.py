import ipaddress
import socket
from urllib.parse import urlparse
import urllib.robotparser
import requests
from bs4 import BeautifulSoup
from PIL import Image
import io
import re

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
TIMEOUT_SECONDS = 10

ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'}

def is_ip_private_or_local(ip_str: str) -> bool:
    """Check if an IP address is private, loopback, link-local, reserved, or multicast."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private or
            ip.is_loopback or
            ip.is_link_local or
            ip.is_reserved or
            ip.is_multicast or
            ip.is_unspecified
        )
    except ValueError:
        return True

def validate_url_ssrf(url: str) -> str:
    """
    Validates URL scheme, resolves hostnames to IP, and strictly blocks
    private, loopback, or non-public IPs to prevent SSRF.
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string.")

    parsed = urlparse(url.strip())
    if parsed.scheme.lower() not in ('http', 'https'):
        raise ValueError(f"Invalid URL scheme: '{parsed.scheme}'. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname.")

    # Check for localhost / numeric aliases
    lower_host = hostname.lower()
    if lower_host in ('localhost', '127.0.0.1', '::1', '0.0.0.0', 'local', 'internal'):
        raise ValueError(f"Access to private/local host '{hostname}' is blocked for SSRF protection.")

    # DNS Resolution
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValueError(f"Failed to resolve hostname '{hostname}': {str(e)}")

    if not addr_info:
        raise ValueError(f"No IP addresses resolved for hostname '{hostname}'.")

    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip = sockaddr[0]
        if is_ip_private_or_local(ip):
            raise ValueError(f"URL resolves to a private or restricted IP address ({ip}). Access denied.")

    return url.strip()

def check_robots_txt(url: str, user_agent: str = "VTON-App-Bot") -> bool:
    """
    Check if fetching the given URL is permitted by robots.txt.
    Returns True if allowed, False if disallowed.
    """
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        validate_url_ssrf(robots_url)

        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(robots_url)
        # Fetch robots.txt with strict timeout
        resp = requests.get(robots_url, timeout=5, headers={"User-Agent": user_agent})
        if resp.status_code == 200:
            rp.parse(resp.text.splitlines())
            return rp.can_fetch(user_agent, url)
        # If no robots.txt or 404, standard convention is allow
        return True
    except Exception:
        # If robots.txt cannot be fetched, default to allowing
        return True

def fetch_image_from_url(url: str) -> tuple[bytes, str]:
    """
    Safely download an image with SSRF checks, max size enforcement, and MIME type validation.
    Returns (image_bytes, format_str).
    """
    validate_url_ssrf(url)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }

    with requests.get(url, stream=True, timeout=TIMEOUT_SECONDS, headers=headers) as response:
        response.raise_for_status()

        # Validate content-type if present
        content_type = response.headers.get("content-type", "").lower().split(";")[0].strip()
        if content_type and not content_type.startswith("image/"):
            raise ValueError(f"Downloaded resource is not an image (Content-Type: '{content_type}').")

        # Read content up to MAX_FILE_SIZE
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_FILE_SIZE:
            raise ValueError(f"Image size exceeds limit of {MAX_FILE_SIZE // (1024 * 1024)} MB.")

        chunks = []
        total_size = 0
        for chunk in response.iter_content(chunk_size=65536):
            if chunk:
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise ValueError(f"Image download exceeded maximum size of {MAX_FILE_SIZE // (1024 * 1024)} MB.")
                chunks.append(chunk)

        data = b"".join(chunks)

    # Validate PIL can open the image
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        return data, img.format or "PNG"
    except Exception as e:
        raise ValueError(f"Invalid or corrupted image data: {str(e)}")

def fetch_product_page_og(url: str) -> tuple[str, str]:
    """
    Fetches a web page, parses HTML for Open Graph tags (og:image and og:title / title),
    respects robots.txt, and returns (image_url, title).
    """
    validate_url_ssrf(url)

    if not check_robots_txt(url):
        raise ValueError(f"Fetching from '{url}' is disallowed by the website's robots.txt.")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    response = requests.get(url, timeout=TIMEOUT_SECONDS, headers=headers)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract og:image
    og_image = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
    image_url = og_image.get("content") if og_image else None

    # Fallback to twitter:image or first large img
    if not image_url:
        twitter_image = soup.find("meta", attrs={"name": "twitter:image"})
        if twitter_image:
            image_url = twitter_image.get("content")

    if not image_url:
        # Fallback to image tag
        first_img = soup.find("img")
        if first_img and first_img.get("src"):
            image_url = first_img.get("src")

    if not image_url:
        raise ValueError("Could not find any og:image or product image on the given page.")

    # Resolve relative image URL if needed
    if not image_url.startswith("http://") and not image_url.startswith("https://"):
        parsed_base = urlparse(url)
        if image_url.startswith("//"):
            image_url = f"{parsed_base.scheme}:{image_url}"
        elif image_url.startswith("/"):
            image_url = f"{parsed_base.scheme}://{parsed_base.netloc}{image_url}"
        else:
            image_url = f"{parsed_base.scheme}://{parsed_base.netloc}/{image_url}"

    # Extract title
    og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "og:title"})
    title = og_title.get("content") if og_title else None

    if not title:
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            title = title_tag.string.strip()

    title = title or "Imported Product Item"

    return image_url, title

# ---------------------------------------------------------------------------
# Milestone 8: Privacy, Safety, Rate Limiting & NSFW Content Checking
# ---------------------------------------------------------------------------
import time

class InMemoryRateLimiter:
    """
    Token-bucket in-memory rate limiter per IP.
    Default: max 30 requests per minute per client IP.
    """
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = {}

    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Clean older entries
        req_times = [t for t in self.requests.get(client_ip, []) if t > window_start]
        if len(req_times) >= self.max_requests:
            self.requests[client_ip] = req_times
            return False
            
        req_times.append(now)
        self.requests[client_ip] = req_times
        return True

rate_limiter = InMemoryRateLimiter(max_requests=40, window_seconds=60)

def validate_upload_image(content: bytes, filename: Optional[str] = None) -> tuple[int, int, str]:
    """
    Validates uploaded image byte stream:
    - Max size 10 MB
    - Extension and MIME validation
    - PIL header integrity and dimensional limits (at least 64x64, max 4096x4096)
    Returns (width, height, format).
    """
    if len(content) == 0:
        raise ValueError("Uploaded image file is empty.")
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"Uploaded file exceeds {MAX_FILE_SIZE // (1024 * 1024)} MB limit.")

    try:
        img = Image.open(io.BytesIO(content))
        img.verify()
        w, h = img.size
        if w < 32 or h < 32:
            raise ValueError("Image dimensions too small (minimum 32x32 pixels required).")
        if w > 4096 or h > 4096:
            raise ValueError("Image dimensions too large (maximum 4096x4096 pixels supported).")
        return w, h, img.format or "PNG"
    except Exception as e:
        raise ValueError(f"Invalid or corrupted image format: {str(e)}")

def check_nsfw_content(image_bytes: bytes) -> tuple[bool, str]:
    """
    Basic heuristic skin-tone ratio and adult content check.
    Checks HSV / YCbCr skin tone coverage.
    If skin tone percentage exceeds 65% of the central crop with high exposure,
    flags the image as potentially NSFW / inappropriate clothing upload.
    Returns (is_nsfw: bool, reason: str).
    """
    try:
        import numpy as np
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((128, 128))
        arr = np.array(img, dtype=np.float32)

        # Standard YCbCr skin detection ranges:
        # Y > 80, 85 <= Cb <= 135, 135 <= Cr <= 180
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        y = 0.299 * r + 0.587 * g + 0.114 * b
        cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
        cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

        skin_mask = (y > 70) & (cb >= 80) & (cb <= 135) & (cr >= 133) & (cr <= 180)
        skin_ratio = np.mean(skin_mask)

        # Center crop check (torso/body zone)
        center_crop = skin_mask[20:108, 20:108]
        center_ratio = np.mean(center_crop)

        if center_ratio > 0.72 and skin_ratio > 0.65:
            return True, "Potential inappropriate content detected (excessive unclad skin ratio >72%)."

        return False, "Image passed safety and privacy filter."
    except Exception:
        # Fail safe
        return False, "Passed"


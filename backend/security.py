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

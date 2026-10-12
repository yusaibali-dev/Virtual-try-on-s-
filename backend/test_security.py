import pytest
from security import (
    validate_url_ssrf,
    is_ip_private_or_local,
    check_robots_txt
)

def test_private_ip_detection():
    # Loopback
    assert is_ip_private_or_local("127.0.0.1") is True
    assert is_ip_private_or_local("::1") is True
    assert is_ip_private_or_local("0.0.0.0") is True

    # Private ranges (RFC 1918)
    assert is_ip_private_or_local("10.0.0.1") is True
    assert is_ip_private_or_local("172.16.0.5") is True
    assert is_ip_private_or_local("172.31.255.255") is True
    assert is_ip_private_or_local("192.168.1.1") is True
    assert is_ip_private_or_local("192.168.0.100") is True

    # Link-local / Cloud metadata service (AWS/GCP/Azure)
    assert is_ip_private_or_local("169.254.169.254") is True

    # Valid Public IPs
    assert is_ip_private_or_local("8.8.8.8") is False
    assert is_ip_private_or_local("1.1.1.1") is False
    assert is_ip_private_or_local("142.250.190.46") is False

def test_ssrf_blocks_localhost_and_internal():
    # Block localhost schemes
    with pytest.raises(ValueError, match="blocked for SSRF protection|private"):
        validate_url_ssrf("http://localhost:8000/api")

    with pytest.raises(ValueError, match="blocked for SSRF protection|private"):
        validate_url_ssrf("http://127.0.0.1/admin")

    with pytest.raises(ValueError, match="blocked for SSRF protection|private"):
        validate_url_ssrf("http://0.0.0.0:3000")

def test_ssrf_blocks_private_subnets():
    with pytest.raises(ValueError, match="private or restricted IP"):
        validate_url_ssrf("http://192.168.1.1/router")

    with pytest.raises(ValueError, match="private or restricted IP"):
        validate_url_ssrf("http://10.200.1.5:8080/metrics")

    with pytest.raises(ValueError, match="private or restricted IP"):
        validate_url_ssrf("http://169.254.169.254/latest/meta-data/")

def test_ssrf_blocks_invalid_schemes():
    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_url_ssrf("ftp://example.com/image.png")

    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_url_ssrf("file:///etc/passwd")

    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_url_ssrf("gopher://example.com")

def test_ssrf_accepts_valid_public_urls():
    valid_url = "https://example.com/sample.jpg"
    assert validate_url_ssrf(valid_url) == valid_url

    github_url = "https://raw.githubusercontent.com"
    assert validate_url_ssrf(github_url) == github_url

def test_empty_or_nonstring_url():
    with pytest.raises(ValueError, match="non-empty string"):
        validate_url_ssrf("")

    with pytest.raises(ValueError, match="non-empty string"):
        validate_url_ssrf(None)

def test_rate_limiter():
    from security import InMemoryRateLimiter
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=10)
    ip = "198.51.100.1"
    assert limiter.is_allowed(ip) is True
    assert limiter.is_allowed(ip) is True
    assert limiter.is_allowed(ip) is True
    assert limiter.is_allowed(ip) is False # 4th request blocked

def test_upload_validation():
    from security import validate_upload_image
    from PIL import Image
    import io

    # Valid image
    img = Image.new("RGB", (200, 200), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    w, h, fmt = validate_upload_image(buf.getvalue())
    assert w == 200 and h == 200

    # Empty payload
    with pytest.raises(ValueError, match="empty"):
        validate_upload_image(b"")

    # Corrupted payload
    with pytest.raises(ValueError, match="Invalid or corrupted"):
        validate_upload_image(b"NOT_AN_IMAGE_DATA")

def test_nsfw_check():
    from security import check_nsfw_content
    from PIL import Image
    import io

    # Normal clothing/landscape image (blue garment)
    img = Image.new("RGB", (100, 100), color=(20, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    is_nsfw, reason = check_nsfw_content(buf.getvalue())
    assert is_nsfw is False


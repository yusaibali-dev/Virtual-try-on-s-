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

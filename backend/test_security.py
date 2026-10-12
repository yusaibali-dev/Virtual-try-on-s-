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

def test_cloud_gpu_providers():
    from cloud_gpu_provider import get_cloud_provider, LocalGPUProvider, ModalGPUProvider, RunPodGPUProvider

    # Test Local provider
    local_p = get_cloud_provider("local")
    assert isinstance(local_p, LocalGPUProvider)
    assert local_p.name == "local"
    assert local_p.hourly_cost_usd == 0.0
    assert local_p.calculate_cost(60) == 0.0

    # Test Modal provider (Modal first)
    modal_p = get_cloud_provider("modal")
    assert isinstance(modal_p, ModalGPUProvider)
    assert modal_p.name == "modal"
    assert modal_p.hourly_cost_usd == 1.10
    cost_modal_10s = modal_p.calculate_cost(10.0)
    assert cost_modal_10s > 0.003
    assert cost_modal_10s < 0.004

    # Test RunPod provider (RunPod alternative)
    runpod_p = get_cloud_provider("runpod")
    assert isinstance(runpod_p, RunPodGPUProvider)
    assert runpod_p.name == "runpod"
    assert runpod_p.hourly_cost_usd == 0.74
    cost_runpod_10s = runpod_p.calculate_cost(10.0)
    assert cost_runpod_10s > 0.002
    assert cost_runpod_10s < 0.003

def test_telemetry_no_images_logged(capsys):
    from cloud_gpu_provider import get_cloud_provider

    provider = get_cloud_provider("modal")
    job_id = "test-job-uuid-456"
    telemetry = provider.log_telemetry(
        job_id=job_id,
        job_type="tryon",
        duration_seconds=5.2,
        status="completed"
    )

    captured = capsys.readouterr().out

    # Verify telemetry metadata is logged accurately
    assert job_id in captured
    assert "modal" in captured
    assert "5.20s" in captured
    assert "completed" in captured

    # Verify strictly NO image data, base64 strings, or prompts are present
    assert "data:image" not in captured
    assert "person" not in captured.lower()
    assert "garment" not in captured.lower()
    assert "base64" not in captured.lower()
    assert ".png" not in captured.lower()
    assert ".jpg" not in captured.lower()

    # Verify telemetry dictionary contents
    assert telemetry["job_id"] == job_id
    assert telemetry["provider"] == "modal"
    assert telemetry["latency_s"] == 5.2
    assert telemetry["cost_usd"] > 0

def test_job_queue_manager_lifecycle():
    from job_queue import JobQueueManager

    # Use in-memory mode for standalone test
    mgr = JobQueueManager(redis_url="redis://nonexistent:9999/0")
    assert mgr.is_redis_available is False

    job_id = "unit-test-job-001"
    job = mgr.register_job(job_id, "tryon", "upper")
    assert job["id"] == job_id
    assert job["status"] == "queued"

    # Query job
    fetched = mgr.get_job(job_id)
    assert fetched["status"] == "queued"

    # Update job
    mgr.update_job(job_id, {
        "status": "processing",
        "progress": 50,
        "message": "Running on GPU"
    })
    updated = mgr.get_job(job_id)
    assert updated["progress"] == 50
    assert updated["status"] == "processing"

    # Cancel job
    cancelled = mgr.cancel_job(job_id)
    assert cancelled is True
    assert mgr.get_job(job_id)["status"] == "cancelled"

def test_cloud_config_endpoint():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    res = client.get("/api/cloud/config")
    assert res.status_code == 200
    data = res.json()
    assert "provider" in data
    assert "hourly_cost_usd" in data
    assert "queue_backend" in data
    assert "redis_connected" in data


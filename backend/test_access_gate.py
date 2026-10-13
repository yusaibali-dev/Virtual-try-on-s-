import pytest
import os
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_gate_disabled_by_default():
    """When ACCESS_CODE is not set, gate is inactive and endpoints are open."""
    os.environ["ACCESS_CODE"] = ""
    res = client.get("/api/auth/status")
    assert res.status_code == 200
    data = res.json()
    assert data["gate_active"] is False
    assert data["authenticated"] is True

    # Health check works
    h_res = client.get("/api/health")
    assert h_res.status_code == 200

def test_gate_active_and_auth_flow(monkeypatch):
    """When ACCESS_CODE is set, unauthorized requests return 401 until passcode is provided."""
    test_pin = "948210"
    monkeypatch.setenv("ACCESS_CODE", test_pin)

    # 1. Status indicates gate is active and client unauthenticated
    res = client.get("/api/auth/status")
    assert res.status_code == 200
    assert res.json()["gate_active"] is True
    assert res.json()["authenticated"] is False

    # 2. Protected endpoint blocked without passcode
    items_res = client.get("/api/items")
    assert items_res.status_code == 401
    assert items_res.json().get("gate_required") is True

    # 3. Invalid passcode rejected
    bad_auth = client.post("/api/auth/gate", json={"code": "000000"})
    assert bad_auth.status_code == 401

    # 4. Valid passcode sets cookie and grants access
    good_auth = client.post("/api/auth/gate", json={"code": test_pin})
    assert good_auth.status_code == 200
    assert good_auth.json()["status"] == "authorized"

    # Verify session cookie was set
    assert "vton_access_session" in good_auth.cookies

    # 5. Subsequent request with session cookie succeeds
    auth_items = client.get("/api/items", cookies={"vton_access_session": test_pin})
    assert auth_items.status_code == 200

    # 6. Request with X-Access-Code header also succeeds
    header_items = client.get("/api/items", headers={"X-Access-Code": test_pin})
    assert header_items.status_code == 200

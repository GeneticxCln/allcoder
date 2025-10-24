# ruff: noqa: PLR2004
from fastapi.testclient import TestClient

from allcoder.api import app


def test_version_endpoint():
    client = TestClient(app)
    r = client.get("/version")
    assert r.status_code == 200
    assert "version" in r.json()


def test_convert_endpoint():
    client = TestClient(app)
    body = {
        "doc": {"filename": "a.yaml", "content": "name: Alice\n"},
        "to": "json",
    }
    r = client.post("/convert", json=body)
    assert r.status_code == 200
    assert "Alice" in r.json()["content"]

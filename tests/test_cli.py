# ruff: noqa: PLR2004
import json
from pathlib import Path

from typer.testing import CliRunner

from allcoder.cli import app

runner = CliRunner()


def write(p: Path, text: str) -> Path:
    p.write_text(text, encoding="utf-8")
    return p


def test_version():
    res = runner.invoke(app, ["--version"])  # exit via typer.Exit
    assert res.exit_code == 0
    assert res.stdout.strip()


def test_convert_yaml_to_json(tmp_path: Path):
    src = write(tmp_path / "a.yaml", "name: Alice\nage: 30\n")
    out = tmp_path / "a.json"
    res = runner.invoke(app, ["convert", str(src), "--to", "json", "-o", str(out)])
    assert res.exit_code == 0
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["name"] == "Alice" and data["age"] == 30


def test_format_check_and_inplace(tmp_path: Path):
    src = write(tmp_path / "b.json", '{"z":1,  "a":2}')
    res = runner.invoke(app, ["format", str(src), "--check"])  # would change
    assert res.exit_code != 0
    res = runner.invoke(app, ["format", str(src), "-i"])  # apply
    assert res.exit_code == 0
    assert src.read_text(encoding="utf-8").startswith("{")


def test_merge_deep(tmp_path: Path):
    a = write(tmp_path / "a.yaml", "db: {host: localhost, ports: [5432]}\n")
    b = write(tmp_path / "b.yaml", "db: {user: root, ports: [5433]}\n")
    res = runner.invoke(app, ["merge", str(a), str(b)])
    assert res.exit_code == 0
    assert "ports" in res.stdout and "5432" in res.stdout and "5433" in res.stdout


def test_validate_with_schema(tmp_path: Path):
    schema = write(
        tmp_path / "schema.json",
        '{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}',
    )
    ok = write(tmp_path / "ok.yaml", "name: Bob\n")
    bad = write(tmp_path / "bad.yaml", "age: 10\n")
    res_ok = runner.invoke(app, ["validate", "--schema", str(schema), str(ok)])
    res_bad = runner.invoke(app, ["validate", "--schema", str(schema), str(bad)])
    assert res_ok.exit_code == 0
    assert res_bad.exit_code != 0


def test_redact(tmp_path: Path):
    s = write(tmp_path / "s.yaml", "password: secret\nuser: alice\n")
    res = runner.invoke(app, ["redact", str(s), "-k", "password"])  # to stdout
    assert res.exit_code == 0
    assert "***REDACTED***" in res.stdout

from __future__ import annotations

import json

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from jsonschema import validate as js_validate
from pydantic import BaseModel
from tomlkit import parse as toml_parse

from . import __version__
from .io_utils import Format, detect_format, dump_str
from .merge_utils import deep_merge
from .redact_utils import redact_keys


class Document(BaseModel):
    filename: str
    content: str


class DocsRequest(BaseModel):
    docs: list[Document]


class ValidateRequest(DocsRequest):
    schema: Document | None = None


class ConvertRequest(BaseModel):
    doc: Document
    to: str


class MergeRequest(DocsRequest):
    to: str | None = None
    deep: bool = True


class RedactRequest(DocsRequest):
    keys: list[str]
    mask: str = "***REDACTED***"


app = FastAPI(title="Allcoder API", version=__version__)


@app.get("/version")
async def version():
    return {"version": __version__}


@app.post("/validate")
async def validate(req: ValidateRequest):
    schema_obj = None
    if req.schema is not None:
        try:
            fmt = detect_format(req.schema.filename)
            schema_obj = read_data_content(req.schema.content, fmt)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid schema: {e}") from e

    results = []
    errors = []
    for d in req.docs:
        try:
            fmt = detect_format(d.filename)
            data = read_data_content(d.content, fmt)
            if schema_obj is not None:
                js_validate(instance=data, schema=schema_obj)
            results.append({"filename": d.filename, "ok": True})
        except Exception as e:
            results.append({"filename": d.filename, "ok": False})
            errors.append({"filename": d.filename, "error": str(e)})
    status = 200 if all(r["ok"] for r in results) else 422
    return JSONResponse(content={"results": results, "errors": errors}, status_code=status)


@app.post("/format")
async def format_docs(req: DocsRequest):
    out = []
    for d in req.docs:
        fmt = detect_format(d.filename)
        data = read_data_content(d.content, fmt)
        out.append(
            {
                "filename": d.filename,
                "content": dump_str(data, fmt),
            }
        )
    return {"docs": out}


@app.post("/convert")
async def convert(req: ConvertRequest):
    src_fmt = detect_format(req.doc.filename)
    data = read_data_content(req.doc.content, src_fmt)
    dst_fmt = detect_format(f"dummy.{req.to}")
    return {"content": dump_str(data, dst_fmt)}


@app.post("/merge")
async def merge(req: MergeRequest):
    merged = None
    out_fmt: Format | None = None
    for i, d in enumerate(req.docs):
        fmt = detect_format(d.filename)
        data = read_data_content(d.content, fmt)
        if i == 0:
            merged = data
            out_fmt = fmt
        else:
            if req.deep:
                merged = deep_merge(merged, data)
            elif isinstance(merged, dict) and isinstance(data, dict):
                merged = {**merged, **data}
            else:
                merged = data
            out_fmt = fmt
    if req.to is not None:
        out_fmt = detect_format(f"dummy.{req.to}")
    assert out_fmt is not None
    return {"content": dump_str(merged, out_fmt)}


@app.post("/redact")
async def redact(req: RedactRequest):
    keys = set(req.keys)
    out = []
    for d in req.docs:
        fmt = detect_format(d.filename)
        data = read_data_content(d.content, fmt)
        red = redact_keys(data, keys, req.mask)
        out.append({"filename": d.filename, "content": dump_str(red, fmt)})
    return {"docs": out}


# Helpers


def read_data_content(text: str, fmt: Format):
    if fmt is Format.json:
        return json.loads(text)
    if fmt is Format.yaml:
        return yaml.safe_load(text)
    if fmt is Format.toml:
        return toml_parse(text)
    raise ValueError("unknown format")

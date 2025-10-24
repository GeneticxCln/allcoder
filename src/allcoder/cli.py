from __future__ import annotations

from pathlib import Path
from typing import Annotated

import typer
import uvicorn
from jsonschema import validate as js_validate
from rich.console import Console

from . import __version__
from .io_utils import detect_format, dump_str, read_data
from .merge_utils import deep_merge
from .redact_utils import redact_keys

app = typer.Typer(no_args_is_help=True, help="Config toolkit CLI for JSON/YAML/TOML.")
console = Console()


@app.callback(invoke_without_command=True)
def version_callback(
    version: Annotated[
        bool,
        typer.Option(
            "--version",
            help="Show version and exit",
            callback=None,
            is_eager=True,
        ),
    ] = False,
) -> None:
    if version:
        console.print(__version__)
        raise typer.Exit(code=0)


@app.command()
def validate(
    files: Annotated[list[Path], typer.Argument(help="Files to validate", exists=True)],
    schema: Annotated[Path | None, typer.Option("--schema", help="JSON/YAML schema file")] = None,
) -> None:
    """Validate files, optionally against a JSON Schema."""
    schema_obj = None
    if schema is not None:
        schema_obj, _ = read_data(schema)
    any_err = False
    for f in files:
        try:
            data, _ = read_data(f)
            if schema_obj is not None:
                js_validate(instance=data, schema=schema_obj)
            console.print(f"[green]OK[/] {f}")
        except Exception as e:
            any_err = True
            console.print(f"[red]ERR[/] {f}: {e}")
    if any_err:
        raise typer.Exit(code=1)


@app.command()
def format(
    files: Annotated[list[Path], typer.Argument(help="Files to format", exists=True)],
    inplace: Annotated[bool, typer.Option("--in-place", "-i", help="Write back to files")] = False,
    check: Annotated[
        bool,
        typer.Option(
            "--check",
            help="Only check formatting; fail if changes would be made",
        ),
    ] = False,
) -> None:
    """Pretty-format JSON/YAML/TOML files consistently."""
    would_change = False
    for f in files:
        data, fmt = read_data(f)
        text_new = dump_str(data, fmt)
        text_old = f.read_text(encoding="utf-8")
        if text_new != text_old:
            would_change = True
            if inplace:
                f.write_text(text_new, encoding="utf-8")
                console.print(f"[yellow]UPDATED[/] {f}")
            else:
                console.print(f"[magenta]DIFFERS[/] {f}")
    if check and would_change:
        raise typer.Exit(code=1)


@app.command()
def convert(
    input: Annotated[Path, typer.Argument(help="Input file", exists=True)],
    to: Annotated[str, typer.Option("--to", help="Target format: json|yaml|toml")],
    output: Annotated[Path | None, typer.Option("-o", "--output", help="Output path")] = None,
) -> None:
    """Convert between JSON, YAML, and TOML."""
    data, _ = read_data(input)
    to_fmt = detect_format(f"dummy.{to.lower()}")
    out_text = dump_str(data, to_fmt)
    if output:
        output.write_text(out_text, encoding="utf-8")
        console.print(f"[green]WROTE[/] {output}")
    else:
        typer.echo(out_text)


@app.command()
def merge(
    inputs: Annotated[
        list[Path],
        typer.Argument(help="Input files", exists=True, min=2),
    ],
    output: Annotated[Path | None, typer.Option("-o", "--output", help="Output file")] = None,
    deep: Annotated[bool, typer.Option("--deep", help="Deep merge nested mappings")] = True,
    to: Annotated[
        str | None,
        typer.Option("--to", help="Force output format (json|yaml|toml)"),
    ] = None,
) -> None:
    """Merge multiple config files. Later files override earlier ones."""
    merged = None
    out_fmt = None
    for i, p in enumerate(inputs):
        data, fmt = read_data(p)
        if i == 0:
            merged = data
            out_fmt = fmt
        else:
            if deep:
                merged = deep_merge(merged, data)
            elif isinstance(merged, dict) and isinstance(data, dict):
                merged = {**merged, **data}
            else:
                merged = data
            # Prefer last file's format unless forced
            out_fmt = fmt
    if to is not None:
        out_fmt = detect_format(f"dummy.{to}")
    assert out_fmt is not None
    text = dump_str(merged, out_fmt)
    if output:
        output.write_text(text, encoding="utf-8")
        console.print(f"[green]WROTE[/] {output}")
    else:
        typer.echo(text)


@app.command()
def redact(
    files: Annotated[list[Path], typer.Argument(help="Files to redact", exists=True)],
    keys: Annotated[list[str], typer.Option("--keys", "-k", help="Comma-separated keys to redact")],
    inplace: Annotated[
        bool, typer.Option("--in-place", "-i", help="Write changes back to files")
    ] = False,
    mask: Annotated[str, typer.Option("--mask", help="Replacement value")] = "***REDACTED***",
) -> None:
    """Redact sensitive keys recursively in configs."""
    if len(keys) == 1 and "," in keys[0]:
        keys = [k.strip() for k in keys[0].split(",") if k.strip()]
    if not keys:
        raise typer.BadParameter("Provide at least one key via --keys/-k")
    for f in files:
        data, fmt = read_data(f)
        redacted = redact_keys(data, set(keys), mask)
        text = dump_str(redacted, fmt)
        if inplace:
            f.write_text(text, encoding="utf-8")
            console.print(f"[yellow]REDACTED[/] {f}")
        else:
            typer.echo(text)


@app.command()
def serve(
    host: Annotated[str, typer.Option("--host")] = "0.0.0.0",
    port: Annotated[int, typer.Option("--port")] = 8000,
    reload: Annotated[bool, typer.Option("--reload")] = False,
) -> None:
    """Run the REST API service."""
    uvicorn.run("allcoder.api:app", host=host, port=port, reload=reload, factory=False)


def main() -> int:
    app()
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())

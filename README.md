# allcoder

Config toolkit CLI for real-world projects: validate, format, convert, merge, and redact JSON/YAML/TOML.

## Features
- Validate files against a JSON Schema (`allcoder validate --schema schema.json file.yaml`)
- Format configs consistently (`allcoder format -i config.yaml`)
- Convert between formats (`allcoder convert input.yaml --to json -o output.json`)
- Merge multiple configs, deep by default (`allcoder merge a.yaml b.yaml -o merged.yaml`)
- Redact sensitive keys recursively (`allcoder redact -k password,token -i secrets.yaml`)

## Install (dev)
```bash
python -m venv .venv
. .venv/bin/activate
pip install -e .[dev]
```

## Usage (CLI)
```bash
# Validate
allcoder validate --schema schema.json settings.yaml

# Format (check only)
allcoder format --check settings.yaml

# Convert
allcoder convert settings.yaml --to toml -o settings.toml

# Merge (deep)
allcoder merge base.yaml override.yaml -o merged.yaml

# Redact
allcoder redact -k password,token -i secrets.yaml
```

## API server
```bash
# Run API locally
allcoder serve --host 0.0.0.0 --port 8000
# Or with Docker
docker build -t allcoder:latest .
docker run --rm -p 8000:8000 allcoder serve --host 0.0.0.0 --port 8000
# Check version
curl http://localhost:8000/version
```

## Publish
- Tag a release to publish to PyPI and GHCR: `git tag v0.1.0 && git push origin v0.1.0`
- Requires secrets: `PYPI_API_TOKEN` for PyPI; GHCR uses `GITHUB_TOKEN`.

## Development
- Lint: `ruff check .` and format: `ruff format .`
- Type check: `mypy src`
- Test: `pytest`

## License
MIT

# See https://docs.docker.com/build/building/best-practices/

# ---- Builder ----
FROM python:3.12-slim AS builder
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN python -m pip install --upgrade pip build
COPY pyproject.toml README.md /app/
COPY src /app/src
RUN python -m build --wheel --outdir /dist

# ---- Runtime ----
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# Install wheel
COPY --from=builder /dist /dist
RUN python -m pip install --no-cache-dir /dist/*.whl
# Create non-root user
RUN useradd -m appuser
USER appuser
# Default entrypoint is CLI; use `serve` for API
ENTRYPOINT ["allcoder"]
CMD ["--version"]
EXPOSE 8000

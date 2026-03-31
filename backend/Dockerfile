# ── Stage 1: dependency installation ──────────────────────────────────────────
# Use the official slim Python 3.12 image as the base.
# "slim" omits optional OS packages, keeping the image small (~45 MB base).
FROM python:3.12-slim AS base

# Set a clean working directory inside the container.
WORKDIR /app

# Copy only the requirements file first.
# Docker caches each layer; by copying requirements BEFORE the source code,
# the expensive "pip install" layer is only re-run when requirements.txt changes.
COPY requirements.txt .

# Install Python dependencies.
# --no-cache-dir  → don't store the pip download cache (saves ~50 MB in the image).
# --upgrade pip   → ensure we're using an up-to-date pip resolver.
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: application image ─────────────────────────────────────────────────
FROM base AS app

# Copy the application source code into the container.
COPY app/ ./app/

# Expose the port FastAPI/uvicorn will listen on.
EXPOSE 8000

# Run the server.
# --host 0.0.0.0  → listen on all network interfaces (required inside Docker).
# --port 8000     → explicit port.
# --workers 2     → two worker processes for better throughput (increase on larger hosts).
# Do NOT use --reload in production (it watches for file changes, wastes CPU).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

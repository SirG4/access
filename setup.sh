#!/usr/bin/env bash
# ==============================================================================
# setup.sh — Setup & Build Helper for Access Portal (NVIDIA RTX 4090 GPU Ready)
# Run this ONCE before launching `docker compose up -d`
# ==============================================================================
# Enable Docker BuildKit & Compose CLI build for fast parallel image builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║   Access Portal — GPU (NVIDIA RTX 4090) & Docker Setup            ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# ── 0. Check Host GPU & NVIDIA Container Toolkit Status ───────────────────────
echo "▶ Checking NVIDIA GPU & Driver status on host..."
if command -v nvidia-smi &>/dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1 || echo "NVIDIA GPU Detected")
    echo "✔  NVIDIA GPU detected: ${GPU_NAME}"
else
    echo "⚠️  WARNING: nvidia-smi command not found. If this PC has an RTX 4090,"
    echo "   please install the NVIDIA host driver (e.g., driver-535 or driver-550)."
fi

if docker info 2>/dev/null | grep -i "nvidia" &>/dev/null || nvidia-ctk --version &>/dev/null; then
    echo "✔  NVIDIA Container Toolkit is installed."
else
    echo "⚠️  WARNING: NVIDIA Container Toolkit is not detected."
    echo "   To enable GPU passthrough to user containers, run:"
    echo "   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg"
    echo "   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list"
    echo "   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit"
    echo "   sudo nvidia-ctk runtime configure --runtime=docker"
    echo "   sudo systemctl restart docker"
fi

echo ""

# ── 1. Build the GPU-enabled SSH base image ───────────────────────────────────
# The Next.js app provisions Ubuntu + CUDA 12.4 + PyTorch containers for users.
# The image must exist on the Docker host before any container is created.
echo "▶  Building GPU SSH base image (access-ubuntu-ssh:latest) via uv..."
echo "   (Pre-installing PyTorch, CUDA 12.4, Transformers, JupyterLab via fast Astral uv installer...)"
docker build -t access-ubuntu-ssh:latest ./docker
echo "✔  GPU SSH base image built successfully."

echo ""

# ── 2. Build & start all Compose services ─────────────────────────────────────
echo "▶  Building Next.js app and starting all services..."
docker compose up -d --build
echo "✔  All services started."

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo " Access portal is now running with RTX 4090 GPU support."
echo " Open http://localhost in your browser."
echo ""
echo " To view live logs:    docker compose logs -f"
echo " To stop everything:  docker compose down"
echo "───────────────────────────────────────────────────────────────────"
echo ""

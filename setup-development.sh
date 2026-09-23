#!/usr/bin/env bash
# ==============================================================================
# setup-development.sh — Lightweight Development Setup for Access Portal
# Fast download footprint (Ubuntu 22.04 + CPU PyTorch, no heavy CUDA binaries)
# ==============================================================================
set -euo pipefail

# Enable Docker BuildKit & Compose CLI build for fast parallel image builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║   Access Portal — Lightweight Development Setup                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# ── 0. Check Host Docker Engine ───────────────────────────────────────────────
echo "▶ Checking Docker Engine status on host..."
if ! command -v docker &>/dev/null; then
    echo "❌ ERROR: docker CLI not found. Please install Docker before proceeding."
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "❌ ERROR: Docker daemon is not running. Please start Docker Engine."
    exit 1
fi
echo "✔  Docker Engine is up and running."

echo ""

# ── 1. Build the lightweight SSH base image ──────────────────────────────────
# Pre-installs Ubuntu 22.04 + CPU PyTorch + JupyterLab + OpenSSH daemon
# Download size is ~90% smaller than full CUDA 12.4 production image.
echo "▶  Building lightweight development SSH base image (access-ubuntu-ssh:dev)..."
echo "   (Pre-installing Python 3.10, CPU PyTorch, JupyterLab via fast Astral uv installer...)"
docker build -t access-ubuntu-ssh:latest -t access-ubuntu-ssh:dev -f ./docker/Dockerfile.dev ./docker
echo "✔  Lightweight SSH base image built successfully."

echo ""

# ── 2. Build & start all Compose services in development mode ───────────────
echo "▶  Building Next.js dev container and starting all services..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
echo "✔  All development services started."

echo ""
echo "───────────────────────────────────────────────────────────────────"
echo " Access portal (Development Mode) is now running."
echo " Open http://localhost:3000 (or http://localhost) in your browser."
echo ""
echo " To view live logs:    docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f"
echo " To stop everything:  docker compose -f docker-compose.yml -f docker-compose.dev.yml down"
echo "───────────────────────────────────────────────────────────────────"
echo ""

#!/usr/bin/env bash
# ==============================================================================
# setup.sh — One-time setup helper for the Access Portal
# Run this ONCE before `docker compose up -d`
# ==============================================================================
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Access Portal — Docker Setup           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Build the SSH base image ───────────────────────────────────────────────
# The Next.js app provisions Ubuntu+OpenSSH containers for users.
# The image must exist on the Docker host before any container is created.
echo "▶  Building SSH base image (access-ubuntu-ssh:latest)..."
docker build -t access-ubuntu-ssh:latest ./docker
echo "✔  SSH base image built."

echo ""

# ── 2. Build & start all Compose services ─────────────────────────────────────
echo "▶  Building Next.js app and starting all services..."
docker compose up -d --build
echo "✔  All services started."

echo ""
echo "────────────────────────────────────────────"
echo " Access portal is now running."
echo " Open http://localhost in your browser."
echo ""
echo " To view logs:        docker compose logs -f"
echo " To stop everything:  docker compose down"
echo "────────────────────────────────────────────"
echo ""

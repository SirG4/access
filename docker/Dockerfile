# ==============================================================================
# Access Portal — NVIDIA RTX 4090 GPU & PyTorch Base Image
# Ubuntu 22.04 + OpenSSH + CUDA 12.4 + PyTorch 2.x + AI ML Suite
# ==============================================================================
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility,graphics \
    PATH="/usr/local/nvidia/bin:/usr/local/cuda/bin:${PATH}"

# Copy Astral uv package installer from official image for ultra-fast dependency resolution & installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 1. Install system utilities, networking tools, process managers, and GPU tools
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    openssh-server \
    sudo \
    curl \
    wget \
    git \
    git-lfs \
    nano \
    vim \
    htop \
    nvtop \
    btop \
    iputils-ping \
    iproute2 \
    net-tools \
    dnsutils \
    procps \
    tmux \
    screen \
    unzip \
    zip \
    rsync \
    tree \
    less \
    pciutils \
    ca-certificates \
    bash \
    build-essential \
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 2. Pre-install PyTorch (CUDA 12.4) + Data Science & AI packages via fast Astral uv installer
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --no-cache \
        torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 && \
    uv pip install --system --no-cache \
        numpy \
        scipy \
        pandas \
        matplotlib \
        seaborn \
        scikit-learn \
        transformers \
        datasets \
        accelerate \
        huggingface_hub \
        bitsandbytes \
        safetensors \
        einops \
        sentencepiece \
        tiktoken \
        jupyterlab \
        notebook \
        ipython

# 3. Configure OpenSSH Daemon
RUN mkdir -p /run/sshd && chmod 0755 /run/sshd

RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config 2>/dev/null || true \
    && sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config 2>/dev/null || true \
    && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config 2>/dev/null || true \
    && sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 22

ENTRYPOINT ["/entrypoint.sh"]

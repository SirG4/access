# ==============================================================================
# Access Portal — NVIDIA RTX 4090 GPU & PyTorch Base Image
# Ubuntu 22.04 + OpenSSH + CUDA 12.4 + PyTorch 2.x + AI ML Suite
# ==============================================================================
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility,graphics

# 1. Install system utilities, python, dev libraries, and GPU monitoring tools
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# 2. Upgrade pip and pre-install PyTorch (CUDA 12.4) + Data Science & AI packages
# Pre-installing these ensures zero setup time for end users on RTX 4090
RUN pip3 install --no-cache-dir --upgrade pip setuptools wheel && \
    pip3 install --no-cache-dir \
        torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 && \
    pip3 install --no-cache-dir \
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

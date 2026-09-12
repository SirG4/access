A web portal for scheduling, provisioning, and managing GPU-accelerated (NVIDIA RTX 4090) Ubuntu + OpenSSH Docker containers with pre-installed PyTorch 2.x, CUDA 12.4, HuggingFace transformers, and persistent user storage.

---

## ⚡ Key Features (NVIDIA RTX 4090 GPU Ready)

- **Zero-Setup AI Suite**: Containers come pre-loaded with **CUDA 12.4**, **PyTorch 2.x**, **HuggingFace Transformers**, `bitsandbytes`, `jupyterlab`, `nvtop`, `htop`, and data science tools. Users require zero manual package setup!
- **NVIDIA GPU Passthrough**: Automatic `--gpus all` device binding for 24 GB VRAM performance on NVIDIA RTX 4090.
- **Dynamic Port & SSH Provisioning**: Isolated SSH user accounts with randomized passwords, live countdown timers, and persistent storage volumes `/home/<user>`.

---

## 🚀 Quick Setup with Docker

To bring up the entire stack (Next.js App, MongoDB database, Caddy Reverse Proxy, and RTX 4090 GPU SSH container base image):

```bash
# Make setup script executable and run it
chmod +x setup.sh
./setup.sh
```

Or step-by-step:

```bash
# 1. Build the user SSH container base image
docker build -t access-ubuntu-ssh:latest ./docker

# 2. Start all services using Docker Compose
docker compose up -d --build
```

Access the portal at `http://localhost` (or your configured IP/domain).

---

## 🌐 Configuring Caddy (Domain vs IP vs Localhost)

The project includes a fully commented [`Caddyfile`](file:///home/bigga/access/Caddyfile) for reverse proxying traffic to the Next.js application.

### Option A: Custom Domain (Automatic HTTPS via Let's Encrypt)
1. Open [`Caddyfile`](file:///home/bigga/access/Caddyfile).
2. Replace `:80` with your domain (e.g. `access.example.com`).
3. Ensure ports 80 and 443 on your server are accessible from the internet.
4. Restart Caddy: `docker compose restart caddy`.

### Option B: Bare IP Address (LAN / VPN / Public IP)
1. Open [`Caddyfile`](file:///home/bigga/access/Caddyfile).
2. Set the block header to `http://YOUR_SERVER_IP` (for plain HTTP) or `https://YOUR_SERVER_IP` (for internal TLS with auto self-signed certificates).
3. Update `SSH_HOST` in `.env.local` to match your server IP so users get the correct SSH command.
4. Restart Caddy: `docker compose restart caddy`.

### Option C: Local Development (`localhost`)
1. By default, Caddy listens on `:80` proxying directly to `nextjs:3000`.

---

## 🛠 Project Services Architecture

- **Next.js Web App** (`access_nextjs`): Port 3000 internally, reverse-proxied by Caddy. Mounted to `/var/run/docker.sock` to dynamically spawn and terminate user SSH containers.
- **MongoDB** (`access_mongodb`): Stores users, slot requests, container metadata, and audit logs.
- **Caddy Proxy** (`access_caddy`): Handles HTTP/HTTPS routing, headers, gzip/zstd compression, and automated TLS certificates.
- **SSH Base Image** (`access-ubuntu-ssh:latest`): Ubuntu + OpenSSH template image used by `lib/docker.js` to provision containers per user session.

---

## 📜 Useful Commands

```bash
# View live logs for all services
docker compose logs -f

# View logs for a specific service (e.g., nextjs or caddy)
docker compose logs -f nextjs

# Restart services after editing Caddyfile or .env.local
docker compose restart

# Stop all containers (retains MongoDB data & volumes)
docker compose down

# Stop and wipe database data (CAUTION)
docker compose down -v
```

# Access Portal — Complete Production Deployment Guide

This document outlines the step-by-step procedure to configure, secure, and deploy the **Access Portal** to production using Docker, MongoDB with authentication, Next.js, and Caddy reverse proxy with automatic HTTPS.

---

## Architecture Overview

```
                        ┌───────────────────────────────────────────────┐
                        │                 Public Internet               │
                        └───────────────────────┬───────────────────────┘
                                                │ Ports 80 & 443 (HTTP/HTTPS)
                                                ▼
                        ┌───────────────────────────────────────────────┐
                        │               Caddy Reverse Proxy             │
                        │             (Automatic Let's Encrypt)         │
                        └───────────────────────┬───────────────────────┘
                                                │ Internal Port 3000
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Access Portal (Next.js Application Container)                                          │
│  • Reads session JWTs & authenticates requests                                         │
│  • Communicates with MongoDB for user & booking data                                   │
│  • Provisions/manages SSH containers via host Docker Socket (/var/run/docker.sock)    │
└──────────────┬─────────────────────────────────────────────────────────┬───────────────┘
               │ Internal Port 27017                                     │ Port Range 2222-2300
               ▼                                                         ▼
┌───────────────────────────────┐                       ┌────────────────────────────────┐
│ MongoDB (Database Container)  │                       │ Provisioned SSH User Containers│
│  • Auth: Enabled              │                       │  • User: Ubuntu + OpenSSH      │
│  • Volume: access_mongodb_data│                       │  • Volume: persistent home dir │
└───────────────────────────────┘                       └────────────────────────────────┘
```

---

## Step 1: Host Prerequisites & Initial Setup

1. **Install Docker & Docker Compose v2**:
   Ensure Docker and the Docker Compose plugin are installed on your Linux server:
   ```bash
   docker --version
   docker compose version
   ```

2. **Configure DNS Records**:
   Point your domain's **A / AAAA** records (e.g. `access.example.com`) to your server's public IP address.

3. **Configure Server Firewall (UFW / Cloud Security Groups)**:
   Allow incoming traffic on required ports:
   * **Port 80 / 443**: Web portal traffic (Caddy HTTP/HTTPS)
   * **Port 22**: Host SSH access
   * **Ports 2222 - 2300**: Mapped SSH access for provisioned user containers

   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 2222:2300/tcp
   sudo ufw enable
   ```

---

## Step 2: Configure Environment Variables (`.env.local`)

Copy `.env.local` or create your production environment configuration file.

### 1. Generate NextAuth Secret
Run this command to generate a cryptographically strong 32-character secret:
```bash
openssl rand -base64 32
```

### 2. Set Up Database Password & Connection URI
Choose a strong password for your MongoDB administrator account (e.g. `MySuperSecretDBPassword123!`).

* **Inside Docker Compose**, the application connects to MongoDB using the service name `mongodb`:
  ```env
  MONGO_ROOT_USER=admin
  MONGO_ROOT_PASSWORD=MySuperSecretDBPassword123!
  MONGODB_URI=mongodb://admin:MySuperSecretDBPassword123!@mongodb:27017/nextauth_admin_db?authSource=admin
  ```

### 3. Complete Production `.env.local` Example

Edit `.env.local` with your real production values:

```env
# ── NextAuth Configuration ──────────────────────────────────────────────────
# Generated via `openssl rand -base64 32`
NEXTAUTH_SECRET=GENERATED_SECRET_STRING_GOES_HERE
NEXTAUTH_URL=https://access.example.com

# ── MongoDB Production Authentication ───────────────────────────────────────
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=MySuperSecretDBPassword123!
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=MySuperSecretDBPassword123!

# Connection string used by Next.js inside Docker
MONGODB_URI=mongodb://admin:MySuperSecretDBPassword123!@mongodb:27017/nextauth_admin_db?authSource=admin


# ── Host SSH Settings ───────────────────────────────────────────────────────
# The publicly reachable IP or domain where user SSH containers can be accessed
SSH_HOST=203.0.113.50

# ── Google OAuth Credentials (Optional) ────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## Step 3: Configure Reverse Proxy (`Caddyfile`)

Open `Caddyfile` in the project root and update it for your domain name and Let's Encrypt email notification address.

```caddy
{
    # Set your email address for Let's Encrypt certificate renewal notices
    email admin@example.com

    log {
        level info
    }
}

# Replace `:80` or `localhost` with your public domain name
access.example.com {

    log {
        output stdout
        format console
        level info
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        -Server
    }

    encode gzip zstd

    # Reverse proxy to the Next.js application container
    reverse_proxy nextjs:3000 {
        header_up X-Real-IP        {remote_host}
        header_up X-Forwarded-For  {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## Step 4: Build the User SSH Container Base Image

Before launching the web portal, you **must build** the base Ubuntu+OpenSSH container image (`access-ubuntu-ssh:latest`) on the Docker host. The portal uses this base image to provision instances for approved user slots.

Run the provided helper script:
```bash
chmod +x setup.sh
./setup.sh
```

Or build manually:
```bash
docker build -t access-ubuntu-ssh:latest ./docker
```

---

## Step 5: Start the Server Stack

Launch all services in detached mode using Docker Compose:

```bash
docker compose up -d --build
```

### Verify Deployment Health

1. **Check Container Status**:
   ```bash
   docker compose ps
   ```
   All 3 containers (`access_nextjs`, `access_mongodb`, and `access_caddy`) should show state `Up` (and `healthy` for MongoDB).

2. **Check Logs**:
   ```bash
   # View all logs
   docker compose logs -f

   # View Next.js application logs specifically
   docker compose logs -f nextjs
   ```

3. **Test Database Connection**:
   Inside the container, Next.js will connect to MongoDB using `MONGODB_URI` with authentication.

---

## Step 6: Create First Admin User & Seed Data

Once the container stack is running, create the default administrator user in MongoDB:

```bash
# Execute the seed script interactively inside the Next.js container:
docker compose exec -it nextjs node scripts/seed.js
```

Or run directly on the host machine (if Node.js is installed locally):
```bash
# Outside Docker on the host machine:
MONGODB_URI="mongodb://admin:AdminAccesspass@localhost:27017/nextauth_admin_db?authSource=admin" node scripts/seed.js
```

---

## Step 7: Useful Management & Operational Commands

| Action | Command |
| :--- | :--- |
| **View Live Logs** | `docker compose logs -f` |
| **Restart Stack** | `docker compose restart` |
| **Rebuild Next.js App** | `docker compose up -d --build nextjs` |
| **Stop All Services** | `docker compose down` |
| **Check Database Status** | `docker compose exec mongodb mongosh -u admin -p --authenticationDatabase admin` |
| **List User Containers** | `docker ps --filter "label=access.managed=true"` |

---

## Backup & Disaster Recovery

* **MongoDB Data Volume**: All database data is stored in named volume `access_mongodb_data`.
  * Backup: `docker run --rm -v access_mongodb_data:/volume -v $(pwd):/backup ubuntu tar cvzf /backup/mongodb_backup.tar.gz /volume`
* **Caddy SSL Certificates**: Saved in named volume `access_caddy_data`. Survives container restarts without triggering Let's Encrypt rate limits.

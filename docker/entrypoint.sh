#!/bin/bash
set -e

# ==============================================================================
# Access Portal - Ubuntu + OpenSSH Container Entrypoint
# ==============================================================================

# Ensure privilege separation directory exists
mkdir -p /run/sshd
chmod 0755 /run/sshd

# Generate OpenSSH host keys if not present
if [ ! -f /etc/ssh/ssh_host_rsa_key ] || [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
    echo "[entrypoint] Generating OpenSSH host keys..."
    ssh-keygen -A 2>/dev/null || true
fi

# Dynamically configure user if SSH_USER is provided
if [ -n "$SSH_USER" ]; then
    # Create user if it doesn't already exist
    if ! id -u "$SSH_USER" >/dev/null 2>&1; then
        echo "[entrypoint] Creating user '$SSH_USER'..."
        useradd -s /bin/bash "$SSH_USER" 2>/dev/null || useradd -m -s /bin/bash "$SSH_USER"
    fi

    # Set user password if provided
    if [ -n "$SSH_PASSWORD" ]; then
        echo "$SSH_USER:$SSH_PASSWORD" | chpasswd
    fi

    # Ensure user has a home directory and correct ownership
    mkdir -p "/home/$SSH_USER"
    chown -R "$SSH_USER:$SSH_USER" "/home/$SSH_USER" 2>/dev/null || true

    # Optional sudo access
    usermod -aG sudo "$SSH_USER" 2>/dev/null || true
fi

# If arguments were provided, execute them instead
if [ $# -gt 0 ]; then
    exec "$@"
fi

echo "[entrypoint] Starting OpenSSH daemon in foreground..."
exec /usr/sbin/sshd -D -e

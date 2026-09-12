import Docker from 'dockerode';
import net from 'net';
import crypto from 'crypto';

// Initialize Dockerode instance using local socket or environment variable
export const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
});

// Default configuration constants
export const DEFAULT_BASE_IMAGE = process.env.DOCKER_BASE_IMAGE || 'access-ubuntu-ssh:latest';
export const FALLBACK_BASE_IMAGE = 'lab/ubuntu-ssh:latest';
export const DEFAULT_PORT_START = 2222;
export const DEFAULT_PORT_END = 2300;

/**
 * Sanitize username for Linux useradd (must start with letter/underscore, alphanumeric or _-)
 */
export function sanitizeUsername(rawUsername) {
  if (!rawUsername || typeof rawUsername !== 'string') {
    return `user_${crypto.randomBytes(4).toString('hex')}`;
  }
  // If email, extract local part
  const base = rawUsername.includes('@') ? rawUsername.split('@')[0] : rawUsername;
  let clean = base.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  // Ensure starts with a letter or underscore
  if (!/^[a-z_]/.test(clean)) {
    clean = `u_${clean}`;
  }
  // Trim length to 30 characters
  return clean.slice(0, 30);
}

/**
 * Test if a TCP port is open and can be bound on the host
 */
export function isPortAvailable(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Check if the base Docker image exists, falling back if necessary
 */
export async function resolveBaseImage() {
  try {
    const images = await docker.listImages();
    const tagMatches = (tag) =>
      images.some((img) => img.RepoTags && img.RepoTags.includes(tag));

    if (tagMatches(DEFAULT_BASE_IMAGE)) {
      return DEFAULT_BASE_IMAGE;
    }
    if (tagMatches(FALLBACK_BASE_IMAGE)) {
      return FALLBACK_BASE_IMAGE;
    }
    // Return default image name; Docker will attempt to pull if configured
    return DEFAULT_BASE_IMAGE;
  } catch (err) {
    console.warn(`[docker] Warning resolving base image: ${err.message}`);
    return DEFAULT_BASE_IMAGE;
  }
}

// In-memory set of ports currently locked during async provisioning to prevent race conditions
const inMemoryReservedPorts = new Set();

/**
 * Scan currently used host ports across Docker containers, DB records, in-memory locks, and host TCP
 */
export async function findAvailablePort(minPort = DEFAULT_PORT_START, maxPort = DEFAULT_PORT_END) {
  // 1. Collect all mapped host ports from docker containers
  const usedPorts = new Set(inMemoryReservedPorts);
  try {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      if (Array.isArray(c.Ports)) {
        for (const p of c.Ports) {
          if (p.PublicPort) {
            usedPorts.add(p.PublicPort);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[docker] Warning querying container ports: ${err.message}`);
  }

  // 2. Also check MongoDB for currently assigned active/approved ports if DB is accessible
  try {
    const SlotRequest = (await import('../models/SlotRequest.js')).default;
    const activeSlots = await SlotRequest.find({
      status: { $in: ['active', 'approved'] },
      'containerDetails.sshPort': { $exists: true, $ne: null },
    }).select('containerDetails.sshPort').lean();

    for (const s of activeSlots) {
      if (s.containerDetails?.sshPort) {
        usedPorts.add(Number(s.containerDetails.sshPort));
      }
    }
  } catch (err) {
    // If DB is not yet connected or in standalone mode, proceed with host & docker checks
  }

  // 3. Iterate over port range and check both Docker/DB allocation and TCP bind
  for (let port = minPort; port <= maxPort; port++) {
    if (usedPorts.has(port)) continue;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  throw new Error(`No available ports in range ${minPort}-${maxPort}`);
}

/**
 * Reserve a port temporarily during provisioning
 */
export function reservePort(port) {
  if (port) inMemoryReservedPorts.add(Number(port));
}

/**
 * Release a temporarily reserved port
 */
export function releasePort(port) {
  if (port) inMemoryReservedPorts.delete(Number(port));
}

/**
 * Ensure persistent volume exists
 */
export async function ensureVolume(volumeName) {
  if (!volumeName) throw new Error('Volume name is required');
  try {
    await docker.createVolume({
      Name: volumeName,
      Labels: {
        'access.managed': 'true',
        'access.volumeName': volumeName,
      },
    });
  } catch (err) {
    // 409 or conflict means volume already exists, which is expected for returning users
    if (err.statusCode !== 409 && !err.message?.includes('already exists')) {
      console.warn(`[docker] Note on creating volume ${volumeName}:`, err.message);
    }
  }
  return volumeName;
}

/**
 * Provision a new Ubuntu + OpenSSH container with persistent volume
 *
 * @param {Object} options
 * @param {string} options.userId - User ID associated with the booking
 * @param {string} options.username - SSH username to create/assign
 * @param {string} [options.password] - SSH password (auto-generated if omitted)
 * @param {number} [options.port] - Host port to map SSH to (auto-allocated if omitted)
 * @param {string} [options.containerName] - Custom container name
 * @param {string} [options.volumeName] - Custom persistent volume name
 * @param {boolean} [options.autoStart=true] - Whether to start the container immediately
 * @returns {Promise<Object>} containerDetails
 */
export async function provisionContainer({
  userId,
  username,
  password,
  port,
  containerName,
  volumeName,
  autoStart = true,
}) {
  if (!userId) throw new Error('userId is required to provision a container');

  const cleanUser = sanitizeUsername(username || `user_${userId}`);
  const finalPassword = password || crypto.randomBytes(9).toString('base64url');
  const finalVolume = volumeName || `vol_access_user_${userId}`;
  const finalPort = port ? Number(port) : await findAvailablePort();
  const finalContainerName =
    containerName || `access_user_${cleanUser}_${Date.now().toString(36)}`;

  // Lock the port immediately to avoid race condition with simultaneous requests
  reservePort(finalPort);

  try {
    // Ensure persistent volume exists
    await ensureVolume(finalVolume);

    // Resolve base image
    const baseImage = await resolveBaseImage();

    // Startup bash script to configure user, permissions, and OpenSSH daemon
    const startupScript = `
if ! id -u "${cleanUser}" >/dev/null 2>&1; then
  useradd -s /bin/bash "${cleanUser}" 2>/dev/null || useradd -m -s /bin/bash "${cleanUser}";
fi;
echo "${cleanUser}:${finalPassword}" | chpasswd;
usermod -aG sudo "${cleanUser}" 2>/dev/null || true;
mkdir -p "/home/${cleanUser}";
chown -R "${cleanUser}:${cleanUser}" "/home/${cleanUser}" 2>/dev/null || true;
mkdir -p /run/sshd;
chmod 0755 /run/sshd;
if [ ! -f /etc/ssh/ssh_host_rsa_key ] || [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
  ssh-keygen -A 2>/dev/null || true;
fi;
exec /usr/sbin/sshd -D -e
`.replace(/\n+/g, ' ').trim();

    const envVars = [
      `SSH_USER=${cleanUser}`,
      `SSH_PASSWORD=${finalPassword}`,
      `SSH_PORT=${finalPort}`,
    ];

    const containerOptions = {
      Image: baseImage,
      name: finalContainerName,
      Cmd: ['bash', '-c', startupScript],
      Env: [...envVars],
      Labels: {
        'access.managed': 'true',
        'access.userId': String(userId),
        'access.username': cleanUser,
        'access.port': String(finalPort),
        'access.volumeName': finalVolume,
      },
      ExposedPorts: {
        '22/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          '22/tcp': [{ HostPort: String(finalPort) }],
        },
        Binds: [
          `${finalVolume}:/home/${cleanUser}`,
        ],
        RestartPolicy: {
          Name: 'no',
        },
      },
    };

    let container;
    const requestGpu = process.env.ENABLE_GPU === 'true' || (process.env.ENABLE_GPU !== 'false' && process.env.NODE_ENV === 'production');

    if (requestGpu) {
      containerOptions.Env.push('NVIDIA_VISIBLE_DEVICES=all', 'NVIDIA_DRIVER_CAPABILITIES=compute,utility');
      containerOptions.HostConfig.DeviceRequests = [
        {
          Driver: '',
          Count: -1, // Allocate all available GPUs (RTX 4090)
          Capabilities: [['gpu']],
        },
      ];
      try {
        container = await docker.createContainer(containerOptions);
      } catch (err) {
        console.warn(`[docker] GPU passthrough request failed (${err.message}). Retrying container creation in CPU-only mode.`);
        delete containerOptions.HostConfig.DeviceRequests;
        containerOptions.Env = [...envVars];
        try {
          const partial = docker.getContainer(finalContainerName);
          await partial.remove({ force: true });
        } catch (_) {}
        container = await docker.createContainer(containerOptions);
      }
    } else {
      container = await docker.createContainer(containerOptions);
    }

    if (autoStart) {
      await container.start();
      // Wait briefly to allow sshd to initialize socket
      await new Promise((r) => setTimeout(r, 800));
    }

    return {
      containerId: container.id,
      containerName: finalContainerName,
      volumeName: finalVolume,
      sshHost: process.env.SSH_HOST || 'localhost',
      sshPort: finalPort,
      sshUser: cleanUser,
      sshPassword: finalPassword,
      status: autoStart ? 'running' : 'created',
    };
  } finally {
    // Release in-memory reservation once container is successfully created or on error
    releasePort(finalPort);
  }
}

/**
 * Start an existing container by containerId
 */
export async function startContainer(containerId) {
  if (!containerId) throw new Error('containerId is required');
  const container = docker.getContainer(containerId);
  try {
    await container.start();
  } catch (err) {
    // 304 means container already started
    if (err.statusCode !== 304) {
      throw err;
    }
  }

  // Brief pause for daemon ready
  await new Promise((r) => setTimeout(r, 600));

  return { containerId, status: 'running' };
}

/**
 * Stop a running container by containerId (volume and container remain intact)
 */
export async function stopContainer(containerId, timeoutSeconds = 10) {
  if (!containerId) throw new Error('containerId is required');
  const container = docker.getContainer(containerId);
  try {
    await container.stop({ t: timeoutSeconds });
  } catch (err) {
    // 304 means container already stopped
    if (err.statusCode !== 304) {
      throw err;
    }
  }

  return { containerId, status: 'stopped' };
}

/**
 * Permanently delete a container and its associated persistent Docker volume
 */
export async function deleteContainerAndVolume(containerId, volumeName) {
  let containerDeleted = false;
  let volumeDeleted = false;

  if (containerId) {
    try {
      const container = docker.getContainer(containerId);
      // Force remove container if running or stopped
      await container.remove({ force: true, v: false });
      containerDeleted = true;
    } catch (err) {
      if (err.statusCode === 404) {
        containerDeleted = true; // Already gone
      } else {
        console.warn(`[docker] Error deleting container ${containerId}: ${err.message}`);
      }
    }
  }

  if (volumeName) {
    try {
      const volume = docker.getVolume(volumeName);
      await volume.remove();
      volumeDeleted = true;
    } catch (err) {
      if (err.statusCode === 404) {
        volumeDeleted = true; // Already gone
      } else {
        console.warn(`[docker] Error deleting volume ${volumeName}: ${err.message}`);
      }
    }
  }

  return { containerDeleted, volumeDeleted };
}

/**
 * Inspect container state
 */
export async function inspectContainer(containerId) {
  if (!containerId) return null;
  try {
    const container = docker.getContainer(containerId);
    return await container.inspect();
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Get simple container status ('running', 'stopped', 'not_found', etc.)
 */
export async function getContainerStatus(containerId) {
  const data = await inspectContainer(containerId);
  if (!data) return 'not_found';
  return data.State?.Running ? 'running' : 'stopped';
}

/**
 * Broadcast a message to the container's terminal sessions using 'wall'
 */
export async function broadcastMessage(containerId, message) {
  if (!containerId) throw new Error('containerId is required');
  try {
    const container = docker.getContainer(containerId);
    const formattedMsg = `\\n\\r*** ${message} ***\\n\\r`;
    const exec = await container.exec({
      Cmd: [
        'sh',
        '-c',
        `wall "${message}" 2>/dev/null || true; for tty in /dev/pts/[0-9]*; do [ -e "$tty" ] && printf "${formattedMsg}" > "$tty" 2>/dev/null; done`,
      ],
      AttachStdout: true,
      AttachStderr: true,
    });
    await exec.start();
  } catch (err) {
    console.warn(`[docker] Failed to broadcast message to container ${containerId}: ${err.message}`);
  }
}

/**
 * List all containers managed by the Access portal
 */
export async function listManagedContainers() {
  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: ['access.managed=true'],
    },
  });
  return containers;
}

const dockerEngine = {
  docker,
  DEFAULT_BASE_IMAGE,
  DEFAULT_PORT_START,
  DEFAULT_PORT_END,
  sanitizeUsername,
  isPortAvailable,
  resolveBaseImage,
  findAvailablePort,
  reservePort,
  releasePort,
  ensureVolume,
  provisionContainer,
  startContainer,
  stopContainer,
  deleteContainerAndVolume,
  inspectContainer,
  getContainerStatus,
  listManagedContainers,
  broadcastMessage,
};

export default dockerEngine;


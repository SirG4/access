import Docker from 'dockerode';
import net from 'net';
import crypto from 'crypto';
import { exec as childExec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(childExec);

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

let isGpuHostAvailable = null;

export async function checkGpuSupport() {
  if (isGpuHostAvailable !== null) return isGpuHostAvailable;
  try {
    const { stdout } = await execAsync('nvidia-smi', { timeout: 1000 });
    isGpuHostAvailable = Boolean(stdout && stdout.includes('NVIDIA-SMI'));
  } catch {
    isGpuHostAvailable = false;
  }
  return isGpuHostAvailable;
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
  ramLimitGB = 8,
  gpuRamGB = 8,
  storageGB = 100,
}) {
  if (!userId) throw new Error('userId is required to provision a container');

  const cleanUser = sanitizeUsername(username || `user_${userId}`);
  const finalPassword = password || crypto.randomBytes(9).toString('base64url');
  const finalVolume = volumeName || `vol_access_user_${userId}`;
  const finalPort = port ? Number(port) : await findAvailablePort();
  const finalContainerName =
    containerName || `access_user_${cleanUser}_${Date.now().toString(36)}`;

  const finalRamLimitGB = Number(ramLimitGB) || 8;
  const finalGpuRamGB = Number(gpuRamGB) || 8;
  const finalStorageGB = Number(storageGB) || 100;
  const ramLimitBytes = finalRamLimitGB * 1024 * 1024 * 1024;

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

    const baseHostConfig = {
      PortBindings: {
        '22/tcp': [{ HostPort: String(finalPort) }],
      },
      Binds: [
        `${finalVolume}:/home/${cleanUser}`,
      ],
      Memory: ramLimitBytes,
      MemorySwap: ramLimitBytes,
      StorageOpt: {
        size: `${finalStorageGB}G`,
      },
      RestartPolicy: {
        Name: 'no',
      },
    };

    const cpuContainerOptions = {
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
        'access.ramLimitGB': String(finalRamLimitGB),
        'access.gpuRamLimitGB': String(finalGpuRamGB),
        'access.storageLimitGB': String(finalStorageGB),
      },
      ExposedPorts: {
        '22/tcp': {},
      },
      HostConfig: { ...baseHostConfig },
    };

    let container;
    const requestGpu = process.env.ENABLE_GPU === 'true' || (process.env.ENABLE_GPU !== 'false' && process.env.NODE_ENV === 'production');

    const cleanupPartial = async (name) => {
      const namesToClean = new Set([name, finalContainerName, `${finalContainerName}_cpu`].filter(Boolean));
      for (const n of namesToClean) {
        try {
          const partial = docker.getContainer(n);
          await partial.remove({ force: true, v: false });
        } catch (_) { }
      }
      await new Promise((r) => setTimeout(r, 200));
    };

    const tryCreate = async (options) => {
      await cleanupPartial(options.name);
      return new Promise((resolve, reject) => {
        docker.createContainer(options, (err, container) => {
          if (err) return reject(err);
          resolve(container);
        });
      });
    };

    const gpuContainerOptions = JSON.parse(JSON.stringify(cpuContainerOptions));
    gpuContainerOptions.Env.push('NVIDIA_VISIBLE_DEVICES=all', 'NVIDIA_DRIVER_CAPABILITIES=compute,utility');
    gpuContainerOptions.HostConfig.DeviceRequests = [
      {
        Driver: '',
        Count: -1, // Allocate all available GPUs (RTX 4090)
        Capabilities: [['gpu']],
      },
    ];

    const buildCpuOpts = (name, includeHostLimits = true) => {
      const opts = JSON.parse(JSON.stringify(cpuContainerOptions));
      opts.name = name;
      opts.Runtime = 'runc';
      if (opts.HostConfig) {
        delete opts.HostConfig.DeviceRequests;
        if (!includeHostLimits) {
          delete opts.HostConfig.StorageOpt;
          delete opts.HostConfig.Memory;
          delete opts.HostConfig.MemorySwap;
        }
      }
      return opts;
    };

    let activeContainerName = finalContainerName;

    const attemptCreation = async () => {
      if (requestGpu) {
        try {
          return await tryCreate(gpuContainerOptions);
        } catch (gpuErr) {
          console.warn(`[docker] GPU passthrough request failed (${gpuErr.message}). Falling back to CPU mode.`);
          activeContainerName = `${finalContainerName}_cpu`;
          try {
            return await tryCreate(buildCpuOpts(activeContainerName, true));
          } catch (cpuErr) {
            console.warn(`[docker] CPU passthrough fallback (${cpuErr.message}). Retrying CPU container creation without host resource constraints.`);
            return await tryCreate(buildCpuOpts(activeContainerName, false));
          }
        }
      } else {
        try {
          return await tryCreate(buildCpuOpts(finalContainerName, true));
        } catch (cpuErr) {
          return await tryCreate(buildCpuOpts(finalContainerName, false));
        }
      }
    };

    container = await attemptCreation();

    if (autoStart) {
      await container.start();
      // Wait briefly to allow sshd to initialize socket
      await new Promise((r) => setTimeout(r, 800));
    }

    return {
      containerId: container.id,
      containerName: activeContainerName || finalContainerName,
      volumeName: finalVolume,
      sshHost: process.env.SSH_HOST || 'localhost',
      sshPort: finalPort,
      sshUser: cleanUser,
      sshPassword: finalPassword,
      status: autoStart ? 'running' : 'created',
      ramLimitGB: finalRamLimitGB,
      gpuRamLimitGB: finalGpuRamGB,
      storageLimitGB: finalStorageGB,
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

const updatedLimitsCache = new Map();

/**
 * Query live RAM, GPU RAM, and Storage usage for a container
 */
export async function getContainerLiveStats(containerId) {
  if (!containerId) return null;

  try {
    const container = docker.getContainer(containerId);
    let inspect = null;
    try {
      inspect = await container.inspect();
    } catch {
      return null;
    }

    const labels = inspect?.Config?.Labels || {};

    // Get stored or default limits
    let ramLimitGB = Number(labels['access.ramLimitGB']) || 8;
    let gpuRamLimitGB = Number(labels['access.gpuRamLimitGB']) || 8;
    let storageLimitGB = Number(labels['access.storageLimitGB']) || 100;

    // Check Docker Engine HostConfig Memory
    if (inspect?.HostConfig?.Memory && inspect.HostConfig.Memory > 0) {
      ramLimitGB = Math.round(inspect.HostConfig.Memory / (1024 * 1024 * 1024));
    }

    // Check in-memory limits cache for live updates
    const cached = updatedLimitsCache.get(containerId) || updatedLimitsCache.get(containerId.slice(0, 12));
    if (cached) {
      if (cached.ramLimitGB) ramLimitGB = cached.ramLimitGB;
      if (cached.gpuRamLimitGB) gpuRamLimitGB = cached.gpuRamLimitGB;
      if (cached.storageLimitGB) storageLimitGB = cached.storageLimitGB;
    }

    // Also try SlotRequest in DB if present
    try {
      const SlotRequest = (await import('../models/SlotRequest.js')).default;
      const sr = await SlotRequest.findOne({ 'containerDetails.containerId': containerId }).lean();
      if (sr?.containerDetails) {
        if (sr.containerDetails.ramLimitGB) ramLimitGB = sr.containerDetails.ramLimitGB;
        if (sr.containerDetails.gpuRamLimitGB) gpuRamLimitGB = sr.containerDetails.gpuRamLimitGB;
        if (sr.containerDetails.storageLimitGB) storageLimitGB = sr.containerDetails.storageLimitGB;
      }
    } catch { }

    const ramLimitBytes = ramLimitGB * 1024 * 1024 * 1024;
    const storageLimitBytes = storageLimitGB * 1024 * 1024 * 1024;

    const isRunning = Boolean(inspect?.State?.Running);

    if (!isRunning) {
      return {
        containerId,
        status: 'stopped',
        ram: {
          usedBytes: 0,
          limitBytes: ramLimitBytes,
          usedGB: 0,
          limitGB: ramLimitGB,
          usagePercent: 0,
        },
        gpu: {
          usedMB: 0,
          limitMB: gpuRamLimitGB * 1024,
          usedGB: 0,
          limitGB: gpuRamLimitGB,
          usagePercent: 0,
          gpuPresent: false,
        },
        storage: {
          usedBytes: 0,
          limitBytes: storageLimitBytes,
          usedGB: 0,
          limitGB: storageLimitGB,
          usagePercent: 0,
        },
        timestamp: Date.now(),
      };
    }

    // Container is running
    // 1. RAM Usage via Docker API stats
    let usedRamBytes = 0;
    try {
      const stats = await container.stats({ stream: false });
      if (stats && stats.memory_stats) {
        const rawUsage = stats.memory_stats.usage || 0;
        const cache = stats.memory_stats.stats?.cache || stats.memory_stats.stats?.inactive_file || 0;
        usedRamBytes = Math.max(0, rawUsage - cache);
      }
    } catch (err) {
      console.warn(`[docker] Warning getting memory stats for ${containerId}: ${err.message}`);
    }

    const usedRamGB = parseFloat((usedRamBytes / (1024 * 1024 * 1024)).toFixed(3));
    const ramPercent = parseFloat(((usedRamBytes / ramLimitBytes) * 100).toFixed(1));

    // 2. Storage Usage via df -B1 in container
    let usedStorageBytes = 0;
    try {
      const exec = await container.exec({
        Cmd: ['sh', '-c', 'df -B1 /home 2>/dev/null || df -B1 /'],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({});
      let output = '';
      await new Promise((resolve) => {
        stream.on('data', (chunk) => { output += chunk.toString(); });
        stream.on('end', resolve);
        stream.on('error', resolve);
        setTimeout(resolve, 1200);
      });

      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[lines.length - 1].trim().split(/\s+/);
        if (parts.length >= 3 && !isNaN(parts[2])) {
          usedStorageBytes = parseInt(parts[2], 10);
        }
      }
    } catch (err) {
      console.warn(`[docker] Warning getting storage stats for ${containerId}: ${err.message}`);
    }

    const usedStorageGB = parseFloat((usedStorageBytes / (1024 * 1024 * 1024)).toFixed(3));
    const storagePercent = parseFloat(((usedStorageBytes / storageLimitBytes) * 100).toFixed(1));

    // 3. GPU Memory Usage (via nvidia-smi host check or container exec)
    let gpuUsedMB = 0;
    let gpuPresent = false;

    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits', { timeout: 1500 });
      if (stdout) {
        const line = stdout.trim().split('\n')[0];
        const [usedStr] = line.split(',').map((s) => s.trim());
        if (!isNaN(usedStr)) {
          gpuUsedMB = parseInt(usedStr, 10);
          gpuPresent = true;
        }
      }
    } catch {
      try {
        const exec = await container.exec({
          Cmd: ['nvidia-smi', '--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await exec.start({});
        let output = '';
        await new Promise((resolve) => {
          stream.on('data', (chunk) => { output += chunk.toString(); });
          stream.on('end', resolve);
          stream.on('error', resolve);
          setTimeout(resolve, 800);
        });
        const line = output.trim().split('\n')[0];
        if (line) {
          const [usedStr] = line.split(',').map((s) => s.trim());
          if (!isNaN(usedStr)) {
            gpuUsedMB = parseInt(usedStr, 10);
            gpuPresent = true;
          }
        }
      } catch {
        gpuPresent = false;
      }
    }

    const gpuLimitMB = gpuRamLimitGB * 1024;
    const gpuUsedGB = parseFloat((gpuUsedMB / 1024).toFixed(3));
    const gpuPercent = parseFloat(((gpuUsedMB / gpuLimitMB) * 100).toFixed(1));

    return {
      containerId,
      status: 'running',
      ram: {
        usedBytes: usedRamBytes,
        limitBytes: ramLimitBytes,
        usedGB: usedRamGB,
        limitGB: ramLimitGB,
        usagePercent: Math.min(100, Math.max(0, ramPercent)),
      },
      gpu: {
        usedMB: gpuUsedMB,
        limitMB: gpuLimitMB,
        usedGB: gpuUsedGB,
        limitGB: gpuRamLimitGB,
        usagePercent: Math.min(100, Math.max(0, gpuPercent)),
        gpuPresent,
      },
      storage: {
        usedBytes: usedStorageBytes,
        limitBytes: storageLimitBytes,
        usedGB: usedStorageGB,
        limitGB: storageLimitGB,
        usagePercent: Math.min(100, Math.max(0, storagePercent)),
      },
      timestamp: Date.now(),
    };
  } catch (err) {
    console.warn(`[docker] Failed to get live stats for container ${containerId}: ${err.message}`);
    return null;
  }
}

/**
 * Update resource limits (RAM, GPU RAM, Storage) for a container
 */
export async function updateContainerLimits(containerId, { ramLimitGB, gpuRamLimitGB, storageLimitGB }) {
  if (!containerId) throw new Error('containerId is required');

  const finalRamGB = Math.max(1, Number(ramLimitGB) || 8);
  const finalGpuRamGB = Math.max(1, Number(gpuRamLimitGB) || 8);
  const finalStorageGB = Math.max(1, Number(storageLimitGB) || 100);

  // Store in cache for real-time live usage graph retrieval
  updatedLimitsCache.set(containerId, {
    ramLimitGB: finalRamGB,
    gpuRamLimitGB: finalGpuRamGB,
    storageLimitGB: finalStorageGB,
  });
  if (containerId.length > 12) {
    updatedLimitsCache.set(containerId.slice(0, 12), {
      ramLimitGB: finalRamGB,
      gpuRamLimitGB: finalGpuRamGB,
      storageLimitGB: finalStorageGB,
    });
  }

  const ramBytes = finalRamGB * 1024 * 1024 * 1024;

  // 1. Update HostConfig on Docker host if container exists
  try {
    const container = docker.getContainer(containerId);
    const inspect = await container.inspect();
    if (inspect) {
      await container.update({
        Memory: ramBytes,
        MemorySwap: ramBytes,
      });
    }
  } catch (err) {
    console.warn(`[docker] Note updating container HostConfig via Dockerode for ${containerId}: ${err.message}`);
  }

  // 2. Update DB SlotRequest if linked
  try {
    const SlotRequest = (await import('../models/SlotRequest.js')).default;
    let slotRequest = await SlotRequest.findOne({ 'containerDetails.containerId': containerId });
    if (!slotRequest && typeof containerId === 'string' && containerId.match(/^[0-9a-fA-F]{24}$/)) {
      slotRequest = await SlotRequest.findById(containerId);
    }
    if (slotRequest) {
      if (!slotRequest.containerDetails) slotRequest.containerDetails = {};
      slotRequest.containerDetails.ramLimitGB = finalRamGB;
      slotRequest.containerDetails.gpuRamLimitGB = finalGpuRamGB;
      slotRequest.containerDetails.storageLimitGB = finalStorageGB;
      await slotRequest.save();
    }
  } catch (err) {
    console.warn(`[docker] Note updating DB SlotRequest for container ${containerId}: ${err.message}`);
  }

  return {
    containerId,
    ramLimitGB: finalRamGB,
    gpuRamLimitGB: finalGpuRamGB,
    storageLimitGB: finalStorageGB,
  };
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
  getContainerLiveStats,
  updateContainerLimits,
};

export default dockerEngine;


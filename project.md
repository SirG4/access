# Access Supercomputer Portal

Access is a web portal for requesting scheduled access to shared compute resources. Users reserve time slots, and administrators review those requests. When an approved slot begins, the system starts or provisions an isolated Ubuntu container and gives the user SSH connection details. At the end of the slot, the container stops while its persistent storage remains available for later sessions.

## User Features

- **Account access:** Register and sign in with a local account or Google authentication.
- **Compute calendar:** Browse occupied and requested slots in day, week, or month views; move between dates and view booking status.
- **Booking requests:** Submit a request with a title, purpose, start time, and end time. The portal checks that the time is in the future, the end follows the start, and the requested period does not overlap another booking.
- **Request tracking:** Review booking history and statuses, including pending, approved, rejected, active, completed, and cancelled. Pending requests and future approved requests can be cancelled by the requester.
- **Session dashboard:** See the current session or next approved booking, with a live time remaining display while a session is active.
- **SSH access details:** During an active session, view the host, port, username, and password; reveal or hide the password and copy individual details or a ready-to-run SSH command.
- **Persistent workspace:** Keep files in the mounted `/workspace` directory across sessions. Scheduled shutdown stops the container but preserves its storage until an administrator removes it.

## Administrator Features

- **Request review:** View and filter requests by status; approve requests or reject them with a reason.
- **User management:** Browse user accounts and authentication providers, change user/admin roles, and manage accounts.
- **Container operations:** Search and filter managed containers, inspect running or stopped state, and force-start or force-stop a container.
- **Resource monitoring:** View live RAM, GPU RAM, and storage usage, with short usage-history graphs for managed containers.
- **Resource limits:** Configure RAM, GPU memory, and persistent storage limits for a container.
- **Session intervention:** Force-terminate an active session when necessary.
- **Data cleanup:** Permanently delete a managed container and its persistent volume.
- **Audit history:** Review and filter records of request decisions, session lifecycle events, container operations, and recovery activity.

## Automated Compute Lifecycle

1. A user submits a request and it remains pending until an administrator acts on it.
2. When an approved time slot begins, the scheduler starts the user's existing managed container or provisions one if needed, then marks the request active.
3. The portal assigns SSH connection details and maps the container's SSH service to an available host port.
4. Near the end of a session, the scheduler can send a warning; when the slot ends, it stops the container and marks the request completed.
5. The container and persistent volume remain available for reuse. An administrator can remove them permanently from the container management page.

The scheduler also reconciles container state after service restarts. Port allocation checks Docker containers, saved booking records, temporary reservations, and host port availability to avoid assigning an occupied port.

## Compute Environment

Each session uses a Docker-managed Ubuntu container with OpenSSH and a per-user Linux account. The production image is intended for NVIDIA GPU workloads and includes CUDA and common machine-learning tools; GPU availability depends on a compatible host and Docker GPU support. Each user's persistent Docker volume is mounted into their home/workspace area. A lightweight development image is also provided for CPU-oriented development.

## Application Components

- **Next.js application:** User portal, administrator pages, authentication, and API routes.
- **MongoDB:** Stores user accounts, booking requests, container metadata, and audit records.
- **Docker Engine:** Runs and manages the per-user compute containers and persistent volumes.
- **Lifecycle scheduler:** Activates approved sessions, stops containers at their scheduled end, and reconciles state.
- **Caddy:** Optional reverse proxy for routing and HTTPS in the deployed stack.

For installation, environment variables, and deployment commands, see [README.md](README.md) and [deployment-steps.md](deployment-steps.md).
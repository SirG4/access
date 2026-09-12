# Setup and Run Instructions

Follow these steps to set up the project on any machine after cloning the repository.

## Prerequisites

Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Docker](https://www.docker.com/products/docker-desktop) and Docker Compose (to run the local MongoDB instance)
- npm (comes with Node.js)

## Setup Steps

### 1. Install Dependencies
Navigate to the root directory of the project and install all required Node.js packages:
```bash
npm install
```

### 2. Configure Environment Variables
You need a `.env.local` file for the application to run.
1. Create a file named `.env.local` in the root directory.
2. Add the following variables (you can replace the secret and DB URI if needed):

```env
NEXTAUTH_SECRET=a_very_secure_random_string_for_testing
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/nextauth_admin_db

# (Optional) For Google Authentication
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# (Optional) Docker Engine & SSH Configuration
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_BASE_IMAGE=access-ubuntu-ssh:latest
SSH_HOST=localhost
```

### 3. Start the Local MongoDB Database
Ensure Docker is running on your machine, then execute the following command to start the MongoDB container in the background:
```bash
docker compose up -d
```
*(To stop the database later, you can run `docker compose down`)*

### 4. Build or Tag the Base Docker Image
The supercomputer slot provisioning engine uses an Ubuntu base container with OpenSSH server (`access-ubuntu-ssh:latest`).
Build the image from the included `docker/` directory:
```bash
docker build -t access-ubuntu-ssh:latest docker/
```
*(Or if `lab/ubuntu-ssh:latest` is already present on your host: `docker tag lab/ubuntu-ssh:latest access-ubuntu-ssh:latest`)*.

### 5. Seed the Database (Optional but Recommended)
To create an initial admin user so you can log into the admin dashboard, run the seeding script:
```bash
node scripts/seed.js
```
*(Note: If the script uses modern ES modules or needs to be compiled, ensure you use the correct command. For this project, standard node should work).*

### 6. Start the Development Server
Finally, start the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### 7. Running Validation & Checkpoint Tests

#### Checkpoint 1 — Slot Request APIs
To run the automated verification script for the slot request data models, collision validation, and user/admin access boundaries:
```bash
node scripts/test-checkpoint-1.js
```

#### Checkpoint 2 — Calendar UI & Slot Booking
To verify the calendar data feeds, booking submission, and conflict detection APIs:
```bash
node scripts/test-checkpoint-2.js
```
You can override the test account with environment variables:
```bash
TEST_USER_EMAIL=myuser@example.com TEST_USER_PASSWORD=mypassword node scripts/test-checkpoint-2.js
```

#### Checkpoint 3 — Admin Request Review & Approval
To verify the admin approval/rejection workflow, access control, and status propagation:
```bash
node scripts/test-checkpoint-3.js
```
You can override the test accounts with environment variables:
```bash
TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=admin123 \
TEST_USER_EMAIL=myuser@example.com TEST_USER_PASSWORD=mypassword \
node scripts/test-checkpoint-3.js
```
The script automatically creates test slot requests, approves one, rejects another (with a reason), and then verifies both the admin view and the user's view.

#### Checkpoint 4 — Docker Provisioning Engine & Persistence
To verify Docker container provisioning, dynamic user creation, SSH authentication, persistent storage volume across container stop/restart, and cleanup:
```bash
node scripts/test-docker.js
# or
node scripts/test-checkpoint-4.js
```
The automated script executes the following end-to-end checks:
1. **Provision Container**: Creates a managed Ubuntu container with dynamic user credentials, allocates an available port in the 2222–2300 range, and mounts persistent volume `vol_access_user_<userId>` to `/home/<username>`.
2. **SSH Connection & Auth**: Connects directly via SSH, verifies authentication for the created user, and confirms bash environment.
3. **Persistent Volume Write**: Creates a test file inside the container at `/home/<user>/test.txt`.
4. **Stop Container**: Gracefully stops the container via `stopContainer()` and verifies SSH port is closed.
5. **Restart Container**: Restarts the container via `startContainer()`, reconnects via SSH, and verifies `/home/<user>/test.txt` persists with exact contents.
6. **Cleanup**: Deletes both container and persistent volume via `deleteContainerAndVolume()`, verifying complete removal.

#### Checkpoint 5 — Automated Scheduler & Container Lifecycle Controller
To verify the automated background scheduler, slot start handling (auto-provisioning, credential generation, status to `active`), live SSH verification, slot end handling (auto-stopping container, volume preservation, status to `completed`), and background interval polling:
```bash
node scripts/test-checkpoint-5.js
```
The automated test suite verifies:
1. **Start Handler**: Detects approved slots reaching their `startTime`, auto-provisions or starts the container, generates secure SSH credentials, allocates a free port, and transitions status to `active`.
2. **Live SSH Access**: Connects via SSH to the live mapped port using the generated credentials to verify immediate access readiness.
3. **Idempotency**: Multiple ticks while active keep the container running without duplicate provisioning.
4. **End Handler**: Detects active slots reaching their `endTime`, gracefully stops the container, preserves the container and user persistent volume on host, and transitions status to `completed`.
5. **Expired Slot Handling**: Safely marks slots `completed` if their time window elapsed while the server was offline.
6. **Continuous Polling Loop**: Verifies background interval timer transitions slots automatically without manual tick triggers.

##### Running the Scheduler as a Standalone Daemon
You can also run the scheduler service directly in a dedicated terminal or as a background service:
```bash
# Default polling interval (30 seconds)
node scripts/scheduler.js

# Custom polling interval (e.g., 15 seconds)
node scripts/scheduler.js --interval 15

# Single execution tick and exit
node scripts/scheduler.js --once
```
*(Note: When running `npm run dev` or `npm run start`, the Next.js `instrumentation.js` hook automatically boots the scheduler in the Node.js runtime).*

#### Checkpoint 6 — User Active Session Portal & SSH Access Dashboard
To verify the User Active Access Portal, live countdown timer, 1-click SSH command copy, password show/hide toggle & copy actions, SSH login validation, and slot completion UI transition:
```bash
node scripts/test-checkpoint-6.js
```
The automated test suite verifies:
1. **Slot Activation & Credentials Availability**: Confirms slot request status transitions to `active` when `startTime` arrives and `containerDetails` (SSH host, port, username, password, volume) is generated.
2. **User Dashboard Data Contract**: Queries user requests API (`GET /api/requests`) and verifies the formatted SSH command string is supplied.
3. **Live SSH Access**: Establishes an interactive SSH session to the container over the allocated host TCP port using the active session credentials.
4. **Active Session Countdown**: Computes remaining slot time and verifies positive countdown bounds.
5. **Slot Completion & Shutdown**: Transitions slot to `completed` when `endTime` elapses, gracefully stops the Docker container, and preserves user storage volume `vol_access_user_<userId>`.
6. **Post-Completion Dashboard State**: Confirms the portal UI updates to present the concluded session state and container stopped status.

#### Checkpoint 7 — Admin Container Management & Data Cleanup
To verify the Admin Containers & Storage management portal, live host container inspection, manual Force Start / Force Stop state toggling, permanent container deletion, and persistent Docker volume data purging:
```bash
node scripts/test-checkpoint-7.js
```
The automated test suite verifies:
1. **Container Listing & Live Host State Integration**: Queries `GET /api/admin/containers` to verify merging of MongoDB slot request metadata with live Docker host container runtime state.
2. **Force Stop Toggle**: Executes `POST /api/admin/containers/[id]/toggle` with action `stop` and confirms the host container transitions to `stopped`.
3. **Force Start Toggle**: Executes `POST /api/admin/containers/[id]/toggle` with action `start` and confirms the host container restarts to `running`.
4. **Permanent Container & Persistent Volume Deletion**: Executes `DELETE /api/admin/containers/[id]`, confirming host container removal (`docker ps -a`) and complete volume purging (`docker volume ls`).
5. **Database State Resync**: Confirms associated `SlotRequest` status is updated to `completed` and container references are cleared.

#### Checkpoint 8 — End-to-End Integration, Resilience & Edge Cases
To verify the complete user lifecycle, user cancellation and slot re-booking, admin force termination, server restart recovery reconciliation, port collision concurrency locks, and audit logging:
```bash
node scripts/test-checkpoint-8.js
```
The automated test suite executes 21 end-to-end checks:
1. **Full User Lifecycle**: User registration -> Slot booking -> Admin review & approval -> Scheduler automated activation -> Interactive SSH login & persistent storage write -> Scheduler automated completion -> Admin container & persistent storage deletion.
2. **User Cancellation & Conflict Release**: Confirms normal user cancellation of pending requests (`/api/requests/[id]/cancel`), transitions status to `cancelled`, and frees up the calendar slot window for re-booking.
3. **Admin Force Termination**: Forces early session termination (`/api/admin/requests/[id]/terminate`), immediately stopping the host Docker container and transitioning status to `completed` while preserving data.
4. **Server Restart Recovery (`syncContainerStates`)**: Reconciles database statuses with live Docker engine states upon server boot or tick: handles expired active slots, restarts offline containers for valid active slots, and cleans up orphaned containers.
5. **Port Allocation Manager Concurrency**: Verifies multi-threaded/concurrent port requests use in-memory locks, DB checks, and TCP bind verification to prevent port collisions.
6. **Audit & Security Logging**: Confirms audit records are created for all key operational events (`REQUEST_CREATED`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `REQUEST_CANCELLED`, `SESSION_ACTIVATED`, `SESSION_COMPLETED`, `SESSION_FORCE_TERMINATED`, `CONTAINER_FORCE_STARTED`, `CONTAINER_FORCE_STOPPED`, `CONTAINER_DELETED`, `SYSTEM_SYNC_RECOVERY`).



## API Reference

### Slot Request APIs (User)

#### 1. `POST /api/requests`
Submits a new supercomputer slot request.
- **Auth Required**: Yes (Logged in user)
- **Body (`application/json`)**:
  ```json
  {
    "title": "Deep Learning Training",
    "purpose": "Fine-tuning LLM model on GPU node",
    "startTime": "2026-09-13T10:00:00.000Z",
    "endTime": "2026-09-13T12:00:00.000Z"
  }
  ```
- **Validation**:
  - `startTime` and `endTime` are required and must be valid future dates.
  - `endTime` must be strictly after `startTime`.
  - Collision check: Rejects requests overlapping with any existing `pending`, `approved`, or `active` bookings (returns `409 Conflict`).

#### 2. `GET /api/requests`
Fetches slot requests.
- **Auth Required**: Yes
- **Behavior**:
  - **Normal Users**: Returns only requests created by the authenticated user.
  - **Admins**: Returns all requests across all users, populated with user info (`email`, `role`).
- **Query Params**:
  - `status` (optional): Filter by `pending`, `approved`, `rejected`, `active`, `completed`, or `cancelled`.

#### 3. `POST /api/requests/[id]/cancel` (or `PATCH /api/requests/[id]/cancel`)
Cancels a pending or upcoming approved slot request.
- **Auth Required**: Yes (Owner or Admin)
- **Behavior**: Transitions request status to `cancelled`, stops any provisioned container, releases the calendar time window, and records a `REQUEST_CANCELLED` audit log.

#### 4. `GET /api/requests/slots`
Fetches booked and occupied slots for calendar rendering.
- **Query Params**:
  - `start` (optional): ISO start date of window.
  - `end` (optional): ISO end date of window.
  - `status` (optional): Filter specific status (defaults to `pending`, `approved`, and `active`).

### Admin APIs

#### 4. `PATCH /api/admin/requests/[id]`
Approves or rejects a slot request. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Body (`application/json`)**:
  ```json
  {
    "status": "approved"
  }
  ```
  Or, to reject:
  ```json
  {
    "status": "rejected",
    "rejectionReason": "Maintenance window scheduled during this time.",
    "adminNotes": "Optional internal notes."
  }
  ```
- **Validation**:
  - `status` must be `approved` or `rejected`.
  - `rejectionReason` is **required** when `status` is `rejected`.
  - Only `pending` requests can be approved or rejected (returns `409` for other statuses).
- **Returns**: The updated `SlotRequest` document populated with user email.

#### 5. `GET /api/admin/requests/[id]`
Fetches a single slot request by ID. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Returns**: The `SlotRequest` document populated with user email.

#### 6. `GET /api/admin/scheduler`
Queries the live status of the automated background scheduler, active slot counts, and currently running containers. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Returns**:
  ```json
  {
    "scheduler": {
      "running": true,
      "intervalMs": 30000,
      "isProcessing": false,
      "lastRunTime": "2026-09-12T07:00:00.000Z",
      "lastResult": {
        "activated": [],
        "completed": [],
        "expired": [],
        "errors": []
      }
    },
    "counts": {
      "active": 1,
      "approved": 2
    },
    "activeRequests": [...]
  }
  ```

#### 7. `POST /api/admin/scheduler`
Manually controls the background scheduler or triggers an immediate lifecycle check. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Body (`application/json`)**:
  ```json
  {
    "action": "tick"
  }
  ```
  Or to control timer:
  ```json
  {
    "action": "start",
    "intervalMs": 15000
  }
  ```
  Or:
  ```json
  {
    "action": "stop"
  }
  ```
- **Returns**: Action execution results and updated scheduler state.

#### 8. `GET /api/admin/containers`
Queries all provisioned containers across the Docker host merged with database user details and slot requests. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Returns**: Array of container objects containing `containerId`, `containerName`, `sshHost`, `sshPort`, `sshUser`, `volumeName`, `status` (`running`/`stopped`), `slotTitle`, and `user` details (`email`, `name`).

#### 9. `POST /api/admin/containers/[id]/toggle`
Manually toggles a container's runtime state between `running` and `stopped`. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Body (`application/json`)**:
  ```json
  {
    "action": "start"
  }
  ```
  Or:
  ```json
  {
    "action": "stop"
  }
  ```
  Or omit body/action to toggle automatically.
- **Returns**: `{ "success": true, "containerId": "...", "status": "running"|"stopped" }`.

#### 10. `POST /api/admin/requests/[id]/terminate`
Force-terminates an active slot request early and immediately stops the associated host container while safely preserving the user volume. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Body (`application/json`)**:
  ```json
  {
    "reason": "Emergency maintenance or manual administrator intervention"
  }
  ```
- **Returns**: The updated `SlotRequest` document with status `completed` and administrative termination notes.

#### 11. `GET /api/admin/audit-logs`
Queries the chronological audit and security log stream. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Query Params**:
  - `action` (optional): Filter by specific event type (`REQUEST_CREATED`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `REQUEST_CANCELLED`, `SESSION_ACTIVATED`, `SESSION_COMPLETED`, `SESSION_FORCE_TERMINATED`, `CONTAINER_FORCE_STARTED`, `CONTAINER_FORCE_STOPPED`, `CONTAINER_DELETED`, `SYSTEM_SYNC_RECOVERY`).
  - `page` (optional, default `1`): Page number.
  - `limit` (optional, default `25`): Items per page.
- **Returns**: `{ "logs": [...], "total": 120, "page": 1, "totalPages": 5 }`.

#### 12. `DELETE /api/admin/containers/[id]`
Permanently removes the specified container and deletes its persistent Docker storage volume from the host machine. **Admin only.**
- **Auth Required**: Yes (Admin role)
- **Returns**: `{ "success": true, "containerDeleted": true, "volumeDeleted": true, "message": "Container and persistent volume permanently deleted." }`.

### Docker Provisioning Engine (`lib/docker.js`)

#### 8. `provisionContainer({ userId, username, password, port, containerName, volumeName, autoStart })`
Provisions an isolated Ubuntu container configured with OpenSSH daemon and mounted persistent storage volume.
- **Parameters**:
  - `userId` (required): User ID associated with the slot request.
  - `username` (optional): SSH username (auto-sanitized from email or user ID).
  - `password` (optional): Plaintext SSH password (auto-generated if omitted).
  - `port` (optional): Host TCP port to map SSH port 22 (auto-allocated from range 2222–2300 if omitted).
  - `volumeName` (optional): Name of the Docker persistent volume (defaults to `vol_access_user_<userId>`).
  - `autoStart` (optional, default `true`): Starts the container immediately upon creation.
- **Returns**:
  ```json
  {
    "containerId": "dc771e178cf5...",
    "containerName": "access_user_testpilot_k194a...",
    "volumeName": "vol_access_user_12345",
    "sshHost": "localhost",
    "sshPort": 2230,
    "sshUser": "testpilot",
    "sshPassword": "GeneratedPassword123",
    "status": "running"
  }
  ```

#### 9. `startContainer(containerId)`
Starts a stopped Docker container and waits until the OpenSSH daemon is responsive.
- **Parameters**: `containerId` (string).
- **Returns**: `{ containerId, status: "running" }`.

#### 10. `stopContainer(containerId, timeoutSeconds)`
Gracefully stops a running container. The container state and persistent volume data remain completely intact on the host.
- **Parameters**: `containerId` (string), `timeoutSeconds` (number, default `10`).
- **Returns**: `{ containerId, status: "stopped" }`.

#### 11. `deleteContainerAndVolume(containerId, volumeName)`
Permanently removes the container and deletes the persistent Docker volume.
- **Parameters**: `containerId` (string), `volumeName` (string).
- **Returns**: `{ containerDeleted: boolean, volumeDeleted: boolean }`.

#### 12. `getContainerStatus(containerId)`
Queries the live state of a container.
- **Returns**: `"running"`, `"stopped"`, or `"not_found"`.

#### 13. `findAvailablePort(minPort, maxPort)`
Scans host TCP sockets and existing Docker container bindings in the specified port range (default: `2222-2300`) to find the next unused host port.

## Common Issues
- **Database Connection Error**: Ensure Docker is running and that the port `27017` is not blocked or in use by another local MongoDB instance.
- **NextAuth Errors**: If you encounter errors signing in with Google, ensure your OAuth credentials are correct and you've added `http://localhost:3000` to your authorized origins/redirect URIs in the Google Cloud Console.


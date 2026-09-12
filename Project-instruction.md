This project is for the following workflow

- Normal User:
    1. Logs into the portal
    2. checks avaialble time slots for super computer, on a google calender type ui.
    3. submits a request with the desired time slot.
    4. requests are approved or rejected by the admin.
    5. if accepted they get ssh ip of a docker container that runs ubuntu, with a new user and password.
    6. the docker contanier should run for the duration of the time slot requested. and stop at after the time is over.
    7. the docker should be persistant till the admin deletes it

- Admin User:
    1. Logs into the portal
    2. checks pending requests.
    3. Approves or rejects the requests.
    4. Deletes docker containers they want from the portal and cleanup data

---

## Current Development Status
- [x] **Authentication**: NextAuth setup with Credentials & Google OAuth, MongoDB connection, User model (`user` & `admin` roles).
- [x] **Admin User Management**: Admin dashboard (`/admin/users`) with role management, user creation/deletion, password reset, and search.
- [x] **Base Dashboard**: User dashboard structure (`/dashboard`) with role-based redirection.
- [x] **Checkpoint 1 - Slot / Container Request Data Model & Core APIs**: SlotRequest model (`models/SlotRequest.js`), `POST /api/requests` with time validation and collision check, `GET /api/requests` (user vs admin isolation), and `GET /api/requests/slots` for calendar slot query.
- [x] **Checkpoint 2 - Calendar UI & Slot Booking Interface**: Interactive week/day/month calendar at `/dashboard/calendar`, booking modal with frontend collision validation, "My Booking Requests" list with status badges, and dashboard navigation links.
- [x] **Checkpoint 3 - Admin Request Review & Approval Workflow**: Admin Requests page at `/admin/requests` with Pending/Approved/Rejected/All tabs, request cards showing user details, duration, and purpose; Approve button and Reject modal with mandatory reason field; `PATCH /api/admin/requests/[id]` and `GET /api/admin/requests/[id]` API routes.
- [x] **Checkpoint 4 - Docker Provisioning Engine (Ubuntu + OpenSSH + Persistent Storage)**: Docker controller utility in `lib/docker.js` (using Dockerode), Ubuntu + OpenSSH base image configuration (`docker/Dockerfile`, `docker/entrypoint.sh`), persistent volume management (`vol_access_user_<userId>`), port scanning (2222-2300), and lifecycle helpers (`provisionContainer`, `startContainer`, `stopContainer`, `deleteContainerAndVolume`), with automated verification via `scripts/test-docker.js` and `scripts/test-checkpoint-4.js`.
- [x] **Checkpoint 5 - Automated Scheduler & Container Lifecycle Controller**: Automated lifecycle engine in `lib/scheduler.js`, Next.js server startup hook in `instrumentation.js`, admin scheduler control API at `/api/admin/scheduler`, standalone daemon CLI in `scripts/scheduler.js`, automatic container provisioning and SSH credential assignment at slot start, graceful container stop at slot end with volume preservation, and end-to-end verification suite `scripts/test-checkpoint-5.js`.
- [x] **Checkpoint 6 - User Active Session Portal & SSH Access Dashboard**: Active Access hero card on `/dashboard` with live countdown timer, 1-click terminal SSH command copy, password show/hide toggle & copy, persistent volume metadata, automatic completion state transition on slot end, and automated verification suite `scripts/test-checkpoint-6.js`.
- [x] **Checkpoint 7 - Admin Container Management & Data Cleanup**: Admin Containers & Storage dashboard at `/admin/containers`, live host container status integration, manual Force Stop / Force Start controls, permanent container & persistent volume deletion modal, API routes `GET /api/admin/containers`, `POST /api/admin/containers/[id]/toggle`, `DELETE /api/admin/containers/[id]`, and automated verification suite `scripts/test-checkpoint-7.js`.
- [x] **Checkpoint 8 - End-to-End Integration, Resilience & Edge Cases**: User request cancellation (`/api/requests/[id]/cancel`), Admin force termination (`/api/admin/requests/[id]/terminate`), Server restart recovery reconciliation (`syncContainerStates`), in-memory concurrency port allocation manager (`lib/docker.js`), Audit & Security logs system (`models/AuditLog.js`, `lib/audit.js`, `/admin/audit-logs`), React error boundaries (`app/error.js`, `app/global-error.js`), and end-to-end integration test suite `scripts/test-checkpoint-8.js`.

---

## Development Checkpoints & Manual Testing Flow

### Checkpoint 1: Slot / Container Request Data Model & Core APIs
- **Scope:**
  - Create Mongoose `SlotRequest` schema in `models/SlotRequest.js`:
    - `userId` (ref User), `title`/`purpose` (String)
    - `startTime` (Date), `endTime` (Date)
    - `status` (`pending`, `approved`, `rejected`, `active`, `completed`, `cancelled`)
    - `adminNotes` / `rejectionReason` (String)
    - `containerDetails`: `{ containerId, containerName, sshHost, sshPort, sshUser, sshPassword, volumeName }`
    - `createdAt`, `updatedAt`
  - Create API routes:
    - `POST /api/requests` - Submit a new slot request with time validation (start < end, future times, collision check).
    - `GET /api/requests` - List requests (filtered to current user for normal users; all requests for admins).
    - `GET /api/requests/slots` - Public/authenticated occupied slots query for calendar rendering.
- **Manual Testing Steps:**
  1. Make an authenticated POST request to `/api/requests` with valid `startTime` & `endTime` -> verify 201 Created and stored in MongoDB.
  2. Query `GET /api/requests` as a normal user -> verify only the logged-in user's requests are returned.
  3. Query `GET /api/requests` as an admin -> verify all users' requests are listed.
  4. Submit an invalid request (e.g. past date or end before start) -> verify 400 Bad Request with descriptive error.

---

### Checkpoint 2: Calendar UI & Slot Booking Interface (Normal User)
- **Scope:**
  - Build an interactive Calendar UI (Week/Month/Day view) at `/dashboard/calendar` (or embedded in `/dashboard`).
  - Fetch existing booked/occupied time slots from `/api/requests/slots` and render them visually.
  - Add interactive time slot picker (click on calendar or "Book Slot" modal) allowing users to specify date, time range, and purpose.
  - Implement frontend collision validation preventing users from selecting overlapping booked times.
  - Add a "My Booking Requests" list component showing submitted requests with status badges (`Pending`, `Approved`, `Rejected`, `Active`, `Completed`).
- **Manual Testing Steps:**
  1. Log in as a normal user and navigate to the Calendar page.
  2. Verify existing occupied slots are displayed on the calendar.
  3. Click an open time slot, fill in purpose/details, and submit the booking request.
  4. Verify the new request appears on the calendar (marked `Pending`) and in the "My Booking Requests" list.
  5. Try selecting an overlapping time slot -> verify UI blocks submission or alerts the user.

---

### Checkpoint 3: Admin Request Review & Approval Workflow
- **Scope:**
  - Build Admin Requests Management page at `/admin/requests`.
  - Display pending requests with user details (name, email), requested time slots, duration, and purpose.
  - Provide tabs/filters for `Pending`, `Approved`, `Rejected`, and `All`.
  - Implement action buttons:
    - **Approve**: Updates request status to `approved`.
    - **Reject**: Opens modal to enter rejection reason and updates status to `rejected`.
  - Create API route `PATCH /api/admin/requests/[id]` for status updates.
- **Manual Testing Steps:**
  1. Log in as an Admin and open `/admin/requests`.
  2. Verify the pending request submitted in Checkpoint 2 appears in the list.
  3. Click "Reject" on a test request with reason "Maintenance window" -> verify status updates to `Rejected` and user sees the rejection reason in their dashboard.
  4. Click "Approve" on another test request -> verify status changes to `Approved` in both admin and user views.

---

### Checkpoint 4: Docker Provisioning Engine (Ubuntu + OpenSSH + Persistent Storage)
- **Scope:**
  - Implement Docker controller utility in `lib/docker.js` (using Dockerode or Docker Engine API/CLI wrapper).
  - Create Ubuntu + OpenSSH base image or dynamic container setup:
    - Creates custom user credentials per booking/user.
    - Exposes SSH on a mapped port (e.g., port range `2222-2300`).
    - Mounts persistent Docker volume (e.g., `vol_access_user_<userId>`) to `/home/<username>`.
  - Implement helper methods:
    - `provisionContainer({ userId, username, password, port })`
    - `startContainer(containerId)`
    - `stopContainer(containerId)` (keeps container and volume intact)
    - `deleteContainerAndVolume(containerId, volumeName)`
- **Manual Testing Steps:**
  1. Run a standalone test script/route (`scripts/test-docker.js`) to spawn a test container.
  2. SSH into the container: `ssh <user>@localhost -p <port>` with the generated password.
  3. Create a test file inside the container: `echo "persistence test" > /home/<user>/test.txt`.
  4. Stop the container via `stopContainer` -> verify SSH connection closes.
  5. Start the container via `startContainer` -> SSH back in -> verify `/home/<user>/test.txt` still exists.

---

### Checkpoint 5: Automated Scheduler & Container Lifecycle Controller
- **Scope:**
  - Build background scheduler service (cron job / timer polling every 30-60 seconds).
  - **Slot Start Handler (`currentTime >= startTime` and status is `approved`):**
    - Provisions or starts the Docker container.
    - Generates and securely stores SSH connection info (host, port, username, password).
    - Transitions request status to `active`.
  - **Slot End Handler (`currentTime >= endTime` and status is `active`):**
    - Stops the Docker container (preserving container state and volume).
    - Transitions request status to `completed`.
- **Manual Testing Steps:**
  1. Create and approve a slot request scheduled to start in 1 minute and end 2 minutes later.
  2. Monitor scheduler logs -> when start time is reached, verify container starts (`docker ps`) and status updates to `active`.
  3. Wait until end time -> verify container stops (`docker ps -a`) and status updates to `completed`.

---

### Checkpoint 6: User Active Session Portal & SSH Access Dashboard
- **Scope:**
  - Build an "Active Access / Session" card on the user dashboard (`/dashboard`).
  - When a booking status is `active`:
    - Display SSH command string (e.g. `ssh username@<host-ip> -p <port>`) with a 1-click copy button.
    - Display password with show/hide toggle and copy button.
    - Show live countdown timer displaying remaining time in the active slot.
  - When the slot ends / status becomes `completed`:
    - Update UI to indicate session has concluded and container is stopped.
- **Manual Testing Steps:**
  1. Log in as a user during an active slot window.
  2. Check the user dashboard -> verify the Active Session card appears with live countdown and SSH credentials.
  3. Copy the SSH command and password -> connect via terminal to verify successful access.
  4. When the countdown reaches 0 -> verify credentials card is replaced with a "Session Completed" state.

---

### Checkpoint 7: Admin Container Management & Data Cleanup
- **Scope:**
  - Build Admin Containers & Storage dashboard at `/admin/containers`.
  - Display all provisioned containers (Running / Stopped), assigned user, allocated port, volume name, and status.
  - Provide admin action controls:
    - **Force Stop / Start**: Manually toggle container state.
    - **Delete & Cleanup Data**: Modal confirmation to remove container and permanently delete the persistent volume.
  - Create API routes: `GET /api/admin/containers`, `POST /api/admin/containers/[id]/toggle`, `DELETE /api/admin/containers/[id]`.
- **Manual Testing Steps:**
  1. Log in as Admin and open `/admin/containers`.
  2. Verify all active and stopped user containers are listed.
  3. Test manual "Force Stop" and "Force Start" on a container -> check `docker ps`.
  4. Click "Delete & Cleanup Data" on a stopped container -> confirm dialog.
  5. Verify both container and its Docker volume are completely deleted from the host system (`docker ps -a` and `docker volume ls`).

---

### Checkpoint 8: End-to-End Integration, Resilience & Edge Cases
- **Scope:**
  - Handle edge cases and resilience:
    - User cancellation of pending requests.
    - Admin force termination of an active session.
    - Server restart recovery (re-syncing running containers with database statuses).
    - Port allocation manager to prevent port collisions.
  - Add toast notifications, error boundaries, and audit logs.
- **Manual Testing Steps:**
  1. Complete full user flow: User Register -> Book Slot -> Admin Approve -> Scheduler Activates -> User SSH & save data -> Scheduler Stops -> Admin Deletes container & data.
  2. Test user cancelling a pending request -> verify status updates to `cancelled`.
  3. Test admin force terminating an active slot -> verify container stops immediately.
# ==============================================================================
# Access Portal — Next.js Application Dockerfile
# ==============================================================================
# Multi-stage build for a lean, production-ready Next.js image.
# next.config.mjs must have  output: 'standalone'  (already set).
# ==============================================================================

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
# Install only production node_modules so the final image stays small.
FROM node:20-alpine AS deps
WORKDIR /app

# Copy lockfile + manifests first to leverage Docker layer cache.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: builder ──────────────────────────────────────────────────────────
# Full build including devDependencies (needed for Next.js compilation).
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Copy the full source tree
COPY . .

# Build the Next.js standalone bundle.
# Environment variables needed at build time can be passed here with --build-arg.
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
# Minimal runtime image — only the standalone output + static files.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry in production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid  1001 nextjs

# Copy the standalone server bundle produced by `next build`
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy statically-generated assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy the public directory (images, icons, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

# Next.js listens on 3000 by default inside the container.
# The actual host port is mapped in docker-compose.yml.
EXPOSE 3000

# PORT env var is read by the Next.js standalone server.js
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

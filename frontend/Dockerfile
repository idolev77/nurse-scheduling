# ══════════════════════════════════════════════════════════════════════════════
# Stage 1 — BUILD
# Use Node 20 (LTS) on Alpine Linux to build the React/Vite application.
# Alpine is ~5 MB vs ~200 MB for the standard Node image.
# This entire stage is discarded after the build; only the compiled /dist
# folder is carried forward, so the final image has zero Node.js footprint.
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests first (layer-cache optimisation).
# "npm ci" re-runs only when package.json or package-lock.json changes.
COPY package.json ./

# Install all dependencies (including devDependencies needed for the build).
# Using "npm install" because no package-lock.json exists yet.
RUN npm install

# Copy the rest of the source files.
COPY . .

# Build the production bundle into /app/dist.
# Vite generates hashed filenames for long-term browser caching.
RUN npm run build

# ══════════════════════════════════════════════════════════════════════════════
# Stage 2 — SERVE
# Copy only the compiled static files into a minimal Nginx Alpine image (~8 MB).
# Nginx will:
#   1. Serve the React SPA (with fallback to index.html for client-side routing).
#   2. Reverse-proxy every /api/* request to the backend container.
# ══════════════════════════════════════════════════════════════════════════════
FROM nginx:1.27-alpine AS production

# Remove the default Nginx placeholder site config.
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx config (handles SPA routing + API proxy).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled React app from the builder stage.
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (standard HTTP inside the container).
EXPOSE 80

# Start Nginx in the foreground so Docker can manage the process.
CMD ["nginx", "-g", "daemon off;"]

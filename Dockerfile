# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:renderer
RUN npm run build:server

# ── Stage 2: Production ──
FROM node:20-alpine
WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Create non-root user
RUN addgroup -S lifeos && adduser -S lifeos -G lifeos

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    apk del python3 make g++

# Create data directory with correct ownership
RUN mkdir -p /home/lifeos/.mirror-history && chown -R lifeos:lifeos /home/lifeos/.mirror-history

# Data volume
VOLUME /home/lifeos/.mirror-history

EXPOSE 31072

ENV MIRROR_HISTORY_PORT=31072
ENV MIRROR_HISTORY_HOST=0.0.0.0
ENV HOME=/home/lifeos

# Run as non-root user
USER lifeos

CMD ["node", "dist-server/standalone.js"]

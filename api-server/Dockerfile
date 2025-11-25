# Build stage
FROM node:20-alpine AS builder

WORKDIR /monorepo

# Copy root package files for workspace resolution
COPY package*.json ./

# Copy workspace package files
COPY api-server/package*.json ./api-server/
COPY web-client/package*.json ./web-client/

# Install all dependencies (both workspaces)
RUN npm ci

# Copy api-server source code
COPY api-server/tsconfig*.json ./api-server/
COPY api-server/src ./api-server/src
COPY api-server/prisma ./api-server/prisma
COPY api-server/scripts ./api-server/scripts

# Build the API server
WORKDIR /monorepo/api-server
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /monorepo

# Copy root package files
COPY package*.json ./

# Copy workspace package files
COPY api-server/package*.json ./api-server/
COPY web-client/package*.json ./web-client/

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application and required files from builder stage
COPY --from=builder /monorepo/api-server/dist ./api-server/dist
COPY --from=builder /monorepo/api-server/prisma ./api-server/prisma
COPY --from=builder /monorepo/api-server/scripts ./api-server/scripts

WORKDIR /monorepo/api-server

# Expose the application port
EXPOSE 4000

# Start the application
CMD ["node", "dist/server.js"]

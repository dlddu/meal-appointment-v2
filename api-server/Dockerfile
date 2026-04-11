# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache build-base python3

# Copy all package files to leverage workspace
COPY package*.json ./
COPY api-server/package*.json ./api-server/
COPY web-client/package*.json ./web-client/
COPY api-server/prisma ./api-server/prisma/

# Install all workspace dependencies from root
RUN npm ci

# Copy api-server source code
COPY api-server/src ./api-server/src
COPY api-server/tsconfig*.json ./api-server/

# Build the api-server
RUN npm run build --workspace=api-server

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache build-base python3

# Copy root package files
COPY package*.json ./
COPY api-server/package*.json ./api-server/
COPY api-server/prisma ./api-server/prisma/

# Install production dependencies
# Note: npm workspaces require all workspace package.json files to be present for dependency resolution
COPY web-client/package*.json ./web-client/
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/api-server/dist ./api-server/dist

# Copy migration scripts (run at container startup via tsx)
COPY api-server/scripts ./api-server/scripts

# Create data directory for SQLite
RUN mkdir -p /app/api-server/data
VOLUME /app/api-server/data

# Expose port
EXPOSE 4000

# Start the api-server
WORKDIR /app/api-server
CMD ["npm", "start"]

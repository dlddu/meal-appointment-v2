# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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

# Expose port
EXPOSE 4000

# Start the api-server
WORKDIR /app/api-server
CMD ["npm", "start"]

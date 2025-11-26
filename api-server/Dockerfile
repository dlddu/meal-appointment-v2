# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package files to leverage workspace
COPY package*.json ./
COPY api-server/package*.json ./api-server/
COPY web-client/package*.json ./web-client/
COPY api-server/prisma ./api-server/prisma/

# Install all workspace dependencies from root
RUN npm install

# Copy api-server source code
COPY api-server/src ./api-server/src
COPY api-server/tsconfig*.json ./api-server/

# Build the api-server
RUN npm run build --workspace=api-server

# Production stage
FROM node:20-alpine AS production

# Install bash for entrypoint script
RUN apk add --no-cache bash

WORKDIR /app

ENV NODE_ENV=production
# Configure OpenSSL for Prisma (Alpine uses OpenSSL 3.x)
ENV OPENSSL_LIB_DIR=/usr/lib
ENV OPENSSL_INCLUDE_DIR=/usr/include

# Copy root package files
COPY package*.json ./
COPY api-server/package*.json ./api-server/
COPY api-server/prisma ./api-server/prisma/

# Install production dependencies
# Note: npm workspaces require all workspace package.json files to be present for dependency resolution
COPY web-client/package*.json ./web-client/
RUN npm install --omit=dev

# Install prisma CLI for migrations (needed at runtime)
RUN npm install --workspace=api-server prisma@5.14.0

# Copy built files from builder
COPY --from=builder /app/api-server/dist ./api-server/dist

# Copy docker entrypoint script
COPY api-server/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 4000

# Start the api-server
WORKDIR /app/api-server
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]

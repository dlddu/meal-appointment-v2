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
COPY api-server/scripts ./api-server/scripts

# Build the api-server
RUN npm run build --workspace=api-server

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy root package files
COPY package*.json ./
COPY api-server/package*.json ./api-server/
COPY api-server/prisma ./api-server/prisma/

# Install production dependencies (workspace requires web-client package.json)
COPY web-client/package*.json ./web-client/
RUN npm install --omit=dev

# Copy built files and scripts from builder
COPY --from=builder /app/api-server/dist ./api-server/dist
COPY --from=builder /app/api-server/scripts ./api-server/scripts

# Expose port
EXPOSE 4000

# Start the api-server
WORKDIR /app/api-server
CMD ["npm", "start"]

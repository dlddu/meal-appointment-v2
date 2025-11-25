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

# Copy web-client source code
COPY web-client/tsconfig*.json ./web-client/
COPY web-client/index.html ./web-client/
COPY web-client/vite.config.ts ./web-client/
COPY web-client/postcss.config.cjs ./web-client/
COPY web-client/tailwind.config.ts ./web-client/
COPY web-client/src ./web-client/src

# Build the web client
WORKDIR /monorepo/web-client
RUN npm run build

# Production stage (serving with nginx)
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /monorepo/web-client/dist /usr/share/nginx/html

# Copy nginx configuration
COPY web-client/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

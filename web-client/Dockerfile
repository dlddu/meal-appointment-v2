# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package files to leverage workspace
COPY package*.json ./
COPY api-server/package*.json ./api-server/
COPY web-client/package*.json ./web-client/

# Install all workspace dependencies from root
RUN npm install

# Copy web-client source code
COPY web-client/src ./web-client/src
COPY web-client/index.html ./web-client/
COPY web-client/tsconfig*.json ./web-client/
COPY web-client/vite.config.ts ./web-client/
COPY web-client/postcss.config.cjs ./web-client/
COPY web-client/tailwind.config.ts ./web-client/

# Set API base URL for production build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the web-client
RUN npm run build --workspace=web-client

# Production stage
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/web-client/dist /usr/share/nginx/html

# Copy nginx configuration
COPY web-client/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

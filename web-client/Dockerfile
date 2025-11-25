# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY index.html ./
COPY vite.config.ts ./
COPY postcss.config.cjs ./
COPY tailwind.config.ts ./
COPY src ./src

# Build the application
RUN npm run build

# Production stage (serving with nginx)
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

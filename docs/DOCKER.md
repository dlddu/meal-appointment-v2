# Docker Build Guide

This document describes how to build and run the Meal Appointment application using Docker.

## Web Client

The web client is built as a static React application served by nginx.

### Building the Image

#### Default Build (localhost API)

By default, the web client is configured to connect to `http://localhost:4000/api`:

```bash
docker build -f web-client/Dockerfile -t meal-appointment-web .
```

#### Production Build (Custom API URL)

For production deployments, pass the API server URL as a build argument:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=http://your-api-server.com/api \
  -f web-client/Dockerfile \
  -t meal-appointment-web .
```

### Running the Container

```bash
docker run -p 8080:80 meal-appointment-web
```

The web application will be available at http://localhost:8080

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | API server base URL (build-time) | `http://localhost:4000/api` |

**Important:** The API URL is baked into the JavaScript bundle at build time. You must rebuild the image with the correct `VITE_API_BASE_URL` for each deployment environment.

### GitHub Actions CI/CD

The `.github/workflows/build-images.yml` workflow automatically builds the web-client image and pushes it to GitHub Container Registry (ghcr.io) when changes are merged to main/develop branches or when tagged.

The workflow uses the `VITE_API_BASE_URL` GitHub Actions secret if configured, otherwise defaults to `/api` (relative path) for production builds. To configure:

1. Go to repository Settings > Secrets and variables > Actions
2. Add a new repository secret named `VITE_API_BASE_URL`
3. Set the value to your production API URL (e.g., `https://api.example.com/api`)

If no secret is set, the workflow defaults to `/api`, which works for deployments where the API and web client are served from the same domain.

## Examples

### Development

```bash
# Build for local development
docker build -f web-client/Dockerfile -t meal-appointment-web:dev .
docker run -p 5173:80 meal-appointment-web:dev
```

### Staging

```bash
# Build for staging environment
docker build \
  --build-arg VITE_API_BASE_URL=https://api-staging.example.com/api \
  -f web-client/Dockerfile \
  -t meal-appointment-web:staging .
docker run -p 80:80 meal-appointment-web:staging
```

### Production

```bash
# Build for production environment
docker build \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api \
  -f web-client/Dockerfile \
  -t meal-appointment-web:latest .
docker run -p 80:80 meal-appointment-web:latest
```

## Testing

To verify the Dockerfile configuration, run:

```bash
./web-client/tests/docker-build.test.sh
```

This test verifies that:
1. The Dockerfile has an ARG for VITE_API_BASE_URL
2. The ARG is properly used in an ENV variable
3. The ARG has a sensible default value
4. The ARG and ENV are in the correct order

## Troubleshooting

### Issue: Application connects to localhost instead of production API

**Cause:** The Docker image was built without specifying the `VITE_API_BASE_URL` build argument.

**Solution:** Rebuild the image with the correct API URL:
```bash
docker build --build-arg VITE_API_BASE_URL=https://your-api.com/api -f web-client/Dockerfile .
```

### Issue: Cannot change API URL after build

**Cause:** The API URL is embedded in the JavaScript bundle at build time (Vite static optimization).

**Solution:** This is by design for performance. You must build separate images for each environment, or use a runtime configuration approach if needed.
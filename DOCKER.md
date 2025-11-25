# Container Images

This repository includes Docker configurations and GitHub Actions workflows to build container images for both the API server and web client.

## Images

The workflow builds and publishes two container images to GitHub Container Registry (ghcr.io):

- **API Server**: `ghcr.io/dlddu/meal-appointment-v2/api-server`
- **Web Client**: `ghcr.io/dlddu/meal-appointment-v2/web-client`

## Building Locally

### API Server

```bash
cd api-server
docker build -t meal-appointment-api:latest .
```

### Web Client

```bash
cd web-client
docker build -t meal-appointment-web:latest .
```

## Running Locally

### API Server

The API server requires a PostgreSQL database. You can run it with:

```bash
docker run -d \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://meal_user:meal_pass@host.docker.internal:5432/meal_appointment" \
  -e PORT=4000 \
  meal-appointment-api:latest
```

### Web Client

The web client is served by nginx:

```bash
docker run -d \
  -p 8080:80 \
  meal-appointment-web:latest
```

## GitHub Actions Workflow

The workflow (`.github/workflows/build-images.yml`) automatically builds and pushes images when:

- Code is pushed to `main` or `develop` branches
- A pull request is opened targeting `main` or `develop`
- A tag matching `v*` is created (e.g., `v1.0.0`)
- Manually triggered via workflow_dispatch

### Image Tags

Images are tagged based on the event type:

- Branch pushes: `branch-name` (e.g., `main`, `develop`)
- Pull requests: `pr-<number>` (e.g., `pr-59`)
- Git tags: Semantic version tags (e.g., `v1.0.0`, `1.0`, `1`)
- Commit SHA: `sha-<short-hash>` (e.g., `sha-abc1234`)

### Permissions

The workflow requires the following permissions:
- `contents: read` - To checkout the repository
- `packages: write` - To push images to GitHub Container Registry

## Multi-stage Builds

Both Dockerfiles use multi-stage builds to optimize image size:

1. **Build stage**: Installs all dependencies and builds the application
2. **Production stage**: Contains only production dependencies and built artifacts

This approach significantly reduces the final image size and improves security by excluding development dependencies.

## Configuration Files

- `api-server/Dockerfile` - API server container definition
- `api-server/.dockerignore` - Files excluded from API server image
- `web-client/Dockerfile` - Web client container definition
- `web-client/.dockerignore` - Files excluded from web client image
- `web-client/nginx.conf` - Nginx configuration for serving the SPA
- `.github/workflows/build-images.yml` - GitHub Actions workflow

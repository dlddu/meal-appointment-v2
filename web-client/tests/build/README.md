# Build Tests

This directory contains tests that verify the build output of the web-client.

## API URL Configuration Test

### Purpose
The `api-url.test.ts` test verifies that the API URL is correctly configured in the bundled JavaScript files.

### Problem It Solves
Previously, the web-client build was hardcoding `localhost:4000` as the API URL, even when built in Docker for production deployments. This caused the production builds to fail because they couldn't connect to the API server.

### How It Works
1. The test reads the built JavaScript files from the `dist/assets` directory
2. It searches for the API URL pattern in the bundle
3. It verifies that the API URL is not using localhost/127.0.0.1 (for production builds)
4. It confirms the API URL matches the expected value (e.g., `/api` for relative path)

**Note:** This test is automatically skipped if the `dist` directory doesn't exist. This allows unit tests to run in CI without requiring a build first.

### Running the Test
```bash
# Build with the correct API URL first
VITE_API_BASE_URL=/api npm run build

# Then run the test
npm run test:unit -- tests/build/api-url.test.ts

# Or run all unit tests (the build test will be skipped if dist doesn't exist)
npm run test:unit
```

### Expected Behavior
- **When dist doesn't exist**: Test suite is skipped (no failure)
- **When built without VITE_API_BASE_URL**: Test fails (detects localhost usage)
- **When built with `VITE_API_BASE_URL=/api`**: Test passes (uses relative path `/api`)
- **When built with custom URL**: Test passes (uses the provided URL)

### Docker Build
The Dockerfile has been updated to accept a build argument:
```dockerfile
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
```

This allows the API URL to be configured at build time:
```bash
docker build --build-arg VITE_API_BASE_URL=/api -f web-client/Dockerfile .
```

### CI/CD Integration
The GitHub Actions workflow has been updated to pass the build argument:
```yaml
build-args: |
  VITE_API_BASE_URL=/api
```

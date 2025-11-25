#!/bin/bash
# Test script to verify that web-client Dockerfile has proper VITE_API_BASE_URL configuration
# Implemented for spec: agent/specs/meal-appointment-architecture-spec.md

set -e

echo "=== Testing web-client Dockerfile configuration ==="

# Store current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKERFILE="$PROJECT_ROOT/web-client/Dockerfile"

# Test 1: Verify Dockerfile has ARG declaration for VITE_API_BASE_URL
echo ""
echo "Test 1: Checking for ARG VITE_API_BASE_URL in Dockerfile"
if grep -q "ARG VITE_API_BASE_URL" "$DOCKERFILE"; then
    echo "✓ Test 1 PASS: Dockerfile contains ARG VITE_API_BASE_URL"
else
    echo "✗ Test 1 FAIL: Dockerfile does not contain ARG VITE_API_BASE_URL"
    exit 1
fi

# Test 2: Verify Dockerfile has ENV that uses the ARG
echo ""
echo "Test 2: Checking for ENV VITE_API_BASE_URL in Dockerfile"
if grep -q "ENV VITE_API_BASE_URL" "$DOCKERFILE"; then
    echo "✓ Test 2 PASS: Dockerfile contains ENV VITE_API_BASE_URL"
else
    echo "✗ Test 2 FAIL: Dockerfile does not contain ENV VITE_API_BASE_URL"
    exit 1
fi

# Test 3: Verify ARG has a default value (for backward compatibility)
echo ""
echo "Test 3: Checking for default value in ARG VITE_API_BASE_URL"
if grep "ARG VITE_API_BASE_URL" "$DOCKERFILE" | grep -q "="; then
    DEFAULT_VALUE=$(grep "ARG VITE_API_BASE_URL" "$DOCKERFILE" | cut -d'=' -f2)
    echo "✓ Test 3 PASS: ARG has default value: $DEFAULT_VALUE"
else
    echo "✗ Test 3 FAIL: ARG VITE_API_BASE_URL has no default value"
    exit 1
fi

# Test 4: Verify the ARG comes before the ENV that uses it
echo ""
echo "Test 4: Checking that ARG comes before ENV in Dockerfile"
ARG_LINE=$(grep -n "ARG VITE_API_BASE_URL" "$DOCKERFILE" | cut -d':' -f1)
ENV_LINE=$(grep -n "ENV VITE_API_BASE_URL" "$DOCKERFILE" | cut -d':' -f1)

if [ "$ARG_LINE" -lt "$ENV_LINE" ]; then
    echo "✓ Test 4 PASS: ARG (line $ARG_LINE) comes before ENV (line $ENV_LINE)"
else
    echo "✗ Test 4 FAIL: ARG (line $ARG_LINE) should come before ENV (line $ENV_LINE)"
    exit 1
fi

# Test 5: Verify ENV uses the ARG value
echo ""
echo "Test 5: Checking that ENV references the ARG value"
if grep "ENV VITE_API_BASE_URL" "$DOCKERFILE" | grep -q '\${VITE_API_BASE_URL}'; then
    echo "✓ Test 5 PASS: ENV correctly references \${VITE_API_BASE_URL}"
else
    echo "✗ Test 5 FAIL: ENV does not reference \${VITE_API_BASE_URL}"
    exit 1
fi

echo ""
echo "=== All Dockerfile configuration tests PASSED ==="
echo ""
echo "Note: To build with a custom API URL, use:"
echo "  docker build --build-arg VITE_API_BASE_URL=http://your-api-server/api -f web-client/Dockerfile ."


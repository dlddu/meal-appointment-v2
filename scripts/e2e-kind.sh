#!/usr/bin/env bash
# Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md
#
# Provisions a kind cluster, builds and loads the api-server and web-client
# container images, applies the Kubernetes manifests under e2e/, and waits
# until the deployment is reachable on the host. Designed to be invoked from
# scripts/run-tests.sh and from the GitHub Actions E2E job.
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

CLUSTER_NAME="${CLUSTER_NAME:-meal-appointment-e2e}"
NAMESPACE="${NAMESPACE:-meal-appointment-e2e}"
API_IMAGE="${API_IMAGE:-meal-appointment-api:e2e}"
WEB_IMAGE="${WEB_IMAGE:-meal-appointment-web:e2e}"
KIND_CONFIG="${KIND_CONFIG:-$ROOT_DIR/e2e/kind-config.yaml}"
MANIFEST_DIR="${MANIFEST_DIR:-$ROOT_DIR/e2e}"
HOST_API_PORT="${HOST_API_PORT:-4002}"
HOST_WEB_PORT="${HOST_WEB_PORT:-5173}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300}"
HOST_PROBE_TIMEOUT="${HOST_PROBE_TIMEOUT:-120}"
WEB_BUILD_API_BASE_URL="${WEB_BUILD_API_BASE_URL:-http://127.0.0.1:${HOST_API_PORT}/api}"

log() {
  echo "[e2e-kind] $*"
}

require_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[e2e-kind] Required tool not found: $tool" >&2
    exit 1
  fi
}

ensure_tools() {
  require_tool docker
  require_tool kind
  require_tool kubectl
}

cluster_exists() {
  kind get clusters 2>/dev/null | grep -Fxq "$CLUSTER_NAME"
}

create_cluster() {
  if cluster_exists; then
    log "Reusing existing kind cluster '$CLUSTER_NAME'"
    return
  fi
  log "Creating kind cluster '$CLUSTER_NAME'"
  kind create cluster --name "$CLUSTER_NAME" --config "$KIND_CONFIG" --wait 120s
}

delete_cluster() {
  if cluster_exists; then
    log "Deleting kind cluster '$CLUSTER_NAME'"
    kind delete cluster --name "$CLUSTER_NAME"
  else
    log "Cluster '$CLUSTER_NAME' is not present; nothing to delete"
  fi
}

build_images() {
  log "Building API server image: $API_IMAGE"
  docker build \
    -f "$ROOT_DIR/api-server/Dockerfile" \
    -t "$API_IMAGE" \
    "$ROOT_DIR"

  log "Building web client image: $WEB_IMAGE (VITE_API_BASE_URL=$WEB_BUILD_API_BASE_URL)"
  docker build \
    -f "$ROOT_DIR/web-client/Dockerfile" \
    --build-arg "VITE_API_BASE_URL=$WEB_BUILD_API_BASE_URL" \
    -t "$WEB_IMAGE" \
    "$ROOT_DIR"
}

load_images() {
  log "Loading images into kind cluster '$CLUSTER_NAME'"
  kind load docker-image "$API_IMAGE" --name "$CLUSTER_NAME"
  kind load docker-image "$WEB_IMAGE" --name "$CLUSTER_NAME"
}

apply_manifests() {
  log "Applying kustomize overlay in $MANIFEST_DIR"
  kubectl apply -k "$MANIFEST_DIR"

  # Force a rollout so newly loaded images are picked up when reusing a cluster.
  kubectl -n "$NAMESPACE" rollout restart deployment/meal-appointment-e2e >/dev/null
  log "Waiting up to ${WAIT_TIMEOUT}s for deployment rollout"
  kubectl -n "$NAMESPACE" rollout status deployment/meal-appointment-e2e --timeout="${WAIT_TIMEOUT}s"
}

wait_for_host_endpoints() {
  log "Waiting up to ${HOST_PROBE_TIMEOUT}s for host ports ${HOST_WEB_PORT} (web) and ${HOST_API_PORT} (api)"
  local deadline=$(( $(date +%s) + HOST_PROBE_TIMEOUT ))
  local web_ready=0
  local api_ready=0

  while [[ $(date +%s) -lt $deadline ]]; do
    if [[ $web_ready -eq 0 ]] && curl -fsS --max-time 2 "http://127.0.0.1:${HOST_WEB_PORT}/" >/dev/null 2>&1; then
      log "Web endpoint is reachable on http://127.0.0.1:${HOST_WEB_PORT}"
      web_ready=1
    fi
    if [[ $api_ready -eq 0 ]] && curl -fsS --max-time 2 "http://127.0.0.1:${HOST_API_PORT}/api/health" >/dev/null 2>&1; then
      log "API endpoint is reachable on http://127.0.0.1:${HOST_API_PORT}"
      api_ready=1
    fi
    if [[ $web_ready -eq 1 && $api_ready -eq 1 ]]; then
      return 0
    fi
    sleep 2
  done

  echo "[e2e-kind] Timed out waiting for host endpoints" >&2
  kubectl -n "$NAMESPACE" get pods -o wide >&2 || true
  kubectl -n "$NAMESPACE" describe deployment meal-appointment-e2e >&2 || true
  exit 1
}

cmd_up() {
  ensure_tools
  build_images
  create_cluster
  load_images
  apply_manifests
  wait_for_host_endpoints
  log "Cluster is ready: web=http://127.0.0.1:${HOST_WEB_PORT}, api=http://127.0.0.1:${HOST_API_PORT}/api"
}

cmd_down() {
  ensure_tools
  delete_cluster
}

cmd_logs() {
  kubectl -n "$NAMESPACE" logs deployment/meal-appointment-e2e --all-containers --tail=200 "$@"
}

usage() {
  cat <<USAGE
Usage: $0 [up|down|logs]

Commands:
  up    Build images, create the kind cluster, deploy and wait for readiness.
  down  Delete the kind cluster.
  logs  Tail the deployment logs (extra args forwarded to kubectl logs).
USAGE
}

cmd="${1:-up}"
case "$cmd" in
  up)
    cmd_up
    ;;
  down)
    cmd_down
    ;;
  logs)
    shift || true
    cmd_logs "$@"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

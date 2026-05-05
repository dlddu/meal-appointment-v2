#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

function ensure_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    return
  fi

  local env_dir
  env_dir="$(dirname "$env_file")"
  local candidates=("${env_file}.example" "${env_dir}/.env.example")
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "[run-tests] Creating $(basename "$env_file") from template $(basename "$candidate")"
      cp "$candidate" "$env_file"
      return
    fi
  done

  echo "[run-tests] Missing environment file: $env_file" >&2
  exit 1
}

function usage() {
  cat <<USAGE
Usage: $0 [web-unit|api-unit|api-integration|e2e|all]

Commands:
  web-unit         Run web-client unit tests with Vitest.
  api-unit         Run api-server Go unit tests (go test ./...).
  api-integration  Migrate the SQLite test database and run Go integration tests.
  e2e              Provision a kind cluster and run Playwright end-to-end tests against it.
  all              Run all of the above in sequence.

Environment:
  KEEP_CLUSTER=1   Skip the kind teardown step after the e2e suite finishes.
USAGE
}

function load_env_file() {
  local env_file="$1"
  ensure_env_file "$env_file"
  # shellcheck source=/dev/null
  set -a
  source "$env_file"
  set +a
}

function ensure_db_connection() {
  local env_file="$1"
  load_env_file "$env_file"
  local db_url="${DATABASE_URL:-}"
  if [[ -z "$db_url" ]]; then
    echo "[run-tests] DATABASE_URL is not defined in $env_file" >&2
    exit 1
  fi

  # Strip file: prefix if present
  local db_path="${db_url#file:}"
  local db_dir
  db_dir="$(dirname "$db_path")"
  mkdir -p "$db_dir"
  echo "[run-tests] SQLite database path: $db_path"
}

function run_web_unit() {
  (
    cd "$ROOT_DIR/web-client"
    VITE_API_BASE_URL=/api npm run build
    npm run test:unit
  )
}

function run_api_unit() {
  (cd "$ROOT_DIR/api-server" && go test ./...)
}

function run_api_integration() {
  ensure_db_connection "$ROOT_DIR/api-server/.env.test"
  (
    cd "$ROOT_DIR/api-server"
    ENV_FILE="$ROOT_DIR/api-server/.env.test" go run ./cmd/migrate
    ENV_FILE="$ROOT_DIR/api-server/.env.test" go test -tags=integration ./...
  )
}

function run_e2e() {
  "$ROOT_DIR/scripts/e2e-kind.sh" up

  local exit_code=0
  (
    cd "$ROOT_DIR/web-client"
    E2E_USE_KIND=1 npm run test:e2e
  ) || exit_code=$?

  if [[ "${KEEP_CLUSTER:-0}" == "1" ]]; then
    echo "[run-tests] KEEP_CLUSTER=1 set; leaving kind cluster running"
  else
    "$ROOT_DIR/scripts/e2e-kind.sh" down || true
  fi

  return $exit_code
}

cmd="${1:-all}"
case "$cmd" in
  web-unit)
    run_web_unit
    ;;
  api-unit)
    run_api_unit
    ;;
  api-integration)
    run_api_integration
    ;;
  e2e)
    run_e2e
    ;;
  all)
    run_web_unit
    run_api_unit
    run_api_integration
    run_e2e
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

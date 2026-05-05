#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
API_DIR="$ROOT_DIR/api-server"

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
  api-unit         Run api-server Go unit tests.
  api-integration  Run api-server Go integration tests against the SQLite test database.
  e2e              Run end-to-end tests (API + Web) using Playwright.
  all              Run all of the above in sequence.
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
  (cd "$API_DIR" && go test ./...)
}

function run_api_integration() {
  ensure_db_connection "$API_DIR/.env.test"
  (
    cd "$API_DIR"
    ENV_FILE=.env.test go run ./cmd/migrate
    ENV_FILE=.env.test go test ./...
  )
}

function run_e2e() {
  ensure_db_connection "$API_DIR/.env.e2e"
  (
    cd "$API_DIR"
    ENV_FILE=.env.e2e go run ./cmd/migrate
    ENV_FILE=.env.e2e go run ./cmd/seed
  )
  (
    cd "$ROOT_DIR/web-client"
    npm run test:e2e
  )
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

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PSQL=${PSQL:-psql}

function usage() {
  cat <<USAGE
Usage: $0 [web-unit|api-unit|api-integration|e2e|all]

Commands:
  web-unit         Run web-client unit tests with Vitest.
  api-unit         Run api-server unit tests with Jest.
  api-integration  Run api-server integration tests against the PostgreSQL test database.
  e2e              Run end-to-end tests (API + Web) using Playwright.
  all              Run all of the above in sequence.
USAGE
}

function load_env_file() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    echo "[run-tests] Missing environment file: $env_file" >&2
    exit 1
  fi
  # shellcheck source=/dev/null
  set -a
  source "$env_file"
  set +a
}

function extract_db_host() {
  local db_url="$1"
  if [[ "$db_url" != *://* ]]; then
    echo ""
    return
  fi

  local stripped="${db_url#*://}"
  local hostport="${stripped#*@}"
  if [[ "$hostport" == "$stripped" ]]; then
    hostport="$stripped"
  fi
  local host="${hostport%%[:/?]*}"
  echo "$host"
}

function attempt_start_postgres_service() {
  local db_url="$1"
  local host
  host="$(extract_db_host "$db_url")"

  case "$host" in
    ""|"localhost"|"127.0.0.1"|"::1")
      ;;
    *)
      # Remote database – do not attempt to start a local service.
      return 1
      ;;
  esac

  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -d "$db_url" >/dev/null 2>&1; then
      return 0
    fi
  fi

  if command -v service >/dev/null 2>&1; then
    echo "[run-tests] Attempting to start PostgreSQL via 'service postgresql start'"
    if service postgresql start; then
      if command -v pg_isready >/dev/null 2>&1; then
        for attempt in {1..5}; do
          if pg_isready -d "$db_url" >/dev/null 2>&1; then
            return 0
          fi
          sleep 1
        done
        return 1
      fi
      return 0
    fi
  fi

  return 1
}

function ensure_db_connection() {
  local env_file="$1"
  load_env_file "$env_file"
  local db_url="${DATABASE_URL:-}"
  if [[ -z "$db_url" ]]; then
    echo "[run-tests] DATABASE_URL is not defined in $env_file" >&2
    exit 1
  fi
  echo "[run-tests] Verifying database connectivity for ${db_url}"
  if ! PGCONNECT_TIMEOUT=5 "$PSQL" "$db_url" -c 'SELECT 1;' >/dev/null; then
    echo "[run-tests] Initial connection failed. Checking PostgreSQL service status..."
    if attempt_start_postgres_service "$db_url"; then
      PGCONNECT_TIMEOUT=5 "$PSQL" "$db_url" -c 'SELECT 1;' >/dev/null || {
        echo "[run-tests] Unable to connect to PostgreSQL after starting the service." >&2
        exit 1
      }
    else
      echo "[run-tests] PostgreSQL service could not be started automatically. Please start it manually." >&2
      exit 1
    fi
  fi
}

function run_web_unit() {
  (cd "$ROOT_DIR/web-client" && npm run test:unit)
}

function run_api_unit() {
  (cd "$ROOT_DIR/api-server" && npm run test:unit)
}

function run_api_integration() {
  ensure_db_connection "$ROOT_DIR/api-server/.env.test"
  (
    cd "$ROOT_DIR/api-server"
    npm run db:migrate:test
    npm run test:integration
  )
}

function run_e2e() {
  ensure_db_connection "$ROOT_DIR/api-server/.env.e2e"
  (
    cd "$ROOT_DIR/api-server"
    npm run db:migrate:e2e
    npm run db:seed:e2e
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

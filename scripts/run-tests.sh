#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PSQL=${PSQL:-psql}

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
  api-unit         Run api-server unit tests with Jest.
  api-integration  Run api-server integration tests against the PostgreSQL test database.
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

function bootstrap_local_postgres_database() {
  # Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md
  local db_url="$1"
  local host
  host="$(extract_db_host "$db_url")"

  case "$host" in
    ""|"localhost"|"127.0.0.1"|"::1")
      ;;
    *)
      return
      ;;
  esac

  if ! command -v sudo >/dev/null 2>&1; then
    return
  fi

  if ! id postgres >/dev/null 2>&1; then
    return
  fi

  local without_proto
  without_proto="${db_url#*://}"
  local credentials=""
  local remainder="$without_proto"
  if [[ "$without_proto" == *"@"* ]]; then
    credentials="${without_proto%%@*}"
    remainder="${without_proto#*@}"
  fi

  local username=""
  local password=""
  if [[ -n "$credentials" ]]; then
    username="${credentials%%:*}"
    if [[ "$username" != "$credentials" ]]; then
      password="${credentials#*:}"
    fi
  fi

  local path_component
  path_component="${remainder#*/}"
  if [[ "$path_component" == "$remainder" ]]; then
    return
  fi
  local database_name
  database_name="${path_component%%\?*}"
  if [[ -z "$database_name" ]]; then
    return
  fi

  if [[ -n "$username" ]]; then
    if ! sudo -u postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname='${username}'" | grep -q 1; then
      local password_clause=""
      if [[ -n "$password" ]]; then
        local escaped_password
        escaped_password=$(printf "%s" "$password" | sed "s/'/''/g")
        password_clause=" PASSWORD '${escaped_password}'"
      fi
      echo "[run-tests] Creating PostgreSQL role ${username}"
      sudo -u postgres psql -v ON_ERROR_STOP=1 -X -c "CREATE ROLE ${username} WITH LOGIN${password_clause};" >/dev/null
    fi
  fi

  if ! sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${database_name}'" | grep -q 1; then
    if [[ -n "$username" ]]; then
      echo "[run-tests] Creating PostgreSQL database ${database_name} owned by ${username}"
      sudo -u postgres createdb -O "$username" "$database_name"
    else
      echo "[run-tests] Creating PostgreSQL database ${database_name}"
      sudo -u postgres createdb "$database_name"
    fi
  fi

  if [[ -n "$username" ]]; then
    echo "[run-tests] Granting privileges on ${database_name} to ${username}"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -X -c "GRANT ALL PRIVILEGES ON DATABASE \"${database_name}\" TO \"${username}\";" >/dev/null
  fi
}

function ensure_db_connection() {
  local env_file="$1"
  load_env_file "$env_file"
  local db_url="${DATABASE_URL:-}"
  if [[ -z "$db_url" ]]; then
    echo "[run-tests] DATABASE_URL is not defined in $env_file" >&2
    exit 1
  fi
  attempt_start_postgres_service "$db_url" || true
  bootstrap_local_postgres_database "$db_url"
  echo "[run-tests] Verifying database connectivity for ${db_url}"
  if ! PGCONNECT_TIMEOUT=5 "$PSQL" "$db_url" -c 'SELECT 1;' >/dev/null; then
    echo "[run-tests] Initial connection failed. Checking PostgreSQL service status..."
    if attempt_start_postgres_service "$db_url"; then
      bootstrap_local_postgres_database "$db_url"
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

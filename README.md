# Meal Appointment Coordinator

A monorepo that bootstraps the architecture for a meal appointment coordination tool. It contains a React web client, a Go API server, and SQL migrations that target a local SQLite database.

## Repository layout

| Path | Description |
| --- | --- |
| `api-server/` | Go service with layered architecture (presentation, application, domain, infrastructure). |
| `web-client/` | Vite + React SPA that surfaces connectivity to the API server and demo UI components. |
| `scripts/run-tests.sh` | Orchestrator that executes every test suite described in the local testing specification. |
| `agent/specs/` | Design documents that define the domain, architecture, and test processes. |

## Prerequisites

* Go 1.24+
* Node.js 20+ (for the web client)
* npm 9+ (for the web client)
* Playwright browser binaries (installed automatically on demand)

No external database service is required. The project uses SQLite via a pure-Go driver (`modernc.org/sqlite`); database files are created automatically on first run.

## Installation

```bash
npm install                      # web-client dependencies
(cd api-server && go mod download)
```

## Environment variables

Copy the provided templates to customise credentials or ports:

```bash
cp api-server/.env.example api-server/.env.local
cp api-server/.env.test.example api-server/.env.test
cp api-server/.env.e2e.example api-server/.env.e2e
cp web-client/.env.example web-client/.env.test
cp web-client/.env.e2e web-client/.env.e2e
```

Adjust the `DATABASE_URL`, `PORT`, and `VITE_API_BASE_URL` values when necessary.

## Local development

Apply migrations and start the API server (default port `4000`):

```bash
cd api-server
go run ./cmd/migrate            # initialise the SQLite database
go run ./cmd/server             # start the HTTP server
```

Launch the Vite development server (default port `5173`):

```bash
cd web-client
npm run dev
```

## Test orchestration

The `scripts/run-tests.sh` helper implements the end-to-end workflow from the local testing spec. It ensures the SQLite database directory exists before running a suite.

```bash
./scripts/run-tests.sh all            # Run every suite sequentially
./scripts/run-tests.sh web-unit       # Web client TypeScript build + Vitest suite
./scripts/run-tests.sh api-unit       # API server Go unit tests (go test ./...)
./scripts/run-tests.sh api-integration# API server Go integration tests (real DB)
./scripts/run-tests.sh e2e            # Playwright end-to-end checks
```

The E2E step exercises the health endpoint and the rendered shell via Playwright's API testing mode, ensuring the running servers respond correctly without depending on extra browser downloads.
The `web-unit` command first compiles the web client with `npm run build` so TypeScript regressions are surfaced alongside the Vitest suite.

## Architecture highlights

* **Frontend (`web-client/`)** – React 18 SPA built with Vite and React Query for server-state caching. Includes a demo `AvailabilityMatrix` component and Playwright coverage for the connectivity status flow.
* **Backend (`api-server/`)** – Go 1.24 service using `chi` for HTTP routing and a layered package layout (`presentation`, `application`, `domain`, `infrastructure`). SQLite is accessed through `database/sql` with raw SQL queries and the pure-Go `modernc.org/sqlite` driver.
* **Database** – SQLite schema mirrors the architecture specification: `appointments`, `time_slot_templates`, `participants`, and `slot_availability` tables stored under `api-server/migrations/`.

## Troubleshooting

* **Database file errors** – Ensure the `data/` directory exists under `api-server/` and has write permissions. The migration command and application create the directory automatically.
* **Playwright dependency warnings** – If you plan to exercise full browser automation and the CLI prompts for binaries, run `npx playwright install chromium` once network access is available.
* **Port collisions** – Update the `PORT` in API `.env` files and `VITE_API_BASE_URL` in the web client env files to match custom ports.

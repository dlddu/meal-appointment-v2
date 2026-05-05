# Meal Appointment Coordinator

A monorepo that bootstraps the architecture for a meal appointment coordination tool. It contains a React web client, an Express-based API server, and SQL migrations that target a local SQLite database.

## Repository layout

| Path | Description |
| --- | --- |
| `api-server/` | TypeScript Express service with layered architecture (presentation, application, domain, infrastructure). |
| `web-client/` | Vite + React SPA that surfaces connectivity to the API server and demo UI components. |
| `scripts/run-tests.sh` | Orchestrator that executes every test suite described in the local testing specification. |
| `agent/specs/` | Design documents that define the domain, architecture, and test processes. |

## Prerequisites

* Node.js 20+
* npm 9+
* Playwright browser binaries (installed automatically on demand)
* For the E2E suite: Docker, [`kind`](https://kind.sigs.k8s.io/) ≥ 0.24, and `kubectl` ≥ 1.30. Host ports `5173` and `4002` must be available — they are mapped into the kind cluster.

No external database service is required for unit/integration tests. The project uses SQLite via `better-sqlite3`, and database files are created automatically on first run. The E2E suite runs the same SQLite-backed images on a kind cluster.

## Installation

```bash
npm install
```

This installs all workspace dependencies. The API server uses SQLite for persistence with raw SQL queries. The schema is defined in `prisma/schema.prisma` and applied via a migration script.

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

Start the API server (default port `4000`):

```bash
cd api-server
npm run dev
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
./scripts/run-tests.sh api-unit       # API server Jest unit tests
./scripts/run-tests.sh api-integration# API server integration tests (real DB)
./scripts/run-tests.sh e2e            # Build container images, deploy on kind, and run Playwright
```

Behind the scenes the script applies SQL migrations, reseeds the database when needed, and launches Playwright. The `web-unit` command first compiles the web client with `npm run build` so TypeScript regressions are surfaced alongside the Vitest suite.

The `e2e` command delegates to `scripts/e2e-kind.sh`, which builds the `meal-appointment-api:e2e` and `meal-appointment-web:e2e` images, loads them into a single-node kind cluster (`meal-appointment-e2e`), applies the manifests under `e2e/`, and waits for the host-side endpoints (`http://127.0.0.1:5173` for the SPA and `http://127.0.0.1:4002/api` for the API) before invoking Playwright. The cluster is deleted after the suite finishes; set `KEEP_CLUSTER=1` to keep it for debugging and tear it down later via `scripts/e2e-kind.sh down`.

## Architecture highlights

* **Frontend (`web-client/`)** – React 18 SPA built with Vite and React Query for server-state caching. Includes a demo `AvailabilityMatrix` component and Playwright coverage for the connectivity status flow.
* **Backend (`api-server/`)** – Express 4 server with layered folders (`presentation`, `application`, `domain`, `infrastructure`). Uses SQLite via `better-sqlite3` with raw SQL queries for direct database access.
* **Database** – SQLite schema mirrors the architecture specification: `Appointment`, `TimeSlotTemplate`, `Participant`, and `SlotAvailability` tables stored under `prisma/migrations/`.

## Troubleshooting

* **Database file errors** – Ensure the `data/` directory exists under `api-server/` and has write permissions. The migration script and application create the directory automatically.
* **Playwright dependency warnings** – If you plan to exercise full browser automation and the CLI prompts for binaries, run `npx playwright install chromium` once network access is available.
* **Port collisions** – Update the `PORT` in API `.env` files and `VITE_API_BASE_URL` in the web client env files to match custom ports.

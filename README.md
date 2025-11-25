# Meal Appointment Coordinator

A monorepo that bootstraps the architecture for a meal appointment coordination tool. It contains a React web client, an Express-based API server, and SQL migrations that target a local PostgreSQL instance.

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
* PostgreSQL 15 running locally (the project expects the default port 5432)
* Playwright browser binaries (installed automatically on demand)

Create the required PostgreSQL role and databases if they do not exist:

```bash
sudo -u postgres psql -c "CREATE ROLE meal_user WITH LOGIN PASSWORD 'meal_pass';"
sudo -u postgres createdb meal_appointment
sudo -u postgres createdb meal_appointment_test
sudo -u postgres createdb meal_appointment_e2e
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE meal_appointment TO meal_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE meal_appointment_test TO meal_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE meal_appointment_e2e TO meal_user;"
```

Start the PostgreSQL service before running tests. On Ubuntu-based systems this can be done with:

```bash
sudo service postgresql start
```

## Installation

```bash
npm install
```

This installs all workspace dependencies. The API server relies on direct PostgreSQL queries during bootstrap; Prisma schema files are included for future parity and to keep the spec-aligned data model under version control.

## Environment variables

Copy the provided templates to customise credentials or ports:

```bash
cp api-server/.env.example api-server/.env.local
cp api-server/.env.test api-server/.env.test
cp api-server/.env.e2e api-server/.env.e2e
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

The `scripts/run-tests.sh` helper implements the end-to-end workflow from the local testing spec. It validates that the PostgreSQL URL in each environment file is reachable before running a suite.

```bash
./scripts/run-tests.sh all            # Run every suite sequentially
./scripts/run-tests.sh web-unit       # Web client TypeScript build + Vitest suite
./scripts/run-tests.sh api-unit       # API server Jest unit tests
./scripts/run-tests.sh api-integration# API server integration tests (real DB)
./scripts/run-tests.sh e2e            # Playwright end-to-end checks
```

Behind the scenes the script applies SQL migrations with the provided PostgreSQL user, reseeds the database when needed, and launches Playwright. The E2E step exercises the health endpoint and the rendered shell via Playwright's API testing mode, ensuring the running servers respond correctly without depending on extra browser downloads.
The `web-unit` command first compiles the web client with `npm run build` so TypeScript regressions are surfaced alongside the Vitest suite.

## Architecture highlights

* **Frontend (`web-client/`)** – React 18 SPA built with Vite and React Query for server-state caching. Includes a demo `AvailabilityMatrix` component and Playwright coverage for the connectivity status flow.
* **Backend (`api-server/`)** – Express 4 server with layered folders (`presentation`, `application`, `domain`, `infrastructure`). Uses the PostgreSQL driver directly with helper scripts that replay the Prisma-authored SQL schema.
* **Database** – PostgreSQL schema mirrors the architecture specification: `Appointment`, `TimeSlotTemplate`, `Participant`, and `SlotAvailability` tables stored under `prisma/migrations/`.

## Troubleshooting

* **Database connection errors** – Ensure the PostgreSQL service is running and that the `meal_user` role has permissions for every test database. The `scripts/run-tests.sh` helper prints the failing URL before exiting.
* **Playwright dependency warnings** – If you plan to exercise full browser automation and the CLI prompts for binaries, run `npx playwright install chromium` once network access is available.
* **Port collisions** – Update the `PORT` in API `.env` files and `VITE_API_BASE_URL` in the web client env files to match custom ports.

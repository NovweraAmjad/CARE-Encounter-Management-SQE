# Repository Selection

## Management information system

This assignment uses the paired CARE repositories as one browser-based management information system:

- **Backend repository:** https://github.com/ohcnetwork/care
- **Frontend repository:** https://github.com/ohcnetwork/care_fe

The frontend README describes CARE as a web frontend for an open-source EMR and hospital management system and links to the backend repository. The backend README describes the Django backend for managing patients, health workers and hospitals. This pairing provides a browser UI, an HTTP JSON API and persistent database-backed state.

## Selected baseline

| Item | Baseline |
|---|---|
| Backend upstream | https://github.com/ohcnetwork/care |
| Backend commit | `ddfd840dbe314b4e53d2a719d2138324d970634b` |
| Backend licence | **MIT License** (`care/LICENSE`, "Copyright (c) 2026 Open Healthcare Network Foundation") |
| Frontend upstream | https://github.com/ohcnetwork/care_fe |
| Frontend commit | `5e02f9aa4f690e08375da310511e14606985f788` |
| Frontend licence | **MIT License** (`care_fe/LICENSE`, "Copyright (c) 2024 Open Healthcare Network") |
| Baseline date | 26 November 2026 |

Both commit hashes were verified with `git rev-parse HEAD` in the checked-out repositories. Both working trees were checked with `git status --porcelain`. The backend worktree was clean. The frontend worktree has a pre-existing or externally present modification in `care_fe/src/routeTree.gen.ts`; no application source or database file was modified for this documentation task.

These two commits identify the exact source versions used for this assignment baseline. They provide a reproducible reference point for future source changes, test additions and test results. This documentation task does not create commits or switch branches.

## Prerequisites

- Git.
- Docker Engine and Docker Compose for the backend, PostgreSQL and Redis services.
- Node.js `24.x` and npm for the frontend, as required by `care_fe/package.json`.
- Bash is required by the Playwright database helper scripts and the backend Make targets that use shell commands.
- PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`, `dropdb`, `createdb`) are needed only for the frontend database snapshot/reset helpers.

No application dependency or database reset was performed while preparing this document.

## Clone and check out the baseline

Clone the paired repositories beside each other:

```bash
git clone https://github.com/ohcnetwork/care.git
git clone https://github.com/ohcnetwork/care_fe.git
```

To inspect the same baseline version recorded for this assignment, check out each commit in detached HEAD state:

```bash
cd care
git checkout --detach ddfd840dbe314b4e53d2a719d2138324d970634b

cd ../care_fe
git checkout --detach 5e02f9aa4f690e08375da310511e14606985f788
```

No branches or commits are created by this procedure.

## Start the backend

From the `care/` repository:

```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml up -d --build --wait
```

This is the startup command used for this project and is supported by `docker-compose.yaml` and `docker-compose.local.yaml`. The backend Docker service exposes the API on port `9000`; PostgreSQL is mapped to host port `5433`, Redis to host port `6380`, and MinIO to host port `9100` according to `docker-compose.yaml`.

Check container status if needed:

```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml ps
```

## Load synthetic fixture data

After the backend containers are ready, load the default synthetic fixture set from the `care/` repository:

```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml exec backend python manage.py load_fixtures
```

The Makefile also documents `make load-fixtures`, but the command above is the explicit Docker command confirmed from the project files. Fixtures create synthetic organizations, departments, users, patients and encounters. The fixture documentation is at `care/care/fixtures/fixtures.md`, and the default seed implementation begins in `care/care/fixtures/scripts/default_fixtures.py`.

## Start the frontend against the local backend

Create `care_fe/.env.local` with:

```env
REACT_CARE_API_URL=http://127.0.0.1:9000
```

Then, from `care_fe/`:

```bash
npm install
npm run local
```

The frontend development URL is `http://localhost:4000/`. `npm run local` uses the Docker/Vite mode and the frontend README identifies this as the local-backend startup mode. The exact command `npm run dev` is also documented upstream, but `npm run local` is the command recorded for this project context.

## Fixture accounts

The repository README and default fixture script document these synthetic local accounts. Use local test data only.

| Role | Username | Password |
|---|---|---|
| Doctor | `care-doctor` | `Ohcn@123` |
| Staff | `care-staff` | `Ohcn@123` |
| Nurse | `care-nurse` | `Ohcn@123` |
| Administrator | `care-admin` | `Ohcn@123` |
| Volunteer | `care-volunteer` | `Ohcn@123` |
| Facility Admin | `care-fac-admin` | `Ohcn@123` |

The source fixture script sets `Ohcn@123` for the default accounts. Authentication uses the `/api/v1/auth/login/` endpoint and JWT storage for the browser.

## Resetting test data between runs

The repository provides a snapshot/restore workflow for repeatable Playwright runs:

```bash
cd care_fe
npm run playwright:db-status
npm run playwright:db-snapshot
npm run playwright:db-restore
```

The snapshot and restore commands use `care_fe/scripts/playwright-db.sh`. The helper reads `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST` and `POSTGRES_PORT`, with defaults of `care`, `postgres`, `postgres`, `127.0.0.1` and `5432`. Because Docker Compose maps PostgreSQL to host port `5433`, set the host variables when running the helper against this Docker setup:

```bash
export POSTGRES_HOST=127.0.0.1
export POSTGRES_PORT=5433
export POSTGRES_DB=care
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
```

On PowerShell, set them instead as:

```powershell
$env:POSTGRES_HOST="127.0.0.1"
$env:POSTGRES_PORT="5433"
$env:POSTGRES_DB="care"
$env:POSTGRES_USER="postgres"
$env:POSTGRES_PASSWORD="postgres"
```

These variables allow `pg_dump` and `pg_restore` to reach the Docker database. PostgreSQL client tools must be installed on the host. The snapshot location defaults to `/tmp/care_playwright_snapshot.dump`.

For a fresh Playwright database, the repository also provides `npm run playwright:db-reset`. This helper is explicitly destructive: it drops and recreates the database, runs migrations, loads fixtures, and creates a fresh snapshot. It also requires `CARE_BACKEND_DIR` to point to a checkout containing `manage.py` and `.venv/bin/python` for migrations and fixtures. This command could not be manually verified in this source-only documentation pass, so it should be treated as requiring a manual environment check before use.

The backend Makefile also contains `make reset-db` and `make reset-and-setup`. `reset-db` drops and recreates the Care PostgreSQL database, and `reset-and-setup` then runs migrations and loads fixtures. These repository-provided procedures affect existing database data and should not be run in a shared or production environment.

## Licence

Both repositories declare the MIT License:

- Backend: `care/LICENSE`
- Frontend: `care_fe/LICENSE`

The frontend and backend licence files grant use, modification and redistribution subject to the MIT copyright and permission notice.

## Evidence for a paired web-based MIS

### Browser UI

- The frontend is a React/TypeScript application using TanStack Router and Vite. This is stated by `care_fe/package.json` and implemented by files under `care_fe/src/routes/`.
- Encounter management is routed through `care_fe/src/routes/_app/facility.$facilityId.encounters.tsx` and `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx`.
- Patient encounter creation is implemented in `care_fe/src/components/Encounter/CreateEncounterForm.tsx`.
- Encounter completion is implemented in `care_fe/src/pages/Encounters/MarkEncounterAsCompletedDialog.tsx` and `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts`.

### HTTP API

- The backend registers the Encounter ViewSet with `router.register("encounter", EncounterViewSet, basename="encounter")` in `care/config/api_router.py`.
- The encounter API is therefore available under `/api/v1/encounter/` through the Django REST Framework router.
- The frontend definition in `care_fe/src/types/emr/encounter/encounterApi.ts` uses `/api/v1/encounter/` for list/create and `/api/v1/encounter/{id}/` for retrieve/update.
- Authentication endpoints are declared in `care/config/urls.py`, including `/api/v1/auth/login/`, `/api/v1/auth/token/refresh/` and `/api/v1/auth/token/verify/`.

### Persistent storage

- The backend defines the persistent `Encounter` Django model in `care/care/emr/models/encounter.py`.
- The model persists status, encounter class, patient, facility, period, hospitalization, priority, appointment, location, care team, tags and status history.
- Django migrations for Encounter are under `care/care/emr/migrations/`.
- The Docker configuration identifies PostgreSQL for the application database and Redis as a cache/service dependency.

## Module selection

Encounter Management was selected because the frontend and backend implement a complete shared record: the encounter routes in React call the `/api/v1/encounter/` API, and that API reads and writes the Django `Encounter` model. The project tests two workflows: creating a patient encounter and completing an existing encounter.
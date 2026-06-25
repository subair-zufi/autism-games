# Autism Games — Analytics Server

A FastAPI + PostgreSQL backend that records player analytics for the Autism Games app
and ships with a built-in admin dashboard.

## What it does

- **Player auth (email + password, JWT).** Sign-up *is* login — a successful sign-up
  returns a token immediately, no separate login step required.
  - New email → account created and signed in.
  - Existing email **with the same password** → treated as a login (idempotent), so a
    user who is already registered and "signs up" again is simply logged back in.
  - Existing email **with a different password** → `409 Conflict`.
- **Step-by-step analytics, only when logged in.** Every game step is stored as a
  `GameEvent` row (flexible `JSONB` payload). All event endpoints require a valid player
  token, so anonymous play records nothing.
- **Admin dashboard.** A separate admin login powers a web dashboard at `/admin` to manage
  players (search / enable / disable / delete) and view analytics (totals, activity over
  time, per-game breakdown).

## Quick start (Docker Compose)

```bash
cd server
cp .env.example .env          # then edit SECRET_KEY / ADMIN_PASSWORD
docker compose up --build
```

- API:        http://localhost:8000
- API docs:   http://localhost:8000/docs
- Dashboard:  http://localhost:8000/admin

On first start the database tables are created automatically and the seed admin from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` is created.

## Run without Docker

You need a PostgreSQL database reachable via `DATABASE_URL`.

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/autism_games"
export SECRET_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
export ADMIN_EMAIL="admin@autism-games.com" ADMIN_PASSWORD="change-me"
python -m app.seed          # create tables + seed admin (also runs on startup)
uvicorn app.main:app --reload
```

## Configuration

All settings come from environment variables (or a `.env` file). See `.env.example`.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy Postgres URL | `postgresql+psycopg2://postgres:postgres@localhost:5432/autism_games` |
| `SECRET_KEY` | JWT signing key — **set this in production** | insecure placeholder |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Player token lifetime | `10080` (7 days) |
| `ADMIN_TOKEN_EXPIRE_MINUTES` | Admin token lifetime | `480` (8 hours) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed admin created on first start | `admin@autism-games.com` / `admin123` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | localhost dev ports |

## API overview

### Player auth — `/api/auth`
| Method | Path | Notes |
|---|---|---|
| `POST` | `/signup` | Email, password + address & education fields. Returns a token (signs in). Idempotent for same email+password. |
| `POST` | `/login` | Explicit email + password login. |
| `GET`  | `/me` | Current player (requires player token). |

Sign-up body fields: `email`, `password`, `full_name`, `address_line1`, `address_line2`,
`city`, `state`, `postal_code`, `country`, `education_level`, `institution`,
`field_of_study`.

### Analytics — `/api` (all require a **player** token)
| Method | Path | Notes |
|---|---|---|
| `POST` | `/sessions` | Start a play session (optional grouping). |
| `POST` | `/sessions/{id}/end` | End a session, set `final_score`. |
| `POST` | `/events` | Record one step. |
| `POST` | `/events/batch` | Record many steps at once. |

Event body: `game_key`, `event_type`, `step_index?`, `score?`, `session_id?`,
`payload?` (free-form JSON), `client_timestamp?`.

### Admin — `/api/admin` (require an **admin** token; player tokens are rejected)
| Method | Path | Notes |
|---|---|---|
| `POST` | `/login` | Admin email + password. |
| `GET` | `/me` | Current admin. |
| `GET` | `/users` | List/search players (`q`, `limit`, `offset`). |
| `GET` | `/users/{id}` | Player detail. |
| `PATCH` | `/users/{id}` | Update (e.g. `is_active`). |
| `DELETE` | `/users/{id}` | Delete player + their analytics. |
| `GET` | `/users/{id}/events` | A player's events. |
| `GET` | `/events` | Events feed (filter by `game_key`, `event_type`). |
| `GET` | `/analytics/summary` | Totals. |
| `GET` | `/analytics/games` | Per-game event/player/avg-score breakdown. |
| `GET` | `/analytics/timeseries?days=30` | Daily events + active players. |

## Wiring up the game frontend

The game is the React/Vite app in the repo root. Analytics are recorded **only for
logged-in players**. A ready-to-use TypeScript client lives at
[`docs/frontend-analytics-client.ts`](./docs/frontend-analytics-client.ts) — copy it into
`src/services/` and use it like:

```ts
import { analytics } from "./services/analytics";

// Optional sign-up (also logs in) on a form submit:
await analytics.signup({ email, password, full_name, city, education_level /* … */ });

// Later, anywhere a step happens — no-ops silently if the player isn't logged in:
analytics.recordStep("balldrop", "drop", { lane: 2, hit: true });
```

Point it at the server with `VITE_ANALYTICS_API` (e.g. `http://localhost:8000`).

## Tests

```bash
cd server
source .venv/bin/activate
pip install pytest httpx
export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/autism_games"
pytest
```

The suite covers sign-up/login idempotency, auth enforcement, the full event flow, admin
analytics and user management. It **skips automatically** if no database is reachable.

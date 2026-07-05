# Deploying the analytics server to Railway

The server lives in the **`server/`** subfolder of this repo. Railway deploys it
straight from GitHub using the `Dockerfile` and `railway.json` in that folder.

## One-time setup

### 1. Push your code to GitHub
Make sure the latest `server/` (including `Dockerfile` and `railway.json`) is on
your GitHub repo's default branch.

### 2. Create the Railway project from GitHub
1. Go to <https://railway.app> → **New Project** → **Deploy from GitHub repo**.
2. Authorize Railway for your GitHub account and pick this repository.
3. Railway creates a service. Open it → **Settings**.

### 3. Point the service at the `server/` subfolder
Because the server is not at the repo root, you must tell Railway where it lives:

- **Settings → Source → Root Directory** → set to `server`.

Railway will now find `server/Dockerfile` + `server/railway.json` and build with Docker.
(The build is the FastAPI image; the start command and `/health` healthcheck come
from `railway.json`.)

### 4. Add a PostgreSQL database
1. In the project canvas → **New** → **Database → Add PostgreSQL**.
2. Railway provisions Postgres and exposes connection variables to the project.

### 5. Set the service's environment variables
Open the **API service → Variables** and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `SECRET_KEY` | a long random string — generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ADMIN_EMAIL` | your admin login email |
| `ADMIN_PASSWORD` | a strong admin password |
| `CORS_ORIGINS` | the URL where the **game** is hosted, e.g. `https://<you>.github.io` (comma-separated for multiple) |

Notes:
- `${{Postgres.DATABASE_URL}}` resolves to `postgresql://…`. SQLAlchemy uses the
  `psycopg2` driver for that automatically (it's in `requirements.txt`), so no
  `+psycopg2` suffix is needed.
- `ACCESS_TOKEN_EXPIRE_MINUTES` / `ADMIN_TOKEN_EXPIRE_MINUTES` are optional (sensible
  defaults exist).
- Schema is applied automatically on every deploy — see below. `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` must be present because the pre-deploy step also seeds the admin.

### 6. Deploy & get the public URL
1. Railway auto-deploys on each push to the connected branch.
2. **Settings → Networking → Generate Domain** to get a public HTTPS URL, e.g.
   `https://otist-analytics.up.railway.app`.

## Verify the deployment
- `https://<your-domain>/health` → `{"status":"ok"}`
- `https://<your-domain>/docs` → interactive API docs
- `https://<your-domain>/admin` → admin dashboard (log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

## Wire the game to it
In the game frontend, set the Vite env var to your Railway URL at build time:

```
VITE_ANALYTICS_API=https://<your-domain>
```

…and make sure that exact game origin is listed in the server's `CORS_ORIGINS`.

## Redeploys
Every push to the connected GitHub branch triggers a new build & deploy. You can also
hit **Deploy** manually from the Railway dashboard.

## Automatic schema migrations
`railway.json` sets a **`preDeployCommand`** of `python -m app.seed`. Railway runs it
against the live database **once, before** each new version starts taking traffic:

1. You `git push` → Railway builds the image.
2. Pre-deploy runs `app.seed.init_db()` → `create_all` (adds any new tables/columns on a
   fresh DB) + an idempotent Postgres backfill that `ALTER`s already-existing tables
   (e.g. adding the nullable `student_id` column + FK/index to `game_events` /
   `game_sessions`) + seeds the admin. All steps use `IF NOT EXISTS`, so re-running is a
   no-op.
3. Only if that succeeds does the new version go live; a failed migration fails the deploy
   and leaves the previous version running.

The app also runs `init_db()` again in its startup lifespan as a safety net, so a brand-new
database is still initialised even without the pre-deploy step. No manual migration commands
are ever needed — just push.

> This project intentionally has no Alembic. It relies on `create_all` + the small
> idempotent backfill in `app/seed.py`. If you later need destructive or data-moving
> migrations (renames, type changes, backfilling values), introduce Alembic and point the
> `preDeployCommand` at `alembic upgrade head` instead.

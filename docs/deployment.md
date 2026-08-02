# Deployment

## Local Production-Like Run

Build and start the stack:

```bash
cp .env.example .env
# edit .env and replace all placeholder secrets/passwords
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Services:

- `postgres`: PostgreSQL 16
- `redis`: Redis 7
- `backend`: NestJS API on internal port `4000`
- `dashboard`: Nginx serving the Vite dashboard and proxying `/api`

## Database Migration

Generate the Prisma client:

```bash
corepack pnpm db:generate
```

Create/apply migrations in development:

```bash
corepack pnpm db:migrate
```

For production, use Prisma migration deploy after migration files exist:

```bash
corepack pnpm --filter @family-monitor/backend prisma migrate deploy --schema ../../prisma/schema.prisma
```

Seed demo data only in local/demo environments:

```bash
corepack pnpm --filter @family-monitor/backend prisma:seed
```

## Environment Variables

Backend:

```text
DATABASE_URL=postgresql://family:strong-password@postgres:5432/family_monitor?schema=public
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
JWT_REFRESH_SECRET=replace-with-another-32-random-characters
WEB_ORIGIN=https://your-dashboard-domain.example
NODE_ENV=production
PORT=4000
```

The backend refuses to start in `NODE_ENV=production` if JWT secrets are missing, still set to placeholder values, or shorter than 32 characters.

## Mobile API URL

Before building a release APK, set the public backend URL in:

```text
apps/mobile/src/config.ts
```

For local USB debugging, `http://localhost:4000/api/v1` works only when `adb reverse tcp:4000 tcp:4000` is active.

## Nginx

The dashboard image serves static assets from `/usr/share/nginx/html`.

Routes:

- `/` serves the dashboard SPA.
- `/api/*` proxies to `backend:4000`.
- `/health` proxies to backend health.

## CI/CD

Recommended pipeline:

```text
Checkout -> pnpm install -> Prisma generate -> lint -> test -> build -> Docker build -> deploy
```

Do not run seed scripts in production.

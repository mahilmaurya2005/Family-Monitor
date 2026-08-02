# Family Monitoring Platform

Consent-based family device monitoring platform with:

- Android companion app for permitted device activity sync
- NestJS backend API
- PostgreSQL database with Prisma
- React/Vite admin dashboard
- Docker Compose for local infrastructure

## Structure

```text
apps/
  backend/     NestJS API
  dashboard/   React admin panel
  mobile/      React Native companion app
packages/
  api-client/  Shared API client
  types/       Shared TypeScript contracts
  utils/       Shared formatting/helpers
prisma/        Database schema
docker/        Runtime container config
docs/          Product and engineering docs
```

## Local Setup

Install dependencies:

```bash
corepack pnpm install
```

Start PostgreSQL and Redis for local development:

```bash
docker compose up postgres redis
```

Create backend env:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Generate Prisma client and run migrations:

```bash
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm --filter @family-monitor/backend prisma:seed
```

Run backend:

```bash
corepack pnpm --filter @family-monitor/backend dev
```

Run dashboard:

```bash
corepack pnpm --filter @family-monitor/dashboard dev
```

Run the production-like Docker stack:

```bash
cp .env.example .env
# edit .env and replace all production secrets/passwords
docker compose up --build
```

Dashboard entrypoint:

```text
http://localhost:8080
```

## Safety Model

The companion app must disclose every collected data type and request Android permissions explicitly. Sensitive sources such as call logs and notifications are optional and should remain disabled unless the device user grants permission in-app and in Android settings.

## Demo Credentials

The seed script creates:

```text
Email: admin@example.com
Password: ChangeMe123!
```

Use the dashboard login page to fetch live devices and daily reports after the backend is running.

## Production Notes

- Replace every value in `.env` that starts with `replace-with-`.
- Use committed Prisma migrations with `prisma migrate deploy`; do not use `db push` in production.
- Update `apps/mobile/src/config.ts` to your public API URL before building a release APK.
- Do not seed demo users or sample data in production.

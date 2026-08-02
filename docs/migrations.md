# Database Migrations

Current schema source:

```text
prisma/schema.prisma
```

## Development

After editing the schema:

```bash
corepack pnpm db:generate
corepack pnpm db:migrate
```

This creates migration files under:

```text
prisma/migrations/
```

## Production

Production should use committed migration files:

```bash
corepack pnpm --filter @family-monitor/backend prisma migrate deploy --schema ../../prisma/schema.prisma
```

## Notes

- Do not use `prisma db push` in production.
- Do not run seed scripts in production.
- Review migration SQL before deploying changes to sensitive tables such as users, sessions, permissions, logs, and audit logs.

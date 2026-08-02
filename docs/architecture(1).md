# architecture.md

# Family Monitoring Platform - Architecture

> **Purpose**
A consent-based family device monitoring platform where an Android companion app collects device activity (only with user permission) and synchronizes it to a backend. The owner views reports from a secure web dashboard.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + TypeScript |
| Android Native | Kotlin Native Modules |
| Dashboard | React + Vite + TypeScript + Tailwind CSS |
| Backend | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache | Redis |
| Queue | BullMQ |
| Auth | JWT + Refresh Token |
| Deployment | Docker + Nginx + Ubuntu |

## Monorepo Structure

```text
family-monitor/
│
├── apps/
│   ├── mobile/
│   │   ├── src/
│   │   ├── android/
│   │   ├── ios/
│   │   ├── assets/
│   │   └── package.json
│   │
│   ├── dashboard/
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   │
│   └── backend/
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── devices/
│       │   ├── app-usage/
│       │   ├── call-logs/
│       │   ├── notifications/
│       │   ├── locations/
│       │   ├── battery/
│       │   ├── reports/
│       │   └── common/
│       └── package.json
│
├── packages/
│   ├── api-client/
│   ├── types/
│   ├── utils/
│   ├── config/
│   └── ui/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docker/
├── docs/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Data Flow

1. User installs Android companion app.
2. User grants permissions.
3. Native modules collect permitted data.
4. Local storage buffers records.
5. Background worker syncs securely to backend.
6. Backend validates and stores data.
7. Dashboard renders analytics and reports.

## Backend Modules

- Authentication
- User Management
- Device Management
- App Usage
- Call Logs
- Notification Logs
- Location History
- Battery Status
- Reports
- Audit Logs

## Database (high level)

- users
- devices
- device_sessions
- app_usage_logs
- call_logs
- notification_logs
- location_logs
- battery_logs
- installed_apps
- reports
- audit_logs

## Security

- HTTPS only
- JWT authentication
- Refresh tokens
- Device registration
- Encrypted transport
- Role-based authorization
- Audit logging

## Notes

This platform is intended only for consent-based monitoring. Do not design features intended to bypass operating-system protections or end-to-end encryption.

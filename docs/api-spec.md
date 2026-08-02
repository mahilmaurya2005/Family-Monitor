# API Specification

## Base URL
`/api/v1`

### Auth
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout

### Devices
- POST /devices/register
- GET /devices
- GET /devices/:id

### Logs
- POST /sync/app-usage
- POST /sync/location
- POST /sync/call-logs
- POST /sync/notifications
- POST /sync/battery

### Reports
- GET /reports/daily
- GET /reports/weekly
- GET /reports/monthly

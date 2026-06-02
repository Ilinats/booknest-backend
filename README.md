# BookNest Backend

REST API for **BookNest** — a platform where authors distribute review copies to readers and collect structured feedback. Built with [NestJS](https://nestjs.com), PostgreSQL, and TypeORM.

Readers apply for books, track reading progress, and submit reviews. Authors manage listings, applications, copy distribution, and analytics.

## Tech stack

| Layer | Technology |
|--------|------------|
| Runtime | Node.js 22 |
| Framework | NestJS 11 |
| Database | PostgreSQL 16 |
| Cache / sessions | Redis 7 (refresh token store) |
| ORM | TypeORM (migrations only — `synchronize: false`) |
| Auth | JWT access + refresh tokens (Redis), Argon2 passwords |
| Files | AWS S3 (uploads & downloads) |
| Email | Nodemailer (SMTP / Gmail) |
| Push | Firebase Admin (optional) |
| API docs | Swagger at `/api/docs` |
| Scheduling | `@nestjs/schedule` (book lifecycle cron) |

## Features (by module)

- **Auth** — register, login, refresh, logout / logout-all, email verification, password reset
- **Users / profiles / addresses** — reader & author profiles, shipping addresses
- **Books & series** — CRUD, browse filters, digital/physical distribution, file upload
- **Applications** — apply, approve/reject, bulk actions, first-come auto-approve, manual lottery draw
- **Reviews** — post-review workflow tied to approved applications
- **Friends** — requests, accept/decline, friend list & search
- **Author follow** — follow authors, feed-style discovery helpers
- **Files** — S3 presigned URLs; PDF/EPUB downloads with per-reader fingerprint watermark
- **Notifications** — in-app + Firebase push (when configured)
- **Reports** — user/content reporting
- **Analytics** — author book stats & dashboards (read-only; does not silently repair copy counts)

## Prerequisites

- Node.js **22** and npm **11**
- PostgreSQL **16** (local or Docker)
- Redis **7** (local or Docker — required for refresh tokens)
- AWS S3 bucket (for book files & images) — optional for limited local dev
- SMTP or Gmail app password (for verification emails) — optional in dev

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Create `.env` in the project root (and optionally `.env.local`). Minimum for local API + Postgres:

```env
# Server
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=booknest
POSTGRES_PASSWORD=booknest_password
POSTGRES_DB=booknest
DATABASE_LOGGING=false

# JWT (required)
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh-in-production
JWT_REFRESH_EXPIRES_IN=7d

# Redis (required — refresh tokens)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Analytics cache (Redis — book stats, analytics, author dashboards)
ANALYTICS_CACHE_TTL=5m

# AWS S3 (required for file upload/download)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=booknest-files
AWS_S3_BASE_URL=

# Email (optional — verification flows need this in production)
GMAIL_USER=
GMAIL_APP_PASSWORD=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true

# Seeding (dev)
RUN_SEEDING=false
SEED_USERS_PASSWORD=dev-password-change-me

# Firebase push (optional)
FIREBASE_SERVICE_ACCOUNT_PATH=
# or FIREBASE_SERVICE_ACCOUNT_JSON=

# Book file fingerprinting (falls back to JWT_SECRET if unset)
BOOK_PDF_FINGERPRINT_SECRET=
BOOK_EPUB_FINGERPRINT_SECRET=
```

### 3. Database

Start Postgres (example with Docker — only the DB service):

```bash
docker compose up postgres -d
```

Run migrations:

```bash
npm run migration:run
```

Optional seed data (also runs automatically when `NODE_ENV=development` on startup):

```bash
npm run seed
# or
RUN_SEEDING=true npm run start:dev
```

### 4. Run the API

```bash
npm run start:dev
```

- API base: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`

### Full stack with Docker

Build and run API + Postgres + Redis:

```bash
docker compose up --build
```

Ensure `.env` supplies `JWT_SECRET`, `JWT_REFRESH_SECRET`, and AWS credentials for the `app` service (see `docker-compose.yml`).

The `Dockerfile` uses a **multi-stage build**: dev dependencies and TypeScript sources stay in the build stage; the runtime image only contains compiled `dist/` and production `node_modules`. Rebuild after dependency changes with `docker compose build --no-cache app`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled app |
| `npm test` | Unit tests (Jest) |
| `npm run test:cov` | Coverage report |
| `npm run test:e2e` | E2E tests |
| `npm run lint` | ESLint |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run migration:show` | List migration status |
| `npm run migration:generate -- src/migrations/MyMigration` | Generate from entity diff |
| `npm run seed` | Run database seeder |

## Application selection methods

Authors choose how readers get copies when creating a book:

| Method | Behavior |
|--------|----------|
| `author_selects` | Author approves/rejects each application |
| `first_come` | Auto-approve while `availableCopies > 0` (atomic reserve in a DB transaction) |
| `lottery` | All applications stay pending until deadline; author runs draw via `POST /api/applications/books/:bookId/run-lottery` (once per book, tracked by `lottery_run_at`) |

Copy reservation uses `tryReserveCopies` (`UPDATE … WHERE available_copies >= :count`) inside transactions for create, approve, bulk approve, and lottery.

## Book downloads & leak tracing

- **PDF / EPUB**: server fetches from S3, embeds a signed per-reader fingerprint, returns the file body (requires approved application).
- **Other formats**: JSON response with a presigned S3 URL.
- Authors can decode fingerprints from uploaded files via the leak-analysis endpoint (see Swagger).

> Large files are loaded into memory for watermarking. For high concurrency, consider pre-generated per-reader copies or download limits (not implemented yet).

## Scheduled jobs

`BooksSchedulerService` runs daily at midnight (server time):

- Non-lottery books: `active` → `in_progress` when application deadline passes
- Lottery books: same transition only after `lottery_run_at` is set
- `in_progress` → `completed` when review deadline passes

Lottery winner selection is **never** run by the cron — only by the author endpoint.

## Project structure

```
src/
├── applications/     # Reader applications, bulk actions, lottery
├── auth/             # JWT auth, verification, password reset
├── books/            # Books, analytics, files, scheduler
├── friends/
├── reviews/
├── users/            # Core user entity & settings
├── user-profile/
├── user-address/
├── files/            # S3 integration
├── notifications/
├── migrations/       # TypeORM migrations
├── seeds/            # Dev seed data
├── config/           # TypeORM & env wiring
└── main.ts           # Bootstrap, Swagger, global prefix `api`
```

## API conventions

- Global prefix: `/api`
- Bearer JWT on protected routes (`Authorization: Bearer <accessToken>`)
- Validation: `class-validator` with whitelist; unknown fields rejected
- Rate limiting: 100 requests / minute per IP (global `ThrottlerGuard`); stricter limits on auth routes
- Errors: consistent JSON via `ErrorResponseFilter`

## Testing

```bash
npm test
npm run test:cov
```

Tests live next to source files as `*.spec.ts`. Coverage excludes controllers, modules, migrations, and seeds by default (see `package.json` → `jest`).

## Migrations

Always use migrations in production — **do not** enable `synchronize`.

```bash
npm run migration:run
```

New migration file (empty scaffold):

```bash
npm run migration:create -- src/migrations/DescriptiveName
```

## License

Private / UNLICENSED — see `package.json`.

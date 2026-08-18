# Deployment

## Local development

```bash
npm install
npm run docker:dev:up      # mongo + redis only, on localhost:27017 / :6379
cp apps/backend/.env.example apps/backend/.env    # set a real JWT_SECRET
cp apps/frontend/.env.example apps/frontend/.env
npm run dev                # backend :4000 (hot reload) + frontend :5173 (Vite)
```

Generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Full stack via Docker

```bash
cp apps/backend/.env.example apps/backend/.env   # set JWT_SECRET at minimum
npm run docker:up
```

Brings up `mongo`, `redis`, `backend`, `frontend` (static build served by
its own nginx), and a gateway `nginx` on `localhost:8080` that proxies
`/api/*` to the backend and everything else to the frontend — the browser
only ever talks to one origin. Stop with `npm run docker:down`.

## Production notes (current phase)

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and real
  `DATABASE_URL`/`REDIS_URL` values (managed MongoDB/Redis recommended
  over the bundled containers for anything beyond a single-box deploy).
- `CORS_ORIGIN` must match the exact origin the frontend is served from.
- `COOKIE_DOMAIN` only needs setting if the API and frontend are on
  different subdomains of the same parent domain.
- The in-memory rate limiter (`apps/backend/src/common/middleware/rate-limit.ts`)
  is per-process — fine for a single backend instance, needs a Redis
  store before scaling to multiple instances (already flagged in
  ARCHITECTURE.md §5 / TODO.md).
- `STORAGE_PROVIDER=local` writes under `STORAGE_LOCAL_ROOT` and is served
  back through the backend's own `GET /api/files/*` route — fine for a
  single-box deploy with a persistent volume, but every generated file
  round-trips through the API process. `STORAGE_PROVIDER=s3` (with real
  AWS credentials, or an S3-compatible endpoint via `AWS_S3_ENDPOINT` —
  MinIO/R2/Spaces) is required for any multi-instance or ephemeral-disk
  deployment; it serves files via short-lived presigned URLs straight from
  the object store instead. Introduced in Phase 7 alongside the document
  engine that first needed it (interior PDFs/EPUBs/DOCXs); cover images
  (Phase 8) and export ZIPs (Phase 10) reuse the same provider.
- **Redis is now load-bearing** (Phase 4): content generation runs through
  a real BullMQ queue, and the worker starts in-process with the backend
  (see ARCHITECTURE.md §5). `npm run docker:dev:up` / `docker:up` already
  provision it — just make sure `REDIS_URL` in `apps/backend/.env` points
  at a reachable Redis before running `npm run dev` outside Docker.
- AI provider credentials (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`) are only
  required if `AI_PROVIDER` is set to `claude`/`openai`; the default
  `AI_PROVIDER=mock` needs neither and is what CI/tests use.

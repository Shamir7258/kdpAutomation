# KDP Automation Platform

A production-grade platform for automating the Amazon KDP book creation
workflow: research → idea → specification → outline → content → editing →
metadata → interior → cover → validation → export. See
[PLAN.md](PLAN.md) for the phased roadmap and
[ARCHITECTURE.md](ARCHITECTURE.md) for design decisions.

The platform prepares KDP-ready packages for manual upload — it does not
automate Amazon account actions, bypass CAPTCHA/auth, or make any
ranking/sales guarantees. See ARCHITECTURE.md and the brief's compliance
notes for the full policy.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui + React Query + React Hook Form + Zod
- **Backend**: Node.js + TypeScript + Express + MongoDB (Mongoose) + Redis/BullMQ (from Phase 4)
- **Monorepo**: npm workspaces — `apps/{backend,frontend}`, `packages/{shared,config,ai,storage,document-engine,cover-engine,kdp-validator}`

## Quick start

```bash
npm install
npm run docker:dev:up                              # Mongo + Redis for local dev
cp apps/backend/.env.example apps/backend/.env      # set a real JWT_SECRET (see docs/DEPLOYMENT.md)
cp apps/frontend/.env.example apps/frontend/.env
npm run migrate -w @kdp/backend                     # sync Mongo indexes
npm run dev                                         # backend :4000, frontend :5173
```

Full Docker stack (mongo + redis + backend + frontend + nginx gateway on
`:8080`): `npm run docker:up`. Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

`npm run dev` · `build` · `test` · `lint` · `format` · `typecheck` ·
`docker:up` / `docker:down` · `docker:dev:up` / `docker:dev:down` ·
`migrate`

## Docs

- [PLAN.md](PLAN.md) — phased delivery roadmap and status
- [ARCHITECTURE.md](ARCHITECTURE.md) — design decisions and assumptions
- [TODO.md](TODO.md) — active work
- [docs/API.md](docs/API.md) — REST API reference
- [docs/DATABASE.md](docs/DATABASE.md) — MongoDB schema
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — local + Docker deployment

## Status

**Phase 1 complete**: authentication (access/refresh JWT with rotating,
revocable sessions), project CRUD (create/rename/duplicate/archive/
restore/delete/search/filter/sort), and the dashboard shell. Everything
else in the brief (research, AI-driven generation, editing pipeline,
interior/cover engines, KDP validation, export, admin panel) is scoped
into later phases — see PLAN.md.

# VouchTails Core (First Version)

Full-stack foundation for the **VouchTails** two-sided pet-care marketplace: **Express API** + **Next.js App Router** web app.

**Repository:** [github.com/TechTeamVouhctails/first-version](https://github.com/TechTeamVouhctails/first-version)

## Monorepo layout

| Path       | Description                                      |
| ---------- | ------------------------------------------------ |
| Repo root  | Node API (Express, Prisma, Socket.IO, Razorpay)  |
| [`web/`](web/) | Next.js 16 frontend (React 19, Supabase client, TanStack Query) |

## Stack

- **Runtime:** Node.js ≥ 20  
- **API:** Express + TypeScript  
- **Database:** PostgreSQL via Prisma ORM (Supabase-hosted or local Docker)  
- **Auth:** Supabase Auth (JWT verified with JWKS); phone OTP requires Phone + SMS configured in Supabase  
- **Payments:** Razorpay (checkout + signed webhooks)  
- **Realtime:** Socket.IO (chat + live session location)  

## Prerequisites

- Node.js 20+  
- npm  
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional, for local Postgres)  
- Supabase project + optional Razorpay keys for full flows  

## Environment

1. **API (root)** — copy [`.env.example`](.env.example) → `.env` and fill values.  
   - `DATABASE_URL` must be a real Postgres URL (no template placeholders).  
   - In **development**, Razorpay vars can be omitted (placeholders apply); in **production** they are required.  
   - `SUPABASE_JWKS_URL` is optional in dev (derived from `SUPABASE_URL`).  
2. **Web** — copy [`web/.env.example`](web/.env.example) → `web/.env.local` and set `NEXT_PUBLIC_*` URLs to match your API (see below).  

## Local database (Docker)

```bash
docker compose up -d
```

Default compose URL (also in `.env.example`):

`postgresql://postgres:postgres@127.0.0.1:5433/vouchtails?schema=public`

Then:

```bash
npm install
npm run prisma:generate
npx prisma db push
```

For production or team workflows, prefer `npm run prisma:migrate` once migration history is committed.

## Run the API

```bash
npm run dev
```

- Default **port** in `.env.example` is **8787** (avoids common conflicts on `8080`).  
- Health: `GET http://localhost:8787/health`  
- API index: `GET http://localhost:8787/api`  

## Run the web app

```bash
cd web
npm install
npm run dev
```

Opens **http://localhost:3000**. Dev uses **webpack** (`next dev --webpack`) for stable RSC behavior on Windows.

Set in `web/.env.local`:

- `NEXT_PUBLIC_API_URL` — e.g. `http://localhost:8787/api`  
- `NEXT_PUBLIC_SOCKET_URL` — e.g. `http://localhost:8787`  
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same project as the API  
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — publishable key when testing checkout  

## Razorpay webhook

- **URL:** `POST /api/payments/webhook`  
- **Header:** `x-razorpay-signature`  
- **Body:** raw JSON (the route is registered **before** `express.json()` so the signature matches the raw payload)  

## npm scripts (API root)

| Script              | Purpose                |
| ------------------- | ---------------------- |
| `npm run dev`       | API with `tsx watch`   |
| `npm run build`     | Compile API to `dist/` |
| `npm run start`     | Run compiled API       |
| `npm run prisma:generate` | Prisma client    |
| `npm run prisma:migrate`  | Migrations (dev) |
| `npm run prisma:deploy`   | Migrations (prod) |
| `npm run test`      | Vitest                 |

## npm scripts (`web/`)

| Script          | Purpose                         |
| --------------- | ------------------------------- |
| `npm run dev`   | Next.js dev (webpack)          |
| `npm run build` | Production build (webpack)      |
| `npm run start` | Serve production build         |
| `npm run lint`  | Typecheck (`tsc --noEmit`)     |

## Git remote

After renaming the GitHub repository, point `origin` at the new URL:

```bash
git remote set-url origin https://github.com/TechTeamVouhctails/first-version.git
```

## Troubleshooting

- **Prisma `P1013` / connection errors:** malformed `DATABASE_URL`; URL-encode the password; keep `?sslmode=require` for Supabase.  
- **`EADDRINUSE` on API port:** stop another `npm run dev` or change `PORT` in `.env`.  
- **Phone OTP / “Unsupported phone provider”:** enable **Phone** auth and an **SMS provider / hook** under Supabase → Authentication → Providers → Phone.  

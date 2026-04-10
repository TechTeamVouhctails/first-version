# VouchTails Core Backend

Production-grade backend for VouchTails two-sided pet-care marketplace.

## Stack

- Node.js 20
- Express + TypeScript strict mode
- Prisma ORM + PostgreSQL (Supabase)
- Supabase Auth (JWT)
- Razorpay
- Socket.IO for live chat/location events

## Quick Start

1. Copy `.env.example` to `.env` and set secrets.
   - `DATABASE_URL` must be real (no placeholders), for example:
   - `postgresql://postgres:<URL_ENCODED_PASSWORD>@db.ncyblnstpkybqikkjkcm.supabase.co:5432/postgres?sslmode=require`
   - URL-encode your DB password before placing it in the URL.
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Run migrations:
   - `npm run prisma:migrate`
5. Start API:
   - `npm run dev`

## API Base

- `http://localhost:8080/api`
- Health: `GET /health`

## Payment Webhook

- Endpoint: `POST /api/payments/webhook`
- Header: `x-razorpay-signature`
- Body: raw JSON

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`

## Supabase DB URL Notes

- Get the direct Postgres connection string from Supabase project settings.
- If connection fails with Prisma `P1013`, your URL is malformed (usually placeholders or unescaped password chars).
- Keep `?sslmode=require` in the URL.

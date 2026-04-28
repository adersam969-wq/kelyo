# Kelyo

> Unified payment wallet for Central Africa — pay anywhere, with any source.

Kelyo solves payment fragmentation in Central Africa by aggregating Mobile Money (Airtel, Moov) and bank cards (Visa/Mastercard) into a single wallet that can pay anywhere via QR codes or payment links.

## Architecture

This is a monorepo containing:

- **`apps/backend`** — NestJS REST API (auth, wallet, payments, KYC, webhooks)
- **`apps/mobile`** — React Native (Expo) app for end-users and merchants
- **`apps/dashboard`** — Next.js web dashboard for merchants
- **`packages/shared`** — Shared types and utilities
- **`docs/`** — Architecture docs, API specs, security notes

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS, TypeScript, PostgreSQL, Redis, TypeORM |
| Mobile | React Native, Expo, TypeScript |
| Dashboard | Next.js 14 (App Router), Tailwind, TypeScript |
| Payments | CinetPay (Mobile Money + Cards) |
| Auth | JWT + OTP via SMS |
| Infra | Docker Compose for local dev |

## Quick start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Expo Go app on your phone (for mobile dev)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env files
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# 3. Start infrastructure (Postgres + Redis)
npm run docker:up

# 4. Run migrations & seeds (after backend is ready)
npm run dev:backend
```

Then in separate terminals:

```bash
npm run dev:dashboard   # http://localhost:3001
npm run dev:mobile      # Scan QR with Expo Go
```

## Project status

| Phase | Status | Description |
|---|---|---|
| Phase 0 | ✅ In progress | Monorepo setup, Docker, project skeleton |
| Phase 1 | ⏳ | Backend: auth, OTP, users, wallet, ledger, KYC |
| Phase 2 | ⏳ | Backend: CinetPay integration, webhooks, QR, payment links |
| Phase 3 | ⏳ | Mobile: auth, onboarding, wallet, transactions |
| Phase 4 | ⏳ | Mobile: scan QR, top-up, transfer, merchant mode |
| Phase 5 | ⏳ | Dashboard web for merchants |
| Phase 6 | ⏳ | Security audit, hardening, deployment docs |

## Security

This is a financial application. See [`docs/SECURITY.md`](docs/SECURITY.md) for our security model, threat model, and compliance considerations (BEAC, CEMAC).

## License

Proprietary — © Kelyo, 2026.

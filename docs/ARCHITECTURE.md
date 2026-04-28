# Kelyo — Architecture

## Overview

Kelyo is a unified payment wallet for Central Africa. It aggregates Mobile Money providers (Airtel Money, Moov Money) and bank cards (Visa, Mastercard) into a single user wallet that can pay any merchant via QR code or payment link.

The MVP targets Gabon first, then expands to the rest of the CEMAC zone (XAF currency).

## High-level diagram

```
┌─────────────────┐     ┌──────────────────┐
│  Mobile App     │     │ Web Dashboard    │
│  (Expo / RN)    │     │ (Next.js)        │
│  Users +        │     │ Merchants        │
│  Merchants      │     │                  │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         │ HTTPS + JWT           │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Backend (NestJS)    │
         │  ┌─────────────────┐  │
         │  │ Auth + OTP      │  │
         │  │ Users + KYC     │  │
         │  │ Wallet + Ledger │  │
         │  │ Payments        │  │
         │  │ QR + Links      │  │
         │  │ Webhooks        │  │
         │  │ Admin           │  │
         │  └─────────────────┘  │
         └──────┬─────────────┬──┘
                │             │
         ┌──────▼─────┐  ┌────▼──┐
         │ PostgreSQL │  │ Redis │
         └────────────┘  └───────┘
                │
         ┌──────▼─────────────┐
         │  CinetPay API      │
         │  • Checkout (in)   │
         │  • Transfer (out)  │
         │  • Webhooks        │
         └────────────────────┘
                │
         ┌──────▼──────────────────────────┐
         │ Airtel │ Moov │ Visa │ Mastercard│
         └─────────────────────────────────┘
```

## Components

### Backend (`apps/backend`)

NestJS modular monolith. Each feature lives in `src/modules/<name>/` with controller, service, entities, DTOs.

Key modules (delivered Phase 1+):
- **auth** — phone/OTP signup, login, JWT access + refresh tokens, refresh rotation
- **users** — profile, role, status
- **kyc** — document upload (S3/MinIO), tier promotion
- **wallet** — balance, available balance, status
- **ledger** — double-entry accounting (every transaction = paired debit/credit)
- **transactions** — top-up, withdraw, transfer, payment
- **payments** — QR codes (static/dynamic), payment links
- **cinetpay** — provider adapter (init checkout, init transfer, verify status, parse webhooks)
- **webhooks** — incoming CinetPay notifications, signature verification, idempotency
- **admin** — KYC review queue, user management

Cross-cutting:
- `common/` — base entity, exception filter, response interceptor, decorators, guards
- `config/` — typed config namespaces with env validation
- `database/` — TypeORM data source, migrations, seeds

### Mobile (`apps/mobile`)

Expo / React Native. Single codebase for iOS + Android.

- Navigation: `@react-navigation/native-stack` + bottom tabs
- State: Zustand for client state, React Query for server state
- Storage: `expo-secure-store` for tokens (encrypted Keychain/Keystore)
- Camera/QR: `expo-barcode-scanner` for scanning, `react-native-qrcode-svg` for display
- Biometrics: `expo-local-authentication` for payment confirmation

### Dashboard (`apps/dashboard`)

Next.js 14 App Router. Server components for data-heavy pages, client components for interactive widgets.

- Auth via the same backend JWT, stored in httpOnly cookie (set by a `/api/auth` proxy route)
- Tables: `@tanstack/react-table`
- Forms: `react-hook-form` + `zod`

### Shared (`packages/shared`)

Pure TypeScript types and constants used by all three apps. No runtime dependencies. Mobile redeclares the theme locally to avoid Metro/workspace headaches; the canonical version lives here.

## Data model — core entities

| Entity | Purpose |
|---|---|
| `users` | Identity (phone, email, role, KYC tier/status) |
| `merchant_profiles` | Business info attached to a merchant user |
| `kyc_documents` | Uploaded ID, selfie, proof of address — paths to encrypted blobs |
| `wallets` | One per user, currency, balance, available balance, status |
| `ledger_entries` | Immutable double-entry rows (debit/credit pairs) |
| `transactions` | User-facing transaction with status machine |
| `qr_codes` | Static (no amount) or dynamic (fixed amount) QR for merchants |
| `payment_links` | Shareable URL with embedded amount + slug |
| `webhook_events` | Raw incoming webhooks for replay + idempotency |
| `otp_codes` | Hashed OTPs with TTL and attempt counter |
| `audit_logs` | Sensitive-action trail (who, what, when, before/after) |

## Money flow — top-up example

```
1. User taps "Recharger" → enters 25 000 XAF, chooses Airtel Money
2. Mobile → POST /wallet/topup { amount, channel: AIRTEL_MONEY }
3. Backend creates a PENDING transaction (no balance change yet)
4. Backend calls CinetPay /v2/payment with our internal transaction_id
5. CinetPay returns payment_url + payment_token
6. Backend returns { checkoutUrl } to mobile
7. Mobile opens checkout in WebView / system browser
8. User completes payment on Airtel Money
9. CinetPay calls our webhook with status
10. Webhook handler: verify signature → check idempotency → if SUCCESS:
    - lock wallet row (SELECT FOR UPDATE)
    - write ledger pair: DEBIT cinetpay_clearing 25000 / CREDIT user_wallet 25000
    - update transaction.status = COMPLETED
    - update wallet.balance += 25000
11. Mobile poll or websocket gets the new balance
```

The double-entry constraint guarantees money is never created or destroyed by application bugs — every credit has a matching debit.

## Security boundaries

See [`SECURITY.md`](./SECURITY.md) for the full threat model. Key points:

- All financial operations are idempotent via client-supplied `idempotencyKey`
- Wallets are locked with `SELECT … FOR UPDATE` during balance changes
- Webhooks verify CinetPay's HMAC signature before any state change
- Refresh tokens are rotated on every use; reuse triggers full session revocation
- KYC blobs are encrypted at rest; URLs are signed and short-lived

## Local dev

```bash
docker compose up -d            # Postgres + Redis + MinIO + Mailhog
cd apps/backend && npm install && npm run start:dev
cd apps/dashboard && npm install && npm run dev
cd apps/mobile && npm install && npm start
```

## Deployment (target topology)

- Backend: containerized, behind a reverse proxy (Nginx/Caddy) with TLS
- Postgres: managed (RDS, Scaleway DB, or DigitalOcean Managed Postgres)
- Redis: managed
- KYC blobs: S3 with bucket policy denying public access
- Mobile: EAS Build → TestFlight + Play Internal Testing first
- Dashboard: Vercel or self-hosted Node behind reverse proxy
- Webhooks endpoint: must be reachable publicly with valid TLS (CinetPay won't call self-signed certs)

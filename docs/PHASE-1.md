# Phase 1 — Auth, Wallet, Ledger, KYC

> Backend now has working authentication, wallets, atomic P2P transfers, and KYC submission flow.
> CinetPay integration arrives in Phase 2.

## What's working

- **Auth via OTP**
  - `POST /auth/request-otp` — sends OTP via SMS (console in dev)
  - `POST /auth/verify-otp` — verifies and issues JWT pair (signup OR login)
  - `POST /auth/refresh` — rotates refresh token; reuse triggers full family revocation
  - `POST /auth/logout` — revokes all sessions for the user
- **Users**
  - `GET /users/me` — current user profile
- **Wallet**
  - `GET /wallet` — balance + status
  - `GET /wallet/transactions` — paginated history
  - `POST /wallet/transfer` — P2P internal transfer (requires `Idempotency-Key` header)
- **KYC**
  - `POST /kyc/upload-url` — get a presigned PUT URL
  - `POST /kyc/confirm` — finalize submission
  - `GET /kyc/admin/pending` — admin queue
  - `POST /kyc/admin/review/:id` — admin approves/rejects
- **Health**: `GET /health`, `/health/live`, `/health/ready`

## Database

Run migrations once Postgres is up:

```bash
cd apps/backend
npm install
npm run migration:run
```

This creates 10 tables with full constraints, indexes, append-only triggers, and `updated_at` triggers.

## Tests

```bash
cd apps/backend
npm test
```

Critical tests in `src/modules/wallet/ledger.service.spec.ts` lock down financial invariants:
- Unbalanced ledger entries are rejected
- Negative/zero/float amounts are rejected
- Insufficient balance throws
- Frozen wallet operations throw
- Currency mismatch throws
- Multi-line aggregation on the same wallet works correctly

Plus utility tests for phone normalization (E.164) and money validation.

## Try it manually

```bash
# 1. Request OTP
curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+24107123456","purpose":"SIGNUP"}'

# Check backend console — the OTP is logged there in dev (e.g. "📱 SMS to +241****56: Votre code Kelyo : 123456")

# 2. Verify (use the code from console)
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+24107123456","code":"123456","purpose":"SIGNUP"}'

# 3. Use the accessToken from the response
curl http://localhost:3000/api/v1/users/me \
  -H 'Authorization: Bearer <accessToken>'

curl http://localhost:3000/api/v1/wallet \
  -H 'Authorization: Bearer <accessToken>'
```

Swagger docs: http://localhost:3000/api/v1/docs

## Known gaps (deferred to next phases)

- **CinetPay integration is not live yet** — top-up and withdrawal endpoints don't exist.
  P2P transfers between Kelyo users work fully, but no money can enter or leave the system yet.
- **Storage uses a stub presigner** — the actual file upload to MinIO won't work end-to-end.
  Real `@aws-sdk` integration in Phase 2.
- **No mobile / dashboard UI for these flows yet** — Phases 3 and 5.
- **No PIN flow yet** — entity field is there (`pin_hash`, `failed_pin_attempts`, `pin_locked_until`) but no service. Comes with payments in Phase 2.

## What's next — Phase 2

CinetPay integration: top-up via Mobile Money / card → webhook handling → wallet credit. This is where Kelyo becomes truly useful: real money can finally enter the system.

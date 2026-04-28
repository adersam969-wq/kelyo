# Phase 2 — CinetPay, top-up, QR, payment links

> Real money can now enter and move within the Kelyo system, mediated by CinetPay.

## What's new

- **CinetPay adapter** (`cinetpay.client.ts`)
  - Initialize payment (top-up checkout)
  - Independent transaction status check
  - Outbound transfer scaffolding
  - HMAC webhook signature verification with constant-time comparison

- **Top-up flow**
  - `POST /wallet/topup` — initiates a checkout, returns `{ transactionId, checkoutUrl }`
  - `GET /wallet/topup/:transactionId` — poll status

- **Webhook handler** — `POST /webhooks/cinetpay/payment`
  - Logs every event in `webhook_events` (append-only) before any processing
  - Verifies HMAC signature → rejects on mismatch
  - Calls CinetPay's `/payment/check` for independent confirmation
  - Validates amount matches our internal transaction
  - Posts balanced ledger entries inside a DB transaction with `SELECT FOR UPDATE`
  - Idempotent: replays of the same `cpm_trans_id` are no-ops

- **QR codes (merchant)**
  - `POST /merchant/qr` — STATIC (payer enters amount) or DYNAMIC (fixed amount)
  - `GET /merchant/qr` — list with pagination
  - `DELETE /merchant/qr/:id` — revoke

- **Payment links (merchant)**
  - `POST /merchant/payment-links`
  - `GET /merchant/payment-links` — list
  - `DELETE /merchant/payment-links/:id` — cancel
  - `GET /payment-links/:slug` — public, for the pay page

- **Pay actions (any user)**
  - `POST /payments/pay-qr` — settle a QR scan
  - `POST /payments/pay-link` — settle a payment link
  - Both wrap in `LedgerService.post()` for full atomicity

## New tables (migration `1715000000000-Phase2PaymentTables`)

- `webhook_events` — append-only audit, unique on `(source, external_event_id)`
- `payment_links` — slug-indexed, status machine
- `qr_codes` — payload-indexed, with a CHECK constraint enforcing `(STATIC ⇔ amount NULL) AND (DYNAMIC ⇔ amount NOT NULL)`

Run with:
```bash
cd apps/backend
npm run migration:run
```

## Tests added

`cinetpay.client.spec.ts` — 6 tests on signature verification:
- accepts a correctly signed payload
- rejects tampered amounts (catches MITM modifying the body)
- rejects empty / malformed / wrong-length tokens
- rejects when signed with a different secret

These guard the most attacker-exposed surface in the codebase.

## Security model recap

The webhook handler is the **only** place outside of internal P2P that can credit a wallet. It therefore implements 5 layers:

1. **Audit log first** — every incoming webhook is persisted before processing
2. **Signature verification** with constant-time HMAC compare (timing-attack safe)
3. **Idempotency** via unique `(source, external_event_id)` constraint
4. **Independent verification** — call CinetPay's check API; never trust the body alone
5. **Pessimistic lock** + balanced ledger inside a DB transaction

If any layer fails, no balance is ever changed.

## Try it

The full top-up flow needs real CinetPay sandbox credentials. To test end-to-end:

1. Sign up on https://cinetpay.com (sandbox account)
2. Get your `apikey`, `site_id`, `secret_key` from the dashboard
3. Update `apps/backend/.env`:
   ```
   CINETPAY_API_KEY=...
   CINETPAY_SITE_ID=...
   CINETPAY_SECRET_KEY=...
   CINETPAY_NOTIFY_URL=https://your-public-url/api/v1/webhooks/cinetpay/payment
   ```
4. Use ngrok or similar to expose your local backend so CinetPay can reach the webhook:
   ```bash
   ngrok http 3000
   # Update CINETPAY_NOTIFY_URL with the ngrok URL
   ```
5. Call `/wallet/topup` from a logged-in client → open the returned `checkoutUrl` → complete payment in CinetPay's UI → watch the webhook arrive in your logs and the wallet credit.

QR and payment link flows work entirely without CinetPay (internal balance shifts only).

## Next: Phase 3

Mobile app — bring this to life on the user's phone. Auth screens, wallet, scan-to-pay, top-up flow with the in-app browser opening CinetPay's checkout.

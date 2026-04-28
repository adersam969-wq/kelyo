# Kelyo — Security Model

> Kelyo handles real money. This doc is the source of truth for our security posture. Every PR that touches auth, wallet, ledger, payments, or webhooks must be reviewed against this document.

## 1. Regulatory context

Kelyo operates in the CEMAC zone (Gabon, Cameroon, Congo, CAR, Chad, Equatorial Guinea), regulated by the BEAC (Banque des États de l'Afrique Centrale) and COBAC (Commission Bancaire de l'Afrique Centrale).

Operating a payment service that holds customer funds requires either:
1. An EME (Établissement de Monnaie Électronique) license from COBAC, or
2. A partnership with a licensed entity (bank or licensed PSP)

**For the MVP**, we use **CinetPay** as our regulated payment service provider. CinetPay holds the relevant licenses; we are a technical layer on top. Customer funds never sit in a Kelyo-owned bank account — they transit through CinetPay's regulated rails.

This means the wallet "balance" we display is, legally, a record of customer credit redeemable through CinetPay. Before launching commercially, this needs review by a CEMAC fintech lawyer to confirm we are not unintentionally operating an unlicensed deposit-taking service.

## 2. Threat model

| Threat | Impact | Mitigation |
|---|---|---|
| Stolen credentials | Account takeover | OTP on every login from a new device; biometric for sensitive actions |
| SIM swap | Account takeover | OTP fallback to email if registered; cooling-off period on phone change |
| Replay of webhook | Double-credit | Idempotency keys + signature verification + dedup table |
| Race condition on balance | Negative balance / double-spend | Row-level locks + double-entry ledger |
| Compromised access token | Limited-time impersonation | 15-min access token; refresh rotation; revocation on suspicious activity |
| Compromised refresh token | Full session takeover | Rotation: every refresh issues a new token and invalidates the old; reuse of old token revokes the entire family |
| API key leak (CinetPay) | Unauthorized payments initiated | Keys in env, never in code; rotation procedure documented; secret manager in prod |
| KYC document leak | PII / identity theft | Server-side encryption at rest; signed URLs with short TTL; no public bucket |
| SQL injection | Data exfiltration | Parameterized queries (TypeORM); no raw SQL with user input |
| XSS in dashboard | Session theft | React escapes by default; CSP headers; httpOnly cookies for session |
| Phishing payment link | User pays attacker | Verified merchant badges; payment links display merchant name + KYC status |
| Insider threat | Mass data access | Audit logs on all admin actions; principle of least privilege; role separation |

## 3. Authentication

### Phone + OTP

- Phone numbers stored in E.164 format (`+241...`)
- OTP: 6 digits, 5-minute TTL, max 5 attempts, hashed with Argon2 before storage
- Rate limit: 3 OTP requests per phone per 15 minutes; 10 per IP per hour
- OTP delivered via SMS provider (TBD — Twilio, Africa's Talking, or local aggregator)
- In dev, OTP is logged to console; never log OTPs in any other env

### JWT

- **Access token**: 15 minutes, signed with HS256, contains `sub` (user id), `role`, `kycTier`
- **Refresh token**: 30 days, opaque random string, stored hashed in DB with `family_id`
- Refresh rotation: every `/auth/refresh` call issues a new pair and marks the old refresh as used
- **Reuse detection**: if a used refresh is presented again, revoke the entire family — the user is logged out everywhere
- Tokens stored on mobile in `expo-secure-store` (Keychain/Keystore), on web in `httpOnly`/`Secure`/`SameSite=Strict` cookies

### Biometric / PIN

- A 4-6 digit PIN is required for: payments above a threshold, withdrawals, profile changes
- Biometric (`expo-local-authentication`) can substitute the PIN if the user opts in
- The PIN is verified server-side, never compared client-side; rate limited (5 attempts → 15-min lockout)

## 4. Wallet & ledger invariants

These are enforced at the database level via constraints and at the application level via service layer. Both layers must agree.

1. `wallet.balance >= 0` always — DB CHECK constraint
2. Every `transactions` row that affects balance has a matching pair of `ledger_entries` whose sum is zero
3. The sum of all `ledger_entries.amount` for a single wallet equals `wallet.balance` (audit invariant; verified by a nightly job)
4. Balance updates require `SELECT … FOR UPDATE` on the wallet row inside a transaction
5. Currency is XAF only in the MVP; mixing currencies on a single ledger entry is forbidden
6. Idempotency key on every wallet-affecting endpoint, stored in `idempotency_keys (key, user_id, response_hash, created_at)` with 24h TTL

## 5. Webhook security

CinetPay webhooks are the **most dangerous** input surface — they trigger money movements.

1. **Signature verification**: CinetPay sends an HMAC token (`x-token` or signature in body). We re-compute the HMAC using our `CINETPAY_SECRET_KEY` and compare with constant-time comparison. Mismatch → 401 + alert.
2. **IP allowlist** (defense in depth): in production, only accept POSTs from CinetPay's published IP ranges.
3. **Idempotency**: every webhook is keyed by `cinetpay_transaction_id`; if we've already processed it (any outcome), we return 200 OK without re-processing.
4. **Independent verification**: even after signature passes, we call CinetPay's `/v1/payment/check/:transaction_id` to confirm the status before crediting the wallet. The webhook is a notification, not a source of truth.
5. **Retry-safe**: if our handler crashes mid-way, CinetPay retries; combined with idempotency, this never produces double-credits.
6. **Logging**: raw payload + signature + result stored in `webhook_events` for audit and replay.

## 6. KYC handling

### Tiers

| Tier | Requirements | Max balance | Daily tx limit |
|---|---|---|---|
| TIER_0 | Phone verified | 100 000 XAF | 50 000 XAF |
| TIER_1 | + ID document | 500 000 XAF | 300 000 XAF |
| TIER_2 | + selfie + proof of address | 2 000 000 XAF | 1 500 000 XAF |

(Limits configurable via env, see `apps/backend/.env.example`.)

### Document handling

- Uploads go to MinIO (dev) / S3 (prod) into a private bucket
- Server-side encryption (SSE-S3 or SSE-KMS in prod)
- Filenames are random UUIDs — never the user's name
- Access via signed URLs valid for 5 minutes, only issued to admins reviewing KYC
- Documents are deleted within 90 days of account closure (GDPR-aligned, also CEMAC data protection law)

## 7. Logging and audit

- **No sensitive data in logs**: no full phone numbers (mask middle digits), no OTPs ever, no full card numbers (CinetPay's job, not ours), no JWT contents
- **Audit log** for: KYC approvals/rejections, admin actions, role changes, password/PIN changes, large transactions
- Audit log is **append-only** — even admins can't delete rows; enforced by DB role separation in production

## 8. Rate limiting

| Endpoint | Limit |
|---|---|
| `/auth/request-otp` | 3 per phone per 15 min, 10 per IP per hour |
| `/auth/verify-otp` | 5 attempts per OTP, then OTP is invalidated |
| `/auth/login` | 10 per phone per hour |
| `/wallet/transfer`, `/wallet/withdraw` | 30 per user per hour |
| All other endpoints | Default 100 per minute per IP (NestJS Throttler) |

## 9. Secrets management

- Local dev: `.env` files (gitignored)
- Production: secret manager (AWS Secrets Manager, Doppler, or HashiCorp Vault)
- Rotation policy: JWT secrets rotatable without logging users out (multi-key support to be implemented in Phase 1)
- CinetPay keys rotated every 90 days minimum

## 10. Incident response (skeleton)

If we detect compromise:
1. Revoke all active sessions (`UPDATE refresh_tokens SET revoked_at = NOW()`)
2. Freeze wallets above a configurable threshold pending review
3. Rotate JWT secrets and CinetPay keys
4. Notify users via SMS within 72h (CEMAC data protection law)
5. Post-mortem in `docs/incidents/YYYY-MM-DD-<slug>.md`

## 11. Things explicitly out of scope (today)

- PCI-DSS compliance — handled by CinetPay; we never see card numbers
- Multi-region failover — single region until we have traffic to justify it
- Real-time fraud ML — basic rules only in MVP (velocity, amount thresholds, geo anomalies)
- 3DS challenge flow customization — using CinetPay's checkout, which handles this

## 12. Pre-launch checklist

Before we accept a single real customer payment:

- [ ] Penetration test by an external firm
- [ ] Legal review of T&Cs and privacy policy by a CEMAC-licensed lawyer
- [ ] BEAC/COBAC consultation: confirm our model under CinetPay umbrella is acceptable
- [ ] Production secrets rotated and stored in secret manager
- [ ] Monitoring + alerting on: webhook failures, balance invariant violation, unusual transfer velocity, failed login spikes
- [ ] Backup + restore tested on Postgres
- [ ] Disaster recovery runbook

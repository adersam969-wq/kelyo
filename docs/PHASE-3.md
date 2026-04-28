# Phase 3 — Mobile app (auth + wallet)

> The Kelyo app now runs end-to-end on iOS and Android via Expo Go.

## What's working

A new user can install Expo Go, scan the QR from `npm run dev:mobile`, and:

1. See the welcome screen (gradient bleu→vert with brand)
2. Choose "Créer un compte" or "Se connecter"
3. Enter their phone number (auto +241 prefix for Gabon)
4. Receive an OTP (logged to backend console in dev) and verify it
5. Land on the home screen with their balance, KYC status, recent transactions
6. Tap "Recharger" → choose amount + channel → opens CinetPay checkout in browser
7. Tap "Envoyer" → enter recipient phone + amount → P2P transfer (fully atomic)
8. Browse the full transaction history with infinite pagination
9. Open the profile, see their KYC tier, and log out

## How to run

```bash
# Backend (one terminal)
cd apps/backend
npm install
docker compose up -d
npm run migration:run
npm run start:dev

# Mobile (another terminal)
cd apps/mobile
npm install
npm start
```

Scan the QR with **Expo Go** (App Store / Play Store) on a phone connected to the same Wi-Fi.

If your backend is on a different host, edit `apps/mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.XX:3000/api/v1
```

## What's in this phase

### Foundations
- **Theme bridge** — bleu/vert palette as design tokens (50→900), spacing, radius, typography
- **UI components** — `Button` (5 variants), `Input` (label/error/hint), `Screen` (SafeArea + KeyboardAvoiding wrapper)
- **State** — Zustand `useAuthStore` with `expo-secure-store` persistence (access + refresh tokens + user)
- **API services** — `authApi`, `walletApi`, `paymentsApi` with auto Idempotency-Key generation

### Navigation
- `RootNavigator` — switches between Auth/Main based on `useAuthStore().user`
- `AuthNavigator` — Welcome → Phone → OtpVerify
- `MainNavigator` — bottom tabs (Home / Transactions / Profile) + modal screens (Topup / Transfer)

### Screens
| Screen | What it does |
|---|---|
| `WelcomeScreen` | Brand + 3 features + 2 CTAs |
| `PhoneScreen` | Phone entry with E.164 normalization |
| `OtpVerifyScreen` | 6-digit code + resend |
| `HomeScreen` | Balance card, 4 quick actions, KYC banner, recent tx preview |
| `TransactionsScreen` | Full history, infinite scroll |
| `TopupScreen` | Amount + quick presets + channel picker → CinetPay checkout |
| `TransferScreen` | P2P send with summary card |
| `ProfileScreen` | Identity, KYC tier, settings, logout |

## What's NOT yet here (Phase 4)

- **QR scanner** for paying merchants — UI tile is there but no implementation
- **Payment link** flow on the user side
- **Merchant mode** — generating QR codes and payment links from the app
- **PIN entry** for confirming transactions above a threshold
- **Biometric authentication**

## Known limitations

- **Top-up flow** opens CinetPay's checkout in the system browser (`Linking.openURL`).
  In Phase 4 we'll switch to `expo-web-browser` for a smoother in-app experience.
- After a successful top-up, the user has to pull-to-refresh the home screen to see
  the new balance. A polling loop or push notification will come in Phase 4.
- KYC submission UI is not yet wired — Phase 4.
- Auto-refresh on 401 in the API client is implemented (Phase 0) and works with the
  Phase 1 `/auth/refresh` endpoint, including refresh rotation. If the user's session
  was revoked elsewhere, they'll be silently logged out (token cleanup is in `client.ts`).

## Next: Phase 4

QR scanner, merchant mode, payment links, KYC upload UI.

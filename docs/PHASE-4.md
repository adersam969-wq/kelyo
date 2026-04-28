# Phase 4 — Retraits avec PIN et plafonds KYC

> Les utilisateurs peuvent maintenant retirer leur argent vers Airtel Money ou Moov Money,
> protégés par un PIN à 4 chiffres et des plafonds par tier KYC.

## Backend

### Nouveau module Withdrawals
- Machine d'état complète : `PENDING_PIN → PENDING → PROCESSING → COMPLETED/FAILED`
- Refund automatique du wallet si CinetPay refuse le transfert
- Plafonds par tier KYC :
  - TIER_0 : 25 000 XAF par retrait, 50 000 XAF par jour
  - TIER_1 : 200 000 XAF par retrait, 300 000 XAF par jour
  - TIER_2 : 1 000 000 XAF par retrait, 1 500 000 XAF par jour
- Frais : gratuit jusqu'à 10 000 XAF, 1 % au-delà (plafonné à 500 XAF)

### Nouveau service PIN
- Hash Argon2id
- Lockout après 5 échecs (15 min)
- Validation anti-faiblesses (rejette 0000, 1234, etc.)
- Endpoint `GET /users/me/pin` (statut), `POST /users/me/pin` (création/changement)

### Nouveaux endpoints API
| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/wallet/withdraw` | Initier un retrait (créé en `PENDING_PIN`) |
| `POST` | `/wallet/withdraw/:id/confirm` | Confirmer avec PIN, déclenche le débit + appel CinetPay |
| `GET` | `/wallet/withdraw/:id` | Statut du retrait |
| `DELETE` | `/wallet/withdraw/:id` | Annuler avant confirmation PIN |
| `GET` | `/users/me/pin` | Vérifie si l'utilisateur a un PIN |
| `POST` | `/users/me/pin` | Créer ou changer le PIN |

### Migration SQL
Nouvelle table `withdrawals` avec :
- FK vers `users`, `wallets`, `transactions`
- Index unique sur `cinetpay_transaction_id`
- Trigger `updated_at` automatique

## Mobile

### Nouveaux écrans
- **WithdrawScreen** : flow en 2 étapes (formulaire → PIN), avec affichage du solde, frais quotés en temps réel
- **SetPinScreen** : création de PIN avec confirmation et règles de sécurité visibles

### Navigation
- 4ème bouton d'action sur Home : "Retirer" (remplace l'ancien "Lien")
- Modal `Withdraw` accessible depuis Home
- Modal `SetPin` accessible depuis Withdraw si pas de PIN défini

## Sécurité

- PIN jamais stocké en clair (Argon2id)
- Wallet **n'est pas débité** avant confirmation PIN
- Si CinetPay refuse → refund automatique avec ledger inverse balanced
- Idempotency-Key obligatoire sur `/wallet/withdraw`
- Plafonds appliqués **avant** la création du retrait
- Tracking des tentatives PIN, lockout après 5 échecs

## Démo

1. Crée ton PIN depuis Profil → "Code PIN" → suis les instructions
2. Tape "Retirer" sur la home
3. Entre ton numéro Airtel/Moov, le montant
4. Confirme avec ton PIN
5. La transaction passe en PROCESSING (en attente du webhook CinetPay)

Sans credentials CinetPay valides, l'appel échouera et le wallet sera **automatiquement remboursé** — c'est exactement le comportement attendu en production.

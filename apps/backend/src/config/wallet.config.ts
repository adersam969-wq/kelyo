import { registerAs } from '@nestjs/config';

/**
 * KYC tiers determine wallet limits.
 *  - tier0: phone-verified only (anonymous)
 *  - tier1: ID document submitted & approved
 *  - tier2: ID + selfie + proof of address (full KYC)
 *
 * Limits in XAF (Central African CFA franc).
 */
export default registerAs('wallet', () => ({
  maxBalance: {
    tier0: parseInt(process.env.WALLET_MAX_BALANCE_TIER0 ?? '100000', 10),
    tier1: parseInt(process.env.WALLET_MAX_BALANCE_TIER1 ?? '500000', 10),
    tier2: parseInt(process.env.WALLET_MAX_BALANCE_TIER2 ?? '2000000', 10),
  },
  dailyTxLimit: {
    tier0: parseInt(process.env.WALLET_DAILY_TX_LIMIT_TIER0 ?? '50000', 10),
    tier1: parseInt(process.env.WALLET_DAILY_TX_LIMIT_TIER1 ?? '300000', 10),
    tier2: parseInt(process.env.WALLET_DAILY_TX_LIMIT_TIER2 ?? '1500000', 10),
  },
}));

import { BadRequestException } from '@nestjs/common';
import { LedgerService, LedgerLine } from './ledger.service';
import { LedgerAccount, LedgerDirection } from './entities/ledger-entry.entity';
import { WalletStatus } from './entities/wallet.entity';

/**
 * Critical tests — these guard the core financial invariants.
 *
 * If any of these tests fail, money is at risk. Do NOT skip or weaken them.
 */
describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(() => {
    service = new LedgerService();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function makeManager(opts: {
    wallet?: { id: string; balance: number; availableBalance: number; status: WalletStatus; currency: string } | null;
    walletNotFound?: boolean;
  } = {}) {
    const updates: Array<{ id: string; balance: number; availableBalance: number }> = [];
    const ledgerInserts: any[] = [];
    const wallet = opts.wallet;

    return {
      updates,
      ledgerInserts,
      manager: {
        getRepository: (entity: any) => {
          const name = entity.name ?? entity.toString();
          if (name === 'Wallet') {
            return {
              createQueryBuilder: () => ({
                setLock: () => ({
                  where: () => ({
                    getOne: async () => (opts.walletNotFound ? null : wallet),
                  }),
                }),
              }),
              update: async (where: any, patch: any) => {
                updates.push({ id: where.id, ...patch });
              },
            };
          }
          if (name === 'LedgerEntry') {
            return {
              create: (data: any) => data,
              save: async (entries: any[]) => {
                ledgerInserts.push(...entries);
                return entries.map((e) => ({ ...e, id: 'le-' + Math.random() }));
              },
            };
          }
          return {};
        },
      } as any,
    };
  }

  // ─── 1. Balanced entries ────────────────────────────────────────────────────
  it('rejects unbalanced entries (debits != credits)', async () => {
    const { manager } = makeManager();
    const lines: LedgerLine[] = [
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.DEBIT, amount: 1000 },
      { account: LedgerAccount.USER_WALLET, direction: LedgerDirection.CREDIT, amount: 500 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow(BadRequestException);
  });

  it('rejects entries with fewer than 2 lines', async () => {
    const { manager } = makeManager();
    await expect(
      service.post(manager, 'tx-1', [
        { account: LedgerAccount.USER_WALLET, direction: LedgerDirection.CREDIT, amount: 1000 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── 2. Amount validation ───────────────────────────────────────────────────
  it('rejects negative amounts', async () => {
    const { manager } = makeManager();
    const lines: LedgerLine[] = [
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.DEBIT, amount: -100 },
      { account: LedgerAccount.USER_WALLET, direction: LedgerDirection.CREDIT, amount: -100 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow();
  });

  it('rejects zero amounts', async () => {
    const { manager } = makeManager();
    const lines: LedgerLine[] = [
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.DEBIT, amount: 0 },
      { account: LedgerAccount.USER_WALLET, direction: LedgerDirection.CREDIT, amount: 0 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow();
  });

  it('rejects non-integer amounts', async () => {
    const { manager } = makeManager();
    const lines: LedgerLine[] = [
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.DEBIT, amount: 100.5 },
      { account: LedgerAccount.USER_WALLET, direction: LedgerDirection.CREDIT, amount: 100.5 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow();
  });

  // ─── 3. Wallet state checks ─────────────────────────────────────────────────
  it('rejects debits that would make a wallet balance negative', async () => {
    const { manager } = makeManager({
      wallet: {
        id: 'w-1',
        balance: 500,
        availableBalance: 500,
        status: WalletStatus.ACTIVE,
        currency: 'XAF',
      },
    });
    const lines: LedgerLine[] = [
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.DEBIT,
        walletId: 'w-1',
        amount: 1000,
      },
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.CREDIT, amount: 1000 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow(/Insufficient balance/);
  });

  it('rejects operations on a frozen wallet', async () => {
    const { manager } = makeManager({
      wallet: {
        id: 'w-1',
        balance: 5000,
        availableBalance: 5000,
        status: WalletStatus.FROZEN,
        currency: 'XAF',
      },
    });
    const lines: LedgerLine[] = [
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.DEBIT,
        walletId: 'w-1',
        amount: 1000,
      },
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.CREDIT, amount: 1000 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow(/not active/);
  });

  it('rejects operations on a non-existent wallet', async () => {
    const { manager } = makeManager({ walletNotFound: true });
    const lines: LedgerLine[] = [
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.DEBIT,
        walletId: 'w-missing',
        amount: 1000,
      },
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.CREDIT, amount: 1000 },
    ];
    await expect(service.post(manager, 'tx-1', lines)).rejects.toThrow(/not found/);
  });

  it('rejects currency mismatch between wallet and entry', async () => {
    const { manager } = makeManager({
      wallet: {
        id: 'w-1',
        balance: 5000,
        availableBalance: 5000,
        status: WalletStatus.ACTIVE,
        currency: 'XOF',
      },
    });
    const lines: LedgerLine[] = [
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.CREDIT,
        walletId: 'w-1',
        amount: 1000,
      },
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.DEBIT, amount: 1000 },
    ];
    await expect(service.post(manager, 'tx-1', lines, 'XAF')).rejects.toThrow(/Currency mismatch/);
  });

  // ─── 4. Happy path ──────────────────────────────────────────────────────────
  it('successfully posts a balanced top-up and updates wallet balance', async () => {
    const ctx = makeManager({
      wallet: {
        id: 'w-1',
        balance: 0,
        availableBalance: 0,
        status: WalletStatus.ACTIVE,
        currency: 'XAF',
      },
    });
    const lines: LedgerLine[] = [
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.DEBIT, amount: 25000 },
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.CREDIT,
        walletId: 'w-1',
        amount: 25000,
      },
    ];
    await service.post(ctx.manager, 'tx-1', lines);
    expect(ctx.updates).toHaveLength(1);
    expect(ctx.updates[0].id).toBe('w-1');
    expect(ctx.updates[0].balance).toBe(25000);
    expect(ctx.updates[0].availableBalance).toBe(25000);
    expect(ctx.ledgerInserts).toHaveLength(2);
  });

  it('aggregates multiple lines on the same wallet into a single update', async () => {
    const ctx = makeManager({
      wallet: {
        id: 'w-1',
        balance: 10000,
        availableBalance: 10000,
        status: WalletStatus.ACTIVE,
        currency: 'XAF',
      },
    });
    // A self-balancing fee deduction: wallet -100 (fee) + wallet -900 (payment) = -1000; external +1000
    const lines: LedgerLine[] = [
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.DEBIT,
        walletId: 'w-1',
        amount: 900,
      },
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.DEBIT,
        walletId: 'w-1',
        amount: 100,
      },
      { account: LedgerAccount.EXTERNAL_AIRTEL, direction: LedgerDirection.CREDIT, amount: 1000 },
    ];
    await service.post(ctx.manager, 'tx-1', lines);
    // Only one update on wallet w-1 with combined delta -1000
    expect(ctx.updates).toHaveLength(1);
    expect(ctx.updates[0].balance).toBe(9000);
  });
});

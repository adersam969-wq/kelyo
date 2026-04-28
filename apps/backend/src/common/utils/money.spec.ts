import { assertValidAmount, formatXAF, MAX_AMOUNT } from './money';

describe('assertValidAmount', () => {
  it('accepts positive integers', () => {
    expect(() => assertValidAmount(1)).not.toThrow();
    expect(() => assertValidAmount(25_000)).not.toThrow();
    expect(() => assertValidAmount(MAX_AMOUNT)).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => assertValidAmount(0)).toThrow();
  });

  it('rejects negative', () => {
    expect(() => assertValidAmount(-1)).toThrow();
  });

  it('rejects floats', () => {
    expect(() => assertValidAmount(1.5)).toThrow();
    expect(() => assertValidAmount(0.1 + 0.2)).toThrow();
  });

  it('rejects amounts above MAX_AMOUNT', () => {
    expect(() => assertValidAmount(MAX_AMOUNT + 1)).toThrow();
  });

  it('rejects non-numbers', () => {
    expect(() => assertValidAmount('100' as never)).toThrow();
    expect(() => assertValidAmount(null as never)).toThrow();
    expect(() => assertValidAmount(undefined as never)).toThrow();
  });
});

describe('formatXAF', () => {
  it('formats integer amounts with no decimals', () => {
    const formatted = formatXAF(25000);
    // Locale output varies but must contain the digits and currency code
    expect(formatted).toMatch(/25/);
    expect(formatted).toMatch(/000/);
    expect(formatted).toMatch(/XAF|F CFA|FCFA/i);
  });
});

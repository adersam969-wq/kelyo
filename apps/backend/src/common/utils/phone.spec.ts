import { normalizePhone, maskPhone } from './phone';

describe('normalizePhone', () => {
  it('preserves already-E.164 numbers', () => {
    expect(normalizePhone('+24107123456')).toBe('+24107123456');
  });

  it('strips spaces, dashes, parens', () => {
    expect(normalizePhone('+241 07-123 (456)')).toBe('+24107123456');
  });

  it('converts 00-prefix to +', () => {
    expect(normalizePhone('0024107123456')).toBe('+24107123456');
  });

  it('uses default country code when missing', () => {
    expect(normalizePhone('07123456', 'GA')).toBe('+24107123456');
  });

  it('rejects malformed E.164', () => {
    expect(() => normalizePhone('+abc')).toThrow();
    expect(() => normalizePhone('+1')).toThrow(); // too short
  });
});

describe('maskPhone', () => {
  it('masks middle digits', () => {
    expect(maskPhone('+24107123456')).toBe('+241****56');
  });

  it('handles short strings safely', () => {
    expect(maskPhone('+1')).toBe('***');
  });
});

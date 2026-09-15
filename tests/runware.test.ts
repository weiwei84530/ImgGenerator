import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBalance, validateKey } from '../src/runware';

afterEach(() => vi.unstubAllGlobals());

function reply(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('REST authentication', () => {
  it('accepts the empty acknowledgment returned by valid REST credentials', async () => {
    const fetch = reply({ data: [] });
    await expect(validateKey('test-key')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([200, 401])('rejects invalid credentials on HTTP %s', async (status) => {
    reply({ errors: [{ code: 'invalidApiKey' }] }, status);
    await expect(validateKey('bad-key')).rejects.toThrow('API Key');
  });

  it.each([{ errors: [] }, {}, { data: null }])('rejects missing acknowledgments', async (body) => {
    reply(body);
    await expect(validateKey('test-key')).rejects.toThrow();
  });
});

describe('account balance', () => {
  it.each([12.34, 0])('reads scalar USD balances including zero: %s', async (balance) => {
    reply({ data: [{ taskType: 'accountManagement', balance }] });
    await expect(fetchBalance('test-key')).resolves.toEqual({ amount: balance, currency: 'USD' });
  });

  it('also reads structured balances without retaining account details', async () => {
    reply({
      data: [{ balance: { amount: 12.34, currency: 'USD', freeBalance: 1 }, team: ['private'] }],
    });
    await expect(fetchBalance('test-key')).resolves.toEqual({
      amount: 12.34,
      currency: 'USD',
      freeBalance: 1,
    });
  });

  it.each([null, '', '12.34', {}, { amount: 1, currency: 'EUR' }])(
    'does not invent a balance for malformed data',
    async (balance) => {
      reply({ data: [{ balance }] });
      await expect(fetchBalance('test-key')).rejects.toThrow('無法讀取餘額');
    },
  );
});

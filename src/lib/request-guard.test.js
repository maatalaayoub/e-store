import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment before importing the guard module.
const originalEnv = process.env;

function createRequest(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe('request-guard', () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_SAME_ORIGIN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('assertSameOrigin', () => {
    it('allows same-origin requests', async () => {
      const { assertSameOrigin } = await import('@/lib/request-guard');
      const req = createRequest({
        origin: 'https://example.com',
        host: 'example.com',
      });
      expect(assertSameOrigin(req)).toBeNull();
    });

    it('allows requests with matching referer and no origin', async () => {
      const { assertSameOrigin } = await import('@/lib/request-guard');
      const req = createRequest({
        referer: 'https://example.com/checkout',
        host: 'example.com',
      });
      expect(assertSameOrigin(req)).toBeNull();
    });

    it('rejects cross-origin requests', async () => {
      const { assertSameOrigin } = await import('@/lib/request-guard');
      const req = createRequest({
        origin: 'https://attacker.com',
        host: 'example.com',
      });
      const res = assertSameOrigin(req);
      expect(res).not.toBeNull();
      expect(res.status).toBe(403);
    });

    it('rejects requests with no origin or referer', async () => {
      const { assertSameOrigin } = await import('@/lib/request-guard');
      const req = createRequest({ host: 'example.com' });
      const res = assertSameOrigin(req);
      expect(res).not.toBeNull();
      expect(res.status).toBe(403);
    });

    it('is disabled when DISABLE_SAME_ORIGIN=1', async () => {
      process.env.DISABLE_SAME_ORIGIN = '1';
      const { assertSameOrigin } = await import('@/lib/request-guard');
      const req = createRequest({
        origin: 'https://attacker.com',
        host: 'example.com',
      });
      expect(assertSameOrigin(req)).toBeNull();
    });
  });
});

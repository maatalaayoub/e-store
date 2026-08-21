import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared, hoisted state the mocks read from.
const h = vi.hoisted(() => ({ settingsRows: [] }));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), logSwallowed: vi.fn() },
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ in: async () => ({ data: h.settingsRows }) }),
    }),
  }),
}));

function setConfig({ token = 'TESTTOKEN', pnid = '123456', enabled = 'true', waba = '' } = {}) {
  h.settingsRows = [
    { key: 'whatsapp_access_token', value: token },
    { key: 'whatsapp_phone_number_id', value: pnid },
    { key: 'whatsapp_business_account_id', value: waba },
    { key: 'whatsapp_notifications_enabled', value: enabled },
  ];
}

function jsonResponse(ok, body, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

describe('whatsapp service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = 'unit-test-secret-key';
    setConfig();
    const { invalidateWhatsAppConfig } = await import('@/lib/whatsapp');
    invalidateWhatsAppConfig();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  });

  describe('normalizeWhatsAppPhone', () => {
    it('strips +, spaces and separators', async () => {
      const { normalizeWhatsAppPhone } = await import('@/lib/whatsapp');
      expect(normalizeWhatsAppPhone('+212 600-000-000')).toBe('212600000000');
    });

    it('drops the 00 international prefix', async () => {
      const { normalizeWhatsAppPhone } = await import('@/lib/whatsapp');
      expect(normalizeWhatsAppPhone('00212600000000')).toBe('212600000000');
    });

    it('replaces a leading national 0 with the default country code', async () => {
      const { normalizeWhatsAppPhone } = await import('@/lib/whatsapp');
      expect(normalizeWhatsAppPhone('0600000000', { defaultCountryCode: '212' })).toBe('212600000000');
    });

    it('returns null for implausible input', async () => {
      const { normalizeWhatsAppPhone } = await import('@/lib/whatsapp');
      expect(normalizeWhatsAppPhone('abc')).toBeNull();
      expect(normalizeWhatsAppPhone('123')).toBeNull();
      expect(normalizeWhatsAppPhone('')).toBeNull();
      expect(normalizeWhatsAppPhone(null)).toBeNull();
    });
  });

  describe('token encryption', () => {
    it('round-trips through encrypt/decrypt', async () => {
      const { encryptWhatsAppToken, decryptWhatsAppToken } = await import('@/lib/whatsapp');
      const env = encryptWhatsAppToken('super-secret-token');
      expect(env.startsWith('enc:')).toBe(true);
      expect(env).not.toContain('super-secret-token');
      expect(decryptWhatsAppToken(env)).toBe('super-secret-token');
    });

    it('treats non-prefixed values as legacy plaintext', async () => {
      const { decryptWhatsAppToken } = await import('@/lib/whatsapp');
      expect(decryptWhatsAppToken('plain')).toBe('plain');
    });

    it('returns empty string for empty input', async () => {
      const { encryptWhatsAppToken, decryptWhatsAppToken } = await import('@/lib/whatsapp');
      expect(encryptWhatsAppToken('')).toBe('');
      expect(decryptWhatsAppToken('')).toBe('');
    });
  });

  describe('sendWhatsAppText', () => {
    it('skips sending when not configured', async () => {
      setConfig({ token: '' });
      const { invalidateWhatsAppConfig, sendWhatsAppText } = await import('@/lib/whatsapp');
      invalidateWhatsAppConfig();
      const res = await sendWhatsAppText('+212600000000', 'hi');
      expect(res).toEqual({ ok: false, error: 'not_configured' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('skips sending when the integration is disabled', async () => {
      setConfig({ enabled: 'false' });
      const { invalidateWhatsAppConfig, sendWhatsAppText } = await import('@/lib/whatsapp');
      invalidateWhatsAppConfig();
      const res = await sendWhatsAppText('+212600000000', 'hi');
      expect(res).toEqual({ ok: false, error: 'disabled' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rejects an invalid phone number', async () => {
      const { sendWhatsAppText } = await import('@/lib/whatsapp');
      const res = await sendWhatsAppText('not-a-number', 'hi');
      expect(res).toEqual({ ok: false, error: 'invalid_phone' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('sends with a Bearer token and returns the message id', async () => {
      globalThis.fetch.mockResolvedValueOnce(jsonResponse(true, { messages: [{ id: 'wamid.ABC' }] }));
      const { sendWhatsAppText } = await import('@/lib/whatsapp');
      const res = await sendWhatsAppText('+212600000000', 'hello');
      expect(res).toEqual({ ok: true, messageId: 'wamid.ABC' });

      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/123456/messages');
      expect(opts.headers.Authorization).toBe('Bearer TESTTOKEN');
      const body = JSON.parse(opts.body);
      expect(body.to).toBe('212600000000');
      expect(body.type).toBe('text');
    });

    it('surfaces the Meta API error message on HTTP failure', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        jsonResponse(false, { error: { message: 'Invalid OAuth access token', code: 190 } }, 401),
      );
      const { sendWhatsAppText } = await import('@/lib/whatsapp');
      const res = await sendWhatsAppText('+212600000000', 'hello');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Invalid OAuth access token');
      expect(res.code).toBe(190);
    });

    it('does not retry a non-retryable error', async () => {
      globalThis.fetch.mockResolvedValue(
        jsonResponse(false, { error: { message: 'bad', code: 131_000 } }, 400),
      );
      const { sendWhatsAppText } = await import('@/lib/whatsapp');
      await sendWhatsAppText('+212600000000', 'hi');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries transient timeouts up to 3 attempts', async () => {
      globalThis.fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const { sendWhatsAppText } = await import('@/lib/whatsapp');
      const res = await sendWhatsAppText('+212600000000', 'hi');
      expect(res).toEqual({ ok: false, error: 'timeout' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('testWhatsAppConnection', () => {
    it('reports missing credentials without calling the API', async () => {
      setConfig({ token: '' });
      const { invalidateWhatsAppConfig, testWhatsAppConnection } = await import('@/lib/whatsapp');
      invalidateWhatsAppConfig();
      const res = await testWhatsAppConnection();
      expect(res).toEqual({ ok: false, error: 'missing_credentials' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns the verified name on success', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        jsonResponse(true, { verified_name: 'My Store', display_phone_number: '+212…', quality_rating: 'GREEN' }),
      );
      const { testWhatsAppConnection } = await import('@/lib/whatsapp');
      const res = await testWhatsAppConnection();
      expect(res.ok).toBe(true);
      expect(res.data.verified_name).toBe('My Store');
    });

    it('reports an error on HTTP failure', async () => {
      globalThis.fetch.mockResolvedValueOnce(
        jsonResponse(false, { error: { message: 'Unsupported get request', code: 100 } }, 400),
      );
      const { testWhatsAppConnection } = await import('@/lib/whatsapp');
      const res = await testWhatsAppConnection();
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Unsupported get request');
    });
  });
});

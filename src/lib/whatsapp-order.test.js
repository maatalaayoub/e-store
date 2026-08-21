import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  settings: {},
  insertResult: { data: { id: '1' }, error: null },
  logCalls: { insert: [], update: [], delete: [], upsert: [] },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), logSwallowed: vi.fn() },
}));

vi.mock('@/config/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://shop.test' },
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppTemplate: vi.fn(async () => ({ ok: true, messageId: 'wamid.1' })),
  buildTemplateBody: (vars = []) =>
    vars.length ? [{ type: 'body', parameters: vars.map((v) => ({ type: 'text', text: String(v) })) }] : [],
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table) => {
      if (table === 'store_settings') {
        return {
          select: () => ({
            eq: (_col, key) => ({
              single: async () => (key in h.settings ? { data: { value: h.settings[key] } } : { data: null }),
            }),
          }),
        };
      }
      // whatsapp_message_log
      return {
        insert: (row) => {
          h.logCalls.insert.push(row);
          return { select: () => ({ single: async () => h.insertResult }) };
        },
        update: (row) => {
          h.logCalls.update.push(row);
          return { eq: () => ({ eq: async () => ({ error: null }) }) };
        },
        delete: () => {
          h.logCalls.delete.push(true);
          return { eq: () => ({ eq: async () => ({ error: null }) }) };
        },
        upsert: (row, opts) => {
          h.logCalls.upsert.push({ row, opts });
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

const ORDER = {
  id: 'ord-uuid-1',
  order_number: 47382910,
  shipping_address: { full_name: 'Ahmed', phone: '+212600000000' },
};

function enableAll() {
  h.settings = {
    whatsapp_notifications_enabled: 'true',
    whatsapp_notify_created: 'true',
    whatsapp_notify_confirmed: 'true',
    whatsapp_notify_shipped: 'true',
    whatsapp_notify_cancelled: 'true',
    whatsapp_notify_invoice_ready: 'true',
    localization_default_language: 'en',
    whatsapp_default_country_code: '212',
  };
}

describe('whatsapp-order orchestration', () => {
  let sendWhatsAppTemplate;

  beforeEach(async () => {
    vi.clearAllMocks();
    h.settings = {};
    h.insertResult = { data: { id: '1' }, error: null };
    h.logCalls = { insert: [], update: [], delete: [], upsert: [] };
    ({ sendWhatsAppTemplate } = await import('@/lib/whatsapp'));
  });

  describe('statusToEvent', () => {
    it('maps customer-facing statuses and ignores pending', async () => {
      const { statusToEvent } = await import('@/lib/whatsapp-order');
      expect(statusToEvent('shipped')).toBe('shipped');
      expect(statusToEvent('cancelled')).toBe('cancelled');
      expect(statusToEvent('pending')).toBeNull();
      expect(statusToEvent('bogus')).toBeNull();
    });
  });

  describe('notifyOrderWhatsApp', () => {
    it('does nothing when the integration is globally disabled', async () => {
      enableAll();
      h.settings.whatsapp_notifications_enabled = 'false';
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'created', order: ORDER, shipping: ORDER.shipping_address });
      expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    it('respects the per-event toggle', async () => {
      enableAll();
      h.settings.whatsapp_notify_shipped = 'false';
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'shipped', order: ORDER, shipping: ORDER.shipping_address });
      expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    it('does not send when the customer has no phone', async () => {
      enableAll();
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'created', order: { ...ORDER, shipping_address: { full_name: 'X' } }, shipping: { full_name: 'X' } });
      expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    it('sends the correct template + variables and logs success', async () => {
      enableAll();
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'created', order: ORDER, shipping: ORDER.shipping_address });

      expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(1);
      const [to, template, opts] = sendWhatsAppTemplate.mock.calls[0];
      expect(to).toBe('+212600000000');
      expect(template.name).toBe('order_created');
      expect(template.languageCode).toBe('en_US');
      expect(template.components[0].parameters.map((p) => p.text)).toEqual(['Ahmed', '47382910']);
      expect(opts.defaultCountryCode).toBe('212');

      expect(h.logCalls.update[0]).toMatchObject({ status: 'sent', message_id: 'wamid.1' });
    });

    it('de-duplicates: a unique-violation claim skips the send', async () => {
      enableAll();
      h.insertResult = { data: null, error: { code: '23505' } };
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'confirmed', order: ORDER, shipping: ORDER.shipping_address });
      expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    it('still sends (best-effort) when the log table is missing', async () => {
      enableAll();
      h.insertResult = { data: null, error: { code: '42P01', message: 'relation "whatsapp_message_log" does not exist' } };
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'confirmed', order: ORDER, shipping: ORDER.shipping_address });
      expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(1);
      // No claim row was created, so nothing to update or delete.
      expect(h.logCalls.update).toHaveLength(0);
      expect(h.logCalls.delete).toHaveLength(0);
    });

    it('releases the claim when the send fails, allowing a retry', async () => {
      enableAll();
      sendWhatsAppTemplate.mockResolvedValueOnce({ ok: false, error: 'timeout' });
      const { notifyOrderWhatsApp } = await import('@/lib/whatsapp-order');
      await notifyOrderWhatsApp({ event: 'shipped', order: ORDER, shipping: ORDER.shipping_address });
      expect(h.logCalls.delete).toHaveLength(1);
      expect(h.logCalls.update).toHaveLength(0);
    });
  });

  describe('sendInvoiceWhatsApp', () => {
    it('builds a secure invoice URL and sends the invoice_ready template', async () => {
      enableAll();
      const { sendInvoiceWhatsApp } = await import('@/lib/whatsapp-order');
      const res = await sendInvoiceWhatsApp({ order: ORDER });

      expect(res.ok).toBe(true);
      const [to, template] = sendWhatsAppTemplate.mock.calls[0];
      expect(to).toBe('+212600000000');
      expect(template.name).toBe('invoice_ready');
      const texts = template.components[0].parameters.map((p) => p.text);
      expect(texts[0]).toBe('Ahmed');
      expect(texts[1]).toBe('47382910');
      expect(texts[2]).toBe('https://shop.test/en/invoice/ord-uuid-1');
      // Upserted (resendable) rather than claim-based.
      expect(h.logCalls.upsert).toHaveLength(1);
      expect(h.logCalls.upsert[0].opts).toMatchObject({ onConflict: 'order_id,event' });
    });

    it('returns disabled without sending when invoice notifications are off', async () => {
      enableAll();
      h.settings.whatsapp_notify_invoice_ready = 'false';
      const { sendInvoiceWhatsApp } = await import('@/lib/whatsapp-order');
      const res = await sendInvoiceWhatsApp({ order: ORDER });
      expect(res).toEqual({ ok: false, error: 'disabled' });
      expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    it('does not send when the order has no phone', async () => {
      enableAll();
      const { sendInvoiceWhatsApp } = await import('@/lib/whatsapp-order');
      const res = await sendInvoiceWhatsApp({ order: { ...ORDER, shipping_address: {} } });
      expect(res).toEqual({ ok: false, error: 'invalid_phone' });
      expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  normalizeEmail,
  normalizeName,
  normalizeAddress,
  buildCustomerClusters,
  findClusterById,
} from './customer-dedupe';

describe('normalizePhone', () => {
  it('keeps last 9 digits and strips formatting', () => {
    expect(normalizePhone('+212 6 12 34 56 78')).toBe('612345678');
    expect(normalizePhone('0612 345 678')).toBe('612345678');
    expect(normalizePhone('212612345678')).toBe('612345678');
  });
  it('returns null for garbage or too-short input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('lowercases and strips plus-tags', () => {
    expect(normalizeEmail('JOHN.doe+shop@Example.com')).toBe('john.doe@example.com');
  });
  it('canonicalises gmail addresses', () => {
    expect(normalizeEmail('J.O.H.N+promo@gmail.com')).toBe('john@gmail.com');
    expect(normalizeEmail('john@googlemail.com')).toBe('john@gmail.com');
  });
  it('rejects invalid emails', () => {
    expect(normalizeEmail('no-at-sign')).toBeNull();
    expect(normalizeEmail('@no-local')).toBeNull();
    expect(normalizeEmail('no-domain@')).toBeNull();
  });
});

describe('normalizeName', () => {
  it('is order-insensitive', () => {
    expect(normalizeName('John Doe')).toBe(normalizeName('Doe John'));
  });
  it('strips diacritics and punctuation', () => {
    expect(normalizeName('François  DUPONT.')).toBe(normalizeName('dupont francois'));
  });
});

describe('normalizeAddress', () => {
  it('strips common noise words while keeping distinctive tokens', () => {
    // "Rue" is noise; the apartment number stays because it's a real identifier.
    const a = normalizeAddress('12 Rue de la Paix, Apt 3');
    const b = normalizeAddress('12 de la paix 3');
    expect(a).toBe(b);
  });
  it('normalises punctuation and case so equivalent addresses match', () => {
    expect(normalizeAddress('12, Rue de la Paix')).toBe(
      normalizeAddress('12 rue de la paix')
    );
  });
});

describe('buildCustomerClusters', () => {
  it('merges a registered user with a guest order that shares a phone', () => {
    const users = [
      {
        id: 'u-1',
        full_name: 'Alice',
        email: 'alice@example.com',
        phone_number: '+212 6 12 34 56 78',
        role: 'client',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const orders = [
      {
        id: 'o-registered',
        user_id: 'u-1',
        total_amount: 100,
        status: 'delivered',
        created_at: '2024-02-01T00:00:00Z',
        shipping_address: { full_name: 'Alice', phone: '0612345678', city: 'Casa', address: '1 rue A' },
      },
      {
        id: 'o-guest',
        user_id: null,
        total_amount: 50,
        status: 'delivered',
        created_at: '2024-03-01T00:00:00Z',
        // typo in phone spacing but same digits
        shipping_address: { full_name: 'A. Alice', phone: '06 12 34 56 78', city: 'Casa', address: '2 rue A' },
      },
    ];

    const clusters = buildCustomerClusters({ users, orders });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('user');
    expect(clusters[0].id).toBe('u-1');
    expect(clusters[0].orders).toBe(2);
    expect(clusters[0].spent).toBe(150);
    expect(clusters[0].signals).toContain('phone');
  });

  it('merges two guest orders placed from the same device_id', () => {
    const orders = [
      {
        id: 'o-a',
        user_id: null,
        total_amount: 30,
        status: 'delivered',
        created_at: '2024-01-01T00:00:00Z',
        device_id: 'dev-42',
        shipping_address: { full_name: 'John', phone: '111', city: 'X', address: 'a' },
      },
      {
        id: 'o-b',
        user_id: null,
        total_amount: 70,
        status: 'delivered',
        created_at: '2024-02-01T00:00:00Z',
        device_id: 'dev-42',
        // very different contact details on purpose
        shipping_address: { full_name: 'Jane', phone: '999', city: 'Y', address: 'b' },
      },
    ];
    const clusters = buildCustomerClusters({ users: [], orders });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('guest');
    expect(clusters[0].signals).toContain('device');
    expect(clusters[0].orders).toBe(2);
    expect(clusters[0].guest_orders).toBe(2);
    // id anchors on the earliest order
    expect(clusters[0].id).toBe('guest:o-a');
  });

  it('does NOT merge two unrelated guest orders', () => {
    const orders = [
      {
        id: 'o-a',
        user_id: null,
        total_amount: 30,
        status: 'delivered',
        created_at: '2024-01-01T00:00:00Z',
        shipping_address: { full_name: 'Alice', phone: '111222333', city: 'X', address: 'a' },
      },
      {
        id: 'o-b',
        user_id: null,
        total_amount: 70,
        status: 'delivered',
        created_at: '2024-02-01T00:00:00Z',
        shipping_address: { full_name: 'Bob', phone: '444555666', city: 'Y', address: 'b' },
      },
    ];
    const clusters = buildCustomerClusters({ users: [], orders });
    expect(clusters).toHaveLength(2);
  });

  it('merges via gmail canonicalisation', () => {
    const users = [
      { id: 'u-1', email: 'j.o.h.n+promo@gmail.com', created_at: '2024-01-01Z' },
    ];
    const orders = [
      {
        id: 'o-1',
        user_id: null,
        total_amount: 10,
        status: 'delivered',
        created_at: '2024-02-01Z',
        shipping_address: { email: 'john@gmail.com', phone: '000000000', full_name: 'John' },
      },
    ];
    const clusters = buildCustomerClusters({ users, orders });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].signals).toContain('email');
  });

  it('excludes cancelled orders from spent + count but keeps them in order_ids', () => {
    const users = [{ id: 'u-1', email: 'a@b.co', created_at: '2024-01-01Z' }];
    const orders = [
      {
        id: 'o-1',
        user_id: 'u-1',
        total_amount: 100,
        status: 'cancelled',
        created_at: '2024-02-01Z',
        shipping_address: {},
      },
      {
        id: 'o-2',
        user_id: 'u-1',
        total_amount: 50,
        status: 'delivered',
        created_at: '2024-03-01Z',
        shipping_address: {},
      },
    ];
    const c = buildCustomerClusters({ users, orders })[0];
    expect(c.orders).toBe(1);
    expect(c.spent).toBe(50);
    expect(c.order_ids).toHaveLength(2);
  });
});

describe('findClusterById', () => {
  const clusters = [
    { id: 'u-1', kind: 'user', user_ids: ['u-1'], order_ids: ['o-1'] },
    { id: 'guest:o-x', kind: 'guest', user_ids: [], order_ids: ['o-x', 'o-y'] },
  ];
  it('finds a user cluster by uuid', () => {
    expect(findClusterById(clusters, 'u-1')?.id).toBe('u-1');
  });
  it('finds a guest cluster by any of its order ids', () => {
    expect(findClusterById(clusters, 'guest:o-x')?.id).toBe('guest:o-x');
    expect(findClusterById(clusters, 'guest:o-y')?.id).toBe('guest:o-x');
  });
  it('returns null for unknown ids', () => {
    expect(findClusterById(clusters, 'nope')).toBeNull();
    expect(findClusterById(clusters, 'guest:missing')).toBeNull();
  });
});

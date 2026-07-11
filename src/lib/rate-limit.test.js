import { describe, it, expect } from 'vitest';
import { getClientIp } from './rate-limit';

describe('getClientIp', () => {
  it('prefers x-real-ip', () => {
    const req = {
      headers: {
        get: (name) =>
          ({
            'x-real-ip': '1.2.3.4',
            'x-forwarded-for': '9.9.9.9, 8.8.8.8',
          })[name.toLowerCase()] ?? null,
      },
    };
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('uses rightmost x-forwarded-for entry', () => {
    const req = {
      headers: {
        get: (name) =>
          ({
            'x-forwarded-for': 'spoofed, 10.0.0.1, 192.168.1.1',
          })[name.toLowerCase()] ?? null,
      },
    };
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('falls back to leftmost x-forwarded-for when single hop', () => {
    const req = {
      headers: {
        get: (name) =>
          ({
            'x-forwarded-for': '172.16.0.1',
          })[name.toLowerCase()] ?? null,
      },
    };
    expect(getClientIp(req)).toBe('172.16.0.1');
  });

  it('returns null when no headers present', () => {
    const req = { headers: { get: () => null } };
    expect(getClientIp(req)).toBeNull();
  });
});

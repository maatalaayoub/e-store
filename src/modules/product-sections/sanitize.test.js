import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('allows safe formatting tags', () => {
    const input = '<p><strong>Bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(input)).toContain('<strong>Bold</strong>');
    expect(sanitizeHtml(input)).toContain('<em>italic</em>');
  });

  it('removes script tags and event handlers', () => {
    const input = `<p onclick="alert(1)">text</p><script>alert('xss')</script>`;
    const out = sanitizeHtml(input);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert');
  });

  it('removes javascript: hrefs', () => {
    const input = `<a href="javascript:alert(1)">click</a>`;
    const out = sanitizeHtml(input);
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('href');
  });

  it('adds rel and target to allowed links', () => {
    const input = `<a href="https://example.com">link</a>`;
    const out = sanitizeHtml(input);
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('href="https://example.com"');
  });

  it('returns null for empty input', () => {
    expect(sanitizeHtml('')).toBeNull();
    expect(sanitizeHtml(null)).toBeNull();
    expect(sanitizeHtml('   ')).toBeNull();
  });

  it('truncates excessively long input', () => {
    const input = '<p>' + 'a'.repeat(30000) + '</p>';
    const out = sanitizeHtml(input);
    expect(out.length).toBeLessThanOrEqual(25000);
  });
});

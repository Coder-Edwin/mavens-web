import { describe, it, expect } from 'vitest';
import { normalizeKenyanPhone, waLink } from './whatsapp';

describe('normalizeKenyanPhone', () => {
  it('normalises a local 07... number', () => {
    expect(normalizeKenyanPhone('0702101676')).toBe('254702101676');
  });

  it('normalises a local 01... number', () => {
    expect(normalizeKenyanPhone('0112345678')).toBe('254112345678');
  });

  it('normalises a number already in international form, with formatting', () => {
    expect(normalizeKenyanPhone('+254 702 101 676')).toBe('254702101676');
    expect(normalizeKenyanPhone('254-702-101-676')).toBe('254702101676');
  });

  it('normalises a bare 9-digit number missing the leading 0', () => {
    expect(normalizeKenyanPhone('702101676')).toBe('254702101676');
  });

  it('rejects something that is not a Kenyan mobile number', () => {
    expect(normalizeKenyanPhone('12345')).toBeNull();
    expect(normalizeKenyanPhone('')).toBeNull();
  });
});

describe('waLink', () => {
  it('builds a bare wa.me link with no message', () => {
    expect(waLink('0702101676')).toBe('https://wa.me/254702101676');
  });

  it('URL-encodes a pre-filled message', () => {
    expect(waLink('0702101676', 'Hi Mavens!')).toBe('https://wa.me/254702101676?text=Hi%20Mavens!');
  });

  it('returns null for a missing or unrecognisable number', () => {
    expect(waLink(null)).toBeNull();
    expect(waLink(undefined)).toBeNull();
    expect(waLink('not a phone')).toBeNull();
  });
});

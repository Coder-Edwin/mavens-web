// Amwai's WhatsApp Business API isn't set up yet, so quick-contact links use
// the no-integration-needed `wa.me` deep link scheme in the meantime — it
// opens a chat (WhatsApp app or web) pre-filled with an optional message.
// The club's own WhatsApp number is Safaricom 0702101676.
export const CLUB_WHATSAPP_NUMBER = '0702101676';

/// Normalises a Kenyan phone number (07XXXXXXXX, 01XXXXXXXX, +2547..., 2547...,
/// or with spaces/dashes) to the bare digits wa.me expects: 2547XXXXXXXX.
/// Returns null if it doesn't look like a Kenyan mobile number.
export function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return `254${digits}`;
  return null;
}

/// Builds a wa.me link for a phone number, optionally pre-filling a message.
/// Returns null when the number can't be normalised, so callers can hide the
/// link rather than send someone to a broken chat.
export function waLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const normalized = normalizeKenyanPhone(phone);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

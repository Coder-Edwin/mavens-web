import type { CSSProperties } from 'react';

// Shared form styling for the CRM admin screens, matching ArticlesAdmin's
// inline-style approach (the app has no form-component layer yet).
export const inputStyle: CSSProperties = {
  width: '100%',
  marginTop: 6,
  marginBottom: 14,
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--panel-alt)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  boxSizing: 'border-box'
};

export const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--muted)',
  letterSpacing: '0.04em',
  display: 'block'
};

export const mutedNote: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--muted)'
};

export const rowActions: CSSProperties = {
  textAlign: 'right',
  whiteSpace: 'nowrap'
};

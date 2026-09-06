import { useState } from 'react';

/**
 * Copies a URL to the clipboard with a short "Copied!" confirmation.
 * Falls back to selecting the text in a hidden field if the Clipboard API
 * isn't available (e.g. non-HTTPS in some browsers).
 */
export function CopyLinkButton({
  value,
  label = 'Copy invite link',
  className = 'btn btn-gold btn-sm'
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? 'Copied!' : label}
    </button>
  );
}

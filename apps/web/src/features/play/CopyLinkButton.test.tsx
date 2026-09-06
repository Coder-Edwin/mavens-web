import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyLinkButton } from './CopyLinkButton';

// JSDOM exposes navigator.clipboard as a getter-only property, so mock it with
// a configurable descriptor and restore the original after each test.
const writeText = vi.fn().mockResolvedValue(undefined);
const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

afterEach(() => {
  delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  if (original) Object.defineProperty(Navigator.prototype, 'clipboard', original);
});

describe('CopyLinkButton', () => {
  it('writes the value to the clipboard and confirms', async () => {
    render(<CopyLinkButton value="https://mavens.example/app/play/g1" />);

    fireEvent.click(screen.getByRole('button', { name: /copy invite link/i }));

    expect(writeText).toHaveBeenCalledWith('https://mavens.example/app/play/g1');
    expect(await screen.findByRole('button', { name: /copied!/i })).toBeInTheDocument();
  });

  it('honours a custom label', () => {
    render(<CopyLinkButton value="x" label="Copy game link" />);
    expect(screen.getByRole('button', { name: 'Copy game link' })).toBeInTheDocument();
  });
});

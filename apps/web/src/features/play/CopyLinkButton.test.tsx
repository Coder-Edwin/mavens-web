import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyLinkButton } from './CopyLinkButton';

describe('CopyLinkButton', () => {
  it('writes the value to the clipboard and confirms', async () => {
    // userEvent.setup() installs a clipboard stub we can read back from.
    const user = userEvent.setup();
    render(<CopyLinkButton value="https://mavens.example/app/play/g1" />);

    await user.click(screen.getByRole('button', { name: /copy invite link/i }));

    expect(await navigator.clipboard.readText()).toBe('https://mavens.example/app/play/g1');
    expect(await screen.findByRole('button', { name: /copied!/i })).toBeInTheDocument();
  });

  it('honours a custom label', () => {
    render(<CopyLinkButton value="x" label="Copy game link" />);
    expect(screen.getByRole('button', { name: 'Copy game link' })).toBeInTheDocument();
  });
});

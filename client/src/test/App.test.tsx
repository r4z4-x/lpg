import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '@/App';

beforeEach(() => {
  vi.restoreAllMocks();
  // Boot refresh fails → unauthenticated.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: { code: 'UNAUTHORIZED', message: 'no session' } }),
    }),
  );
});

describe('App', () => {
  it('redirects unauthenticated users to the login screen', async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument(),
    );
  });
});

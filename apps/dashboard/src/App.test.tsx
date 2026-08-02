import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const emptyReport = {
          topApps: [],
          counts: { battery: 0, locations: 0, calls: 0, notifications: 0 },
        };
        const body = url.includes('/reports/') ? emptyReport : [];

        return {
          ok: true,
          json: async () => body,
          text: async () => '',
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders the login page before authentication', () => {
    render(<App />);

    expect(screen.getByText('Family Monitor')).toBeInTheDocument();
    expect(screen.getByText('Admin login')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('renders the admin dashboard shell after authentication', async () => {
    localStorage.setItem('accessToken', 'test-token');

    render(<App />);

    expect(screen.getByRole('button', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByText('Registered devices')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Live backend data')).toBeInTheDocument());
  });
});

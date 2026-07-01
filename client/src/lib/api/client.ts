import type { Envelope } from './types';

/** All API calls go through the Vite proxy under this prefix (see vite.config.ts). */
export const API_PREFIX = '/api';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unexpected error';
}

// --- In-memory access token (never persisted to storage) ---
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

// --- Single-flight refresh ---
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as Envelope<{ accessToken: string }> | null;
        if (res.ok && body?.ok) {
          accessToken = body.data.accessToken;
          return true;
        }
        accessToken = null;
        return false;
      })
      .catch(() => {
        accessToken = null;
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** internal: set when a request is being retried after a refresh */
  _retried?: boolean;
}

/**
 * Performs an API request: attaches the bearer token, unwraps the `{ok,data}` envelope,
 * and on a 401 transparently refreshes the access token once before retrying.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options._retried && path !== '/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, { ...options, _retried: true });
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok || !body || body.ok === false) {
    const error = body && body.ok === false ? body.error : undefined;
    throw new ApiError(
      error?.code ?? `HTTP_${res.status}`,
      error?.message ?? res.statusText ?? 'Request failed',
      res.status,
      error?.details,
    );
  }

  return body.data;
}

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { request, setAccessToken, ApiError } from '@/lib/api/client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('API client', () => {
  it('unwraps the success envelope and hits the proxied prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, data: { x: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await request<{ x: number }>('/health');
    expect(data).toEqual({ x: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ method: 'GET' }));
  });

  it('refreshes the token on 401 and retries once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'x' } }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, data: { done: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await request<{ done: boolean }>('/sales');
    expect(data).toEqual({ done: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The retry carried the refreshed bearer token.
    const retryCall = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryCall.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
  });

  it('throws a typed ApiError on a non-401 failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { ok: false, error: { code: 'VALIDATION_ERROR', message: 'bad' } }),
      ),
    );
    await expect(request('/x', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
    await expect(request('/x', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpClient, setUnauthorizedHandler } from './httpClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('httpClient', () => {
  beforeEach(() => {
    localStorage.clear();
    setUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws ApiError with the backend message when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(400, { message: 'Dados inválidos' })),
    );

    await expect(httpClient.get('/qualquer-coisa')).rejects.toMatchObject({
      status: 400,
      message: 'Dados inválidos',
    });
  });

  it('falls back to statusText when the error body has no message field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpClient.get('/qualquer-coisa')).rejects.toThrow('Internal Server Error');
  });

  it('automatically refreshes the access token on a 401 and retries the original request once', async () => {
    localStorage.setItem('accessToken', 'token-antigo');
    localStorage.setItem('refreshToken', 'refresh-valido');

    const fetchMock = vi
      .fn()
      // 1st call: original request fails with 401
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }))
      // 2nd call: refresh succeeds
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'token-novo', refreshToken: 'refresh-novo' }),
      )
      // 3rd call: retried original request succeeds
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await httpClient.get<{ ok: boolean }>('/protegido');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('accessToken')).toBe('token-novo');

    // The retried request must use the freshly refreshed token.
    const retryCall = fetchMock.mock.calls[2];
    const retryHeaders = retryCall[1]?.headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer token-novo');
  });

  it('clears tokens and calls the unauthorized handler when the refresh attempt also fails', async () => {
    localStorage.setItem('accessToken', 'token-antigo');
    localStorage.setItem('refreshToken', 'refresh-invalido');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Não autorizado' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Refresh inválido' }));
    vi.stubGlobal('fetch', fetchMock);

    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(httpClient.get('/protegido')).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('never attempts a refresh for auth endpoints themselves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Credenciais inválidas' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpClient.post('/auth/login', { email: 'a@a.com', senha: 'x' })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

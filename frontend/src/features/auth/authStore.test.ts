import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '../../lib/api/httpClient';
import { authStore } from './authStore';

vi.mock('../../lib/api/httpClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/httpClient')>('../../lib/api/httpClient');
  return {
    ...actual,
    httpClient: {
      ...actual.httpClient,
      post: vi.fn(),
    },
  };
});

const usuario = {
  id: 'u1',
  nome: 'Fulano',
  email: 'fulano@example.com',
  papel: 'admin' as const,
  ativo: true,
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    authStore.logout();
    vi.mocked(httpClient.post).mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('persists usuario and tokens to localStorage on successful login', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({
      usuario,
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
    });

    const result = await authStore.login('fulano@example.com', 'senha-secreta');

    expect(result).toEqual(usuario);
    expect(authStore.getState().usuario).toEqual(usuario);
    expect(authStore.getState().accessToken).toBe('access-123');
    expect(localStorage.getItem('accessToken')).toBe('access-123');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-123');
    expect(JSON.parse(localStorage.getItem('usuario')!)).toEqual(usuario);
  });

  it('propagates login errors without mutating the store', async () => {
    vi.mocked(httpClient.post).mockRejectedValue(new Error('credenciais inválidas'));

    await expect(authStore.login('fulano@example.com', 'errada')).rejects.toThrow('credenciais inválidas');
    expect(authStore.getState().usuario).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('clears usuario and tokens from both state and localStorage on logout', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({
      usuario,
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
    });
    await authStore.login('fulano@example.com', 'senha-secreta');

    authStore.logout();

    expect(authStore.getState()).toEqual({ usuario: null, accessToken: null, refreshToken: null });
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('usuario')).toBeNull();
  });

  it('notifies subscribers when the state changes', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({
      usuario,
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
    });
    const listener = vi.fn();
    const unsubscribe = authStore.subscribe(listener);

    await authStore.login('fulano@example.com', 'senha-secreta');

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

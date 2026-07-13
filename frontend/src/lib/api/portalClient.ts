import axios from 'axios';

export function createPortalClient(token: string) {
  return axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3333',
    headers: { 'x-portal-token': token },
  });
}

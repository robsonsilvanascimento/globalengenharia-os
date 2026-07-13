import { http, HttpResponse } from 'msw';

export const relatorioHandlers = [
  http.post('*/relatorio-gerencial/config', async () => {
    return HttpResponse.json({ ok: true });
  }),
];

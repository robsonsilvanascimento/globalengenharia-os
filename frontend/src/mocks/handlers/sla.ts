import { http, HttpResponse } from 'msw';
import type { SlaConfig } from '../../types/sla';

const slaConfigs: SlaConfig[] = [
  { prioridade: 'urgente', prazo_horas: 4 },
  { prioridade: 'alta', prazo_horas: 8 },
  { prioridade: 'normal', prazo_horas: 48 },
  { prioridade: 'baixa', prazo_horas: 120 },
];

export const slaHandlers = [
  http.get('*/sla/config', () => {
    return HttpResponse.json(slaConfigs);
  }),

  http.patch('*/sla/config', async ({ request }) => {
    const body = (await request.json()) as SlaConfig[];
    body.forEach((item) => {
      const existing = slaConfigs.find((c) => c.prioridade === item.prioridade);
      if (existing) {
        existing.prazo_horas = item.prazo_horas;
      }
    });
    return HttpResponse.json({ ok: true });
  }),
];

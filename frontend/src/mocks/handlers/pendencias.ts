import { http, HttpResponse } from 'msw';
import type { PendenciaOS } from '../../types/api';

const pendenciasMock: PendenciaOS[] = [
  {
    id: 'pend-1',
    ordem_servico_id: 'os-1',
    observacao: 'Falta de material: cabo 6mm² não disponível no estoque local',
    criado_por_id: 'user-1',
    criado_por_nome: 'João Técnico',
    criado_em: new Date(Date.now() - 86400000).toISOString(),
    fotos: [
      {
        id: 'foto-pend-1',
        pendencia_id: 'pend-1',
        mime_type: 'image/jpeg',
        base64: '',
        criado_em: new Date().toISOString(),
      },
    ],
  },
];

export const pendenciasHandlers = [
  http.get('*/ordens-servico/:id/pendencias', () => {
    return HttpResponse.json(pendenciasMock);
  }),
  http.post('*/ordens-servico/:id/pendencias', async ({ request }) => {
    const body = (await request.json()) as {
      observacao: string;
      fotos: Array<{ mime_type: string; base64: string }>;
    };
    const nova: PendenciaOS = {
      id: `pend-${Date.now()}`,
      ordem_servico_id: 'os-1',
      observacao: body.observacao,
      criado_por_id: 'user-1',
      criado_por_nome: 'João Técnico',
      criado_em: new Date().toISOString(),
      fotos: body.fotos.map((f, i) => ({
        id: `foto-${Date.now()}-${i}`,
        pendencia_id: `pend-${Date.now()}`,
        mime_type: f.mime_type,
        base64: f.base64,
        criado_em: new Date().toISOString(),
      })),
    };
    return HttpResponse.json(nova, { status: 201 });
  }),
];

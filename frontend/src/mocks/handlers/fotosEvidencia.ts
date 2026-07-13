import { http, HttpResponse } from 'msw';
import type { FotosEvidenciaResponse } from '../../types/api';

export const fotosEvidenciaHandlers = [
  http.get('*/ordens-servico/:id/fotos-servico', () => {
    const response: FotosEvidenciaResponse = {
      fotos: [
        {
          id: 'foto-ev-1',
          ordem_servico_id: 'os-1',
          mime_type: 'image/jpeg',
          base64: '',
          legenda: 'Quadro elétrico após instalação',
          enviado_por_nome: 'João Técnico',
          criado_em: new Date().toISOString(),
        },
      ],
    };
    return HttpResponse.json(response);
  }),
  http.post('*/ordens-servico/:id/fotos-servico', async ({ request }) => {
    const body = (await request.json()) as { mime_type: string; base64: string; legenda?: string };
    return HttpResponse.json(
      {
        id: `foto-ev-${Date.now()}`,
        ordem_servico_id: 'os-1',
        mime_type: body.mime_type,
        base64: body.base64,
        legenda: body.legenda ?? null,
        enviado_por_nome: 'João Técnico',
        criado_em: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
];

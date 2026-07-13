import { http, HttpResponse } from 'msw';
import type { AlertaGarantia } from '../../types/alerta';

const alertas: AlertaGarantia[] = [
  {
    id: 'alerta-1',
    componente_id: 'comp-1',
    componente_nome: 'Inversor Solar Fronius 5kW',
    dias_restantes: 45,
    os_id: 'os-10',
    os_numero: 'OS-0010',
    lido: true,
    criado_em: '2025-05-20T10:00:00.000Z',
  },
  {
    id: 'alerta-2',
    componente_id: 'comp-2',
    componente_nome: 'Disjuntor Tripolar 63A',
    dias_restantes: 12,
    os_id: 'os-22',
    os_numero: 'OS-0022',
    lido: false,
    criado_em: '2025-06-15T08:30:00.000Z',
  },
  {
    id: 'alerta-3',
    componente_id: 'comp-3',
    componente_nome: 'Nobreak APC 1500VA',
    dias_restantes: 3,
    os_id: null,
    os_numero: null,
    lido: false,
    criado_em: '2025-07-01T14:00:00.000Z',
  },
];

export const alertasHandlers = [
  http.get('*/alertas-garantia', () => {
    return HttpResponse.json(alertas);
  }),

  http.patch('*/alertas-garantia/:id/lido', ({ params }) => {
    const alerta = alertas.find((item) => item.id === params.id);
    if (alerta) {
      alerta.lido = true;
    }
    return HttpResponse.json({ ok: true });
  }),
];

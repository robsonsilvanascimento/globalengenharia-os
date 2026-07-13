import { http, HttpResponse } from 'msw';
import type { HistoricoOSClienteResponse } from '../../types/api';

export const historicoClienteHandlers = [
  http.get('*/clientes/:clienteId/historico-os', () => {
    const response: HistoricoOSClienteResponse = {
      items: [
        {
          id: 'os-anterior-1',
          numero: '20260601',
          status: 'concluida',
          prioridade: 'normal',
          descricao_problema: 'Instalação de tomadas no escritório',
          categoria_nome: 'Instalação Elétrica',
          tecnico_nome: 'João Técnico',
          valor_cobrado: 350,
          criado_em: new Date(Date.now() - 30 * 86400000).toISOString(),
          fechado_em: new Date(Date.now() - 28 * 86400000).toISOString(),
        },
        {
          id: 'os-anterior-2',
          numero: '20260501',
          status: 'concluida',
          prioridade: 'alta',
          descricao_problema: 'Troca de quadro de distribuição',
          categoria_nome: 'Manutenção Elétrica',
          tecnico_nome: 'Carlos Ajudante',
          valor_cobrado: 800,
          criado_em: new Date(Date.now() - 60 * 86400000).toISOString(),
          fechado_em: new Date(Date.now() - 58 * 86400000).toISOString(),
        },
      ],
    };
    return HttpResponse.json(response);
  }),
];

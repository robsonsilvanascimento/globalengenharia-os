import { http, HttpResponse } from 'msw';
import type { AnalyticsResumo } from '../../types/analytics';

const resumo: AnalyticsResumo = {
  os_por_mes: [
    { mes: '2024-08', total: 12 },
    { mes: '2024-09', total: 18 },
    { mes: '2024-10', total: 15 },
    { mes: '2024-11', total: 22 },
    { mes: '2024-12', total: 9 },
    { mes: '2025-01', total: 14 },
    { mes: '2025-02', total: 19 },
    { mes: '2025-03', total: 25 },
    { mes: '2025-04', total: 21 },
    { mes: '2025-05', total: 30 },
    { mes: '2025-06', total: 27 },
    { mes: '2025-07', total: 11 },
  ],
  receita_por_mes: [
    { mes: '2024-08', valor: 4800 },
    { mes: '2024-09', valor: 7200 },
    { mes: '2024-10', valor: 6000 },
    { mes: '2024-11', valor: 8800 },
    { mes: '2024-12', valor: 3600 },
    { mes: '2025-01', valor: 5600 },
    { mes: '2025-02', valor: 7600 },
    { mes: '2025-03', valor: 10000 },
    { mes: '2025-04', valor: 8400 },
    { mes: '2025-05', valor: 12000 },
    { mes: '2025-06', valor: 10800 },
    { mes: '2025-07', valor: 4400 },
  ],
  os_por_status: [
    { status: 'aberta', total: 8 },
    { status: 'triagem', total: 4 },
    { status: 'atribuida', total: 6 },
    { status: 'em_andamento', total: 5 },
    { status: 'aguardando_peca', total: 3 },
    { status: 'concluida', total: 180 },
    { status: 'cancelada', total: 17 },
  ],
  ranking_tecnicos: [
    { tecnico_id: 'tec-1', nome: 'Carlos Souza', concluidas: 72 },
    { tecnico_id: 'tec-2', nome: 'Fernanda Lima', concluidas: 61 },
    { tecnico_id: 'tec-3', nome: 'Ricardo Alves', concluidas: 47 },
  ],
  tmr_por_categoria: [
    { categoria: 'Elétrica Predial', horas: 5.2 },
    { categoria: 'Automação Industrial', horas: 8.7 },
    { categoria: 'Energia Solar', horas: 12.4 },
    { categoria: 'Outro', horas: 3.1 },
  ],
  tmr_por_tecnico: [
    { tecnico_id: 'tec-1', nome: 'Carlos Souza', horas: 6.3 },
    { tecnico_id: 'tec-2', nome: 'Fernanda Lima', horas: 5.1 },
    { tecnico_id: 'tec-3', nome: 'Ricardo Alves', horas: 7.8 },
  ],
  tmr_por_prioridade: [
    { prioridade: 'urgente', horas: 2.1 },
    { prioridade: 'alta', horas: 4.5 },
    { prioridade: 'normal', horas: 7.2 },
    { prioridade: 'baixa', horas: 11.0 },
  ],
};

export const analyticsHandlers = [
  http.get('*/analytics/resumo', () => {
    return HttpResponse.json(resumo);
  }),
];

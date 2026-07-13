import { http, HttpResponse } from 'msw';
import type { RespostaChecklist, TemplateChecklist } from '../../types/api';

const templatesMock: TemplateChecklist[] = [
  {
    id: 'tmpl-1',
    categoria_servico_id: 'cat-1',
    titulo: 'Checklist NR-10 — Instalação Elétrica',
    itens: [
      { id: 'item-1', template_id: 'tmpl-1', descricao: 'Verificou aterramento conforme NR-10', ordem: 1 },
      { id: 'item-2', template_id: 'tmpl-1', descricao: 'Testou disjuntores de proteção', ordem: 2 },
      { id: 'item-3', template_id: 'tmpl-1', descricao: 'Mediu tensão de linha e fase', ordem: 3 },
      { id: 'item-4', template_id: 'tmpl-1', descricao: 'Utilizou EPI adequado durante o serviço', ordem: 4 },
    ],
  },
];

const respostasMock: RespostaChecklist[] = [];

export const checklistHandlers = [
  http.get('*/checklist/templates', () => {
    return HttpResponse.json(templatesMock);
  }),
  http.post('*/checklist/templates', async ({ request }) => {
    const body = (await request.json()) as TemplateChecklist;
    return HttpResponse.json({ ...body, id: `tmpl-${Date.now()}` }, { status: 201 });
  }),
  http.get('*/ordens-servico/:id/checklist', () => {
    return HttpResponse.json({ template: templatesMock[0], respostas: respostasMock });
  }),
  http.put('*/ordens-servico/:id/checklist', async ({ request }) => {
    const body = (await request.json()) as { respostas: Array<{ item_id: string; marcado: boolean }> };
    const respostas: RespostaChecklist[] = body.respostas.map((r) => ({
      item_id: r.item_id,
      marcado: r.marcado,
    }));
    return HttpResponse.json(respostas);
  }),
];

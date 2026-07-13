import type {
  Cliente,
  CategoriaServico,
  EstimativaCustoOS,
  FaqEntry,
  HistoricoStatusOS,
  MidiaOrdemServico,
  OrdemServico,
  SolicitacaoAtendimento,
  Usuario,
} from '../types/api';

/** Usuario mockado com senha em texto puro, usado apenas internamente pelos handlers de auth. */
export interface MockUsuario extends Usuario {
  senha: string;
}

export const usuarios: MockUsuario[] = [
  {
    id: 'usr-1',
    nome: 'Ana Souza',
    email: 'admin@teste.com',
    papel: 'admin',
    ativo: true,
    telefone: '+5511990001111',
    senha: '123456',
  },
  {
    id: 'usr-2',
    nome: 'Bruno Lima',
    email: 'atendente@teste.com',
    papel: 'atendente',
    ativo: true,
    telefone: '+5511990002222',
    senha: '123456',
  },
  {
    id: 'usr-3',
    nome: 'Carlos Pereira',
    email: 'tecnico@teste.com',
    papel: 'tecnico',
    ativo: true,
    telefone: '+5511990003333',
    valorHora: 80,
    senha: '123456',
  },
  {
    id: 'usr-4',
    nome: 'Diego Martins',
    email: 'ajudante@teste.com',
    papel: 'ajudante',
    ativo: true,
    telefone: '+5511990004444',
    valorHora: 35,
    senha: '123456',
  },
];

export const clientes: Cliente[] = [
  {
    id: 'cli-1',
    nome: 'Joana Ferreira',
    telefone_whatsapp: '+5511987654321',
    email: 'joana.ferreira@example.com',
    documento: '123.456.789-00',
    criado_em: '2026-05-10T09:00:00.000Z',
  },
  {
    id: 'cli-2',
    nome: 'Mercado Bom Preço Ltda',
    telefone_whatsapp: '+5511976543210',
    email: 'contato@bompreco.example.com',
    documento: '12.345.678/0001-90',
    criado_em: '2026-05-15T14:30:00.000Z',
  },
  {
    id: 'cli-3',
    nome: 'Ricardo Alves',
    telefone_whatsapp: '+5511965432109',
    criado_em: '2026-06-01T11:15:00.000Z',
  },
];

export const categoriasServico: CategoriaServico[] = [
  { id: 'cat-1', nome: 'Instalação elétrica residencial/comercial', area: 'eletrica', ativo: true },
  { id: 'cat-2', nome: 'Manutenção e reparo elétrico', area: 'eletrica', ativo: true },
  { id: 'cat-3', nome: 'Quadro de distribuição/disjuntores', area: 'eletrica', ativo: true },
  { id: 'cat-4', nome: 'Iluminação', area: 'eletrica', ativo: true },
  { id: 'cat-5', nome: 'Laudo técnico/inspeção elétrica NR10', area: 'eletrica', ativo: true },
  { id: 'cat-6', nome: 'Automação residencial', area: 'automacao', ativo: true },
  { id: 'cat-7', nome: 'Automação industrial', area: 'automacao', ativo: true },
  { id: 'cat-8', nome: 'Automação de portões e cercas', area: 'automacao', ativo: true },
  { id: 'cat-9', nome: 'CFTV/segurança eletrônica', area: 'automacao', ativo: true },
  { id: 'cat-10', nome: 'Projeto e instalação de sistema fotovoltaico', area: 'energia_solar', ativo: true },
  { id: 'cat-11', nome: 'Manutenção e limpeza de painéis solares', area: 'energia_solar', ativo: true },
  {
    id: 'cat-12',
    nome: 'Vistoria e homologação junto à concessionária',
    area: 'energia_solar',
    ativo: true,
  },
  { id: 'cat-13', nome: 'Ampliação de sistema solar existente', area: 'energia_solar', ativo: true },
  { id: 'cat-14', nome: 'Outros serviços', area: 'outro', ativo: true },
];

const tecnico = usuarios.find((usuario) => usuario.papel === 'tecnico') as MockUsuario;

export const ordensServico: OrdemServico[] = [
  {
    id: 'os-1',
    numero: 'OS-0001',
    cliente_id: 'cli-1',
    cliente_nome: 'Joana Ferreira',
    categoria_servico_id: 'cat-2',
    descricao_problema: 'Tomadas da cozinha sem energia após queda de luz.',
    endereco_atendimento: 'Rua das Flores, 123 - São Paulo/SP',
    status: 'aberta',
    prioridade: 'alta',
    criado_em: '2026-07-01T10:00:00.000Z',
    atualizado_em: '2026-07-01T10:00:00.000Z',
  },
  {
    id: 'os-2',
    numero: 'OS-0002',
    cliente_id: 'cli-2',
    cliente_nome: 'Mercado Bom Preço Ltda',
    categoria_servico_id: 'cat-3',
    descricao_problema: 'Disjuntor geral desarmando com frequência.',
    endereco_atendimento: 'Av. Comercial, 456 - São Paulo/SP',
    status: 'triagem',
    prioridade: 'urgente',
    criado_em: '2026-07-02T09:30:00.000Z',
    atualizado_em: '2026-07-02T11:00:00.000Z',
  },
  {
    id: 'os-3',
    numero: 'OS-0003',
    cliente_id: 'cli-3',
    cliente_nome: 'Ricardo Alves',
    categoria_servico_id: 'cat-6',
    descricao_problema: 'Instalação de automação para portão de garagem.',
    endereco_atendimento: 'Rua dos Ipês, 789 - São Paulo/SP',
    status: 'atribuida',
    prioridade: 'normal',
    tecnico_id: tecnico.id,
    tecnico_nome: tecnico.nome,
    criado_em: '2026-07-02T14:00:00.000Z',
    atualizado_em: '2026-07-03T08:00:00.000Z',
  },
  {
    id: 'os-4',
    numero: 'OS-0004',
    cliente_id: 'cli-1',
    cliente_nome: 'Joana Ferreira',
    categoria_servico_id: 'cat-10',
    descricao_problema: 'Instalação de sistema fotovoltaico residencial de 5kWp.',
    endereco_atendimento: 'Rua das Flores, 123 - São Paulo/SP',
    status: 'em_andamento',
    prioridade: 'normal',
    tecnico_id: tecnico.id,
    tecnico_nome: tecnico.nome,
    criado_em: '2026-06-28T13:00:00.000Z',
    atualizado_em: '2026-07-04T09:00:00.000Z',
  },
  {
    id: 'os-5',
    numero: 'OS-0005',
    cliente_id: 'cli-2',
    cliente_nome: 'Mercado Bom Preço Ltda',
    categoria_servico_id: 'cat-9',
    descricao_problema: 'Instalação de CFTV com 8 câmeras, aguardando chegada dos cabos.',
    endereco_atendimento: 'Av. Comercial, 456 - São Paulo/SP',
    status: 'aguardando_peca',
    prioridade: 'baixa',
    tecnico_id: tecnico.id,
    tecnico_nome: tecnico.nome,
    criado_em: '2026-06-20T10:00:00.000Z',
    atualizado_em: '2026-07-05T15:00:00.000Z',
  },
  {
    id: 'os-6',
    numero: 'OS-0006',
    cliente_id: 'cli-3',
    cliente_nome: 'Ricardo Alves',
    categoria_servico_id: 'cat-11',
    descricao_problema: 'Limpeza e manutenção preventiva de painéis solares.',
    endereco_atendimento: 'Rua dos Ipês, 789 - São Paulo/SP',
    status: 'concluida',
    prioridade: 'baixa',
    tecnico_id: tecnico.id,
    tecnico_nome: tecnico.nome,
    valor_cobrado: 250,
    criado_em: '2026-06-10T08:00:00.000Z',
    atualizado_em: '2026-06-15T17:00:00.000Z',
  },
  {
    id: 'os-7',
    numero: 'OS-0007',
    cliente_id: 'cli-1',
    cliente_nome: 'Joana Ferreira',
    categoria_servico_id: 'cat-5',
    descricao_problema: 'Solicitação de laudo técnico NR10 cancelada pelo cliente.',
    endereco_atendimento: 'Rua das Flores, 123 - São Paulo/SP',
    status: 'cancelada',
    prioridade: 'normal',
    criado_em: '2026-06-05T12:00:00.000Z',
    atualizado_em: '2026-06-06T09:00:00.000Z',
  },
  {
    id: 'os-8',
    numero: 'OS-0008',
    cliente_id: 'cli-1',
    cliente_nome: 'Joana Ferreira',
    categoria_servico_id: 'cat-2',
    descricao_problema: 'Troca de disjuntor queimado no quadro de distribuição.',
    endereco_atendimento: 'Rua das Flores, 123 - São Paulo/SP',
    status: 'concluida',
    prioridade: 'normal',
    tecnico_id: tecnico.id,
    tecnico_nome: tecnico.nome,
    valor_cobrado: 380,
    criado_em: '2026-05-20T10:00:00.000Z',
    atualizado_em: '2026-05-21T16:00:00.000Z',
  },
  {
    id: 'os-9',
    numero: 'OS-0009',
    cliente_id: 'cli-2',
    cliente_nome: 'Mercado Bom Preço Ltda',
    categoria_servico_id: 'cat-1',
    descricao_problema: 'Instalação elétrica completa de novo ponto de venda.',
    endereco_atendimento: 'Av. Comercial, 456 - São Paulo/SP',
    status: 'concluida',
    prioridade: 'alta',
    tecnico_id: tecnico.id,
    tecnico_nome: tecnico.nome,
    valor_cobrado: 1200,
    criado_em: '2026-05-25T08:00:00.000Z',
    atualizado_em: '2026-05-30T18:00:00.000Z',
  },
];

export const historicoStatusOS: HistoricoStatusOS[] = [
  {
    id: 'hist-1',
    ordem_servico_id: 'os-2',
    status_anterior: 'aberta',
    status_novo: 'triagem',
    alterado_por_usuario_id: 'usr-2',
    alterado_por_bot: false,
    observacao: 'Encaminhado para triagem técnica.',
    criado_em: '2026-07-02T11:00:00.000Z',
  },
  {
    id: 'hist-2',
    ordem_servico_id: 'os-3',
    status_anterior: 'triagem',
    status_novo: 'atribuida',
    alterado_por_usuario_id: 'usr-1',
    alterado_por_bot: false,
    observacao: 'Atribuída ao técnico Carlos Pereira.',
    criado_em: '2026-07-03T08:00:00.000Z',
  },
  {
    id: 'hist-3',
    ordem_servico_id: 'os-4',
    status_anterior: 'atribuida',
    status_novo: 'em_andamento',
    alterado_por_usuario_id: 'usr-3',
    alterado_por_bot: false,
    observacao: 'Técnico iniciou o atendimento.',
    criado_em: '2026-07-04T09:00:00.000Z',
  },
  {
    id: 'hist-4',
    ordem_servico_id: 'os-5',
    status_anterior: 'em_andamento',
    status_novo: 'aguardando_peca',
    alterado_por_usuario_id: 'usr-3',
    alterado_por_bot: false,
    observacao: 'Aguardando chegada dos cabos de rede.',
    criado_em: '2026-07-05T15:00:00.000Z',
  },
  {
    id: 'hist-5',
    ordem_servico_id: 'os-6',
    status_anterior: 'em_andamento',
    status_novo: 'concluida',
    alterado_por_usuario_id: 'usr-3',
    alterado_por_bot: false,
    observacao: 'Serviço finalizado com sucesso.',
    criado_em: '2026-06-15T17:00:00.000Z',
  },
  {
    id: 'hist-6',
    ordem_servico_id: 'os-7',
    status_anterior: 'aberta',
    status_novo: 'cancelada',
    alterado_por_bot: true,
    observacao: 'Cancelada automaticamente a pedido do cliente via WhatsApp.',
    criado_em: '2026-06-06T09:00:00.000Z',
  },
];

let ordemServicoSequence = ordensServico.length;

export function nextOrdemServicoId(): string {
  ordemServicoSequence += 1;
  return `os-${ordemServicoSequence}`;
}

export function nextOrdemServicoNumero(): string {
  return `OS-${String(ordemServicoSequence).padStart(4, '0')}`;
}

let historicoSequence = historicoStatusOS.length;

export function nextHistoricoId(): string {
  historicoSequence += 1;
  return `hist-${historicoSequence}`;
}

let usuarioSequence = usuarios.length;

export function nextUsuarioId(): string {
  usuarioSequence += 1;
  return `usr-${usuarioSequence}`;
}

let clienteSequence = clientes.length;

export function nextClienteId(): string {
  clienteSequence += 1;
  return `cli-${clienteSequence}`;
}

let categoriaSequence = categoriasServico.length;

export function nextCategoriaId(): string {
  categoriaSequence += 1;
  return `cat-${categoriaSequence}`;
}

export const faqEntries: FaqEntry[] = [
  {
    id: 'faq-1',
    pergunta: 'Vocês atendem em quais cidades?',
    resposta:
      'Atendemos toda a região metropolitana de São Paulo. Para outras localidades, consulte disponibilidade pelo WhatsApp.',
    tags: 'atendimento, cobertura',
    ativo: true,
    criado_em: '2026-06-01T09:00:00.000Z',
    atualizado_em: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'faq-2',
    pergunta: 'Qual o prazo médio de atendimento após abrir uma ordem de serviço?',
    resposta:
      'Para chamados de prioridade alta ou urgente, o prazo médio é de até 24 horas. Para serviços de instalação e projetos (ex.: energia solar), o prazo é combinado na visita técnica.',
    tags: 'prazo, ordem de serviço',
    ativo: true,
    criado_em: '2026-06-02T10:00:00.000Z',
    atualizado_em: '2026-06-02T10:00:00.000Z',
  },
  {
    id: 'faq-3',
    pergunta: 'Como funciona a instalação de energia solar residencial?',
    resposta:
      'Fazemos uma vistoria inicial, dimensionamento do sistema fotovoltaico, instalação dos painéis e inversor, e cuidamos da homologação junto à concessionária de energia.',
    tags: 'energia solar, instalação',
    ativo: true,
    criado_em: '2026-06-03T11:00:00.000Z',
    atualizado_em: '2026-06-03T11:00:00.000Z',
  },
  {
    id: 'faq-4',
    pergunta: 'Vocês fazem automação de portões e cercas elétricas?',
    resposta:
      'Sim, instalamos e damos manutenção em automação de portões, cercas elétricas e sistemas de CFTV/segurança eletrônica, residenciais e comerciais.',
    tags: 'automação, segurança',
    ativo: true,
    criado_em: '2026-06-04T12:00:00.000Z',
    atualizado_em: '2026-06-04T12:00:00.000Z',
  },
  {
    id: 'faq-5',
    pergunta: 'O laudo técnico NR10 é obrigatório para minha instalação elétrica?',
    resposta:
      'A NR10 é exigida para instalações elétricas em geral, principalmente em ambientes comerciais e industriais. Nossos técnicos emitem o laudo após inspeção completa.',
    tags: 'laudo, NR10, elétrica',
    ativo: false,
    criado_em: '2026-06-05T13:00:00.000Z',
    atualizado_em: '2026-06-10T08:00:00.000Z',
  },
];

let faqSequence = faqEntries.length;

export function nextFaqId(): string {
  faqSequence += 1;
  return `faq-${faqSequence}`;
}

/**
 * Mídias vinculadas a ordens de serviço, usadas por `GET /ordens-servico/{id}/midias`.
 * O endpoint de arquivo (`.../midias/{midiaId}/arquivo`) é simulado retornando um blob de
 * vídeo vazio/minúsculo com o `mime_type` correto — não existe um arquivo de vídeo real por
 * trás desse mock, apenas o suficiente para o elemento `<video>` não quebrar no player.
 */
export const midiasOrdemServico: MidiaOrdemServico[] = [
  {
    id: 'midia-1',
    tipo: 'video',
    mime_type: 'video/mp4',
    tamanho_bytes: 5_242_880,
    criado_em: '2026-07-04T09:30:00.000Z',
  },
  {
    id: 'midia-2',
    tipo: 'video',
    mime_type: 'video/mp4',
    tamanho_bytes: 2_097_152,
    criado_em: '2026-07-04T10:15:00.000Z',
  },
];

/** Mapeia midiaId -> ordemServicoId. Ambos os registros acima pertencem à OS `os-4`. */
export const midiaOrdemServicoIdPorMidiaId: Record<string, string> = {
  'midia-1': 'os-4',
  'midia-2': 'os-4',
};

export const solicitacoesAtendimento: SolicitacaoAtendimento[] = [
  {
    id: 'sol-1',
    cliente_id: 'cli-1',
    cliente_nome: 'Joana Ferreira',
    mensagem_cliente:
      'O disjuntor da minha casa está desarmando toda vez que ligo o chuveiro e o micro-ondas juntos. Isso é normal ou preciso trocar o disjuntor?',
    status: 'pendente',
    criado_em: '2026-07-09T14:20:00.000Z',
  },
  {
    id: 'sol-2',
    cliente_id: 'cli-2',
    cliente_nome: 'Mercado Bom Preço Ltda',
    mensagem_cliente:
      'Vocês parcelam a instalação de energia solar? Quero saber quantas vezes consigo dividir o valor do projeto.',
    status: 'pendente',
    criado_em: '2026-07-10T09:05:00.000Z',
  },
  {
    id: 'sol-3',
    cliente_id: 'cli-3',
    cliente_nome: 'Ricardo Alves',
    mensagem_cliente:
      'Preciso de um eletricista hoje ainda, é urgente. Vocês têm atendimento no mesmo dia para emergências?',
    status: 'pendente',
    criado_em: '2026-07-11T08:45:00.000Z',
  },
];

let solicitacaoAtendimentoSequence = solicitacoesAtendimento.length;

export function nextSolicitacaoAtendimentoId(): string {
  solicitacaoAtendimentoSequence += 1;
  return `sol-${solicitacaoAtendimentoSequence}`;
}

/** Estimativas de custo por ordem de serviço, indexadas por `ordem_servico_id`. */
export const estimativasCustoOS: Record<string, EstimativaCustoOS> = {};

let estimativaCustoSequence = 0;

export function nextEstimativaCustoId(): string {
  estimativaCustoSequence += 1;
  return `est-${estimativaCustoSequence}`;
}

/** Replica a fórmula de cálculo usada pelo backend para `custo_total`. */
export function calcularCustoTotalEstimativa(input: {
  horas_estimadas_tecnico: number;
  valor_hora_tecnico: number;
  horas_estimadas_ajudante?: number;
  valor_hora_ajudante?: number;
  custo_combustivel: number;
  custo_pedagio: number;
  custo_desgaste_veiculo: number;
  custo_almoco: number;
  custo_janta: number;
  custo_estadia: number;
  turno: 'diurno' | 'noturno';
  custo_adicional_noturno: number;
  outros_custos: number;
}): number {
  return (
    input.horas_estimadas_tecnico * input.valor_hora_tecnico +
    (input.horas_estimadas_ajudante ?? 0) * (input.valor_hora_ajudante ?? 0) +
    input.custo_combustivel +
    input.custo_pedagio +
    input.custo_desgaste_veiculo +
    input.custo_almoco +
    input.custo_janta +
    input.custo_estadia +
    input.outros_custos +
    (input.turno === 'noturno' ? input.custo_adicional_noturno : 0)
  );
}

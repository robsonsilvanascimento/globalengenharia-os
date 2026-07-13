import { http, HttpResponse } from 'msw';
import { alertasHandlers } from './handlers/alertas';
import { analyticsHandlers } from './handlers/analytics';
import { checklistHandlers } from './handlers/checklist';
import { fotosEvidenciaHandlers } from './handlers/fotosEvidencia';
import { historicoClienteHandlers } from './handlers/historicoCliente';
import { pendenciasHandlers } from './handlers/pendencias';
import { relatorioHandlers } from './handlers/relatorio';
import { slaHandlers } from './handlers/sla';
import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRefreshRequest,
  AuthRefreshResponse,
  Cliente,
  ClienteResumo,
  ClienteResumoOrdemServico,
  CategoriaServico,
  DisponibilidadeOrdemServico,
  EstimativaCustoOS,
  EstimativaCustoOSRequest,
  FaqEntry,
  MidiaOrdemServico,
  OrdemServico,
  PaginatedResponse,
  SolicitacaoAtendimento,
  StatusOrdemServico,
  StatusSolicitacaoAtendimento,
  Usuario,
} from '../types/api';
import {
  calcularCustoTotalEstimativa,
  categoriasServico,
  clientes,
  estimativasCustoOS,
  faqEntries,
  historicoStatusOS,
  midiaOrdemServicoIdPorMidiaId,
  midiasOrdemServico,
  nextCategoriaId,
  nextClienteId,
  nextEstimativaCustoId,
  nextFaqId,
  nextHistoricoId,
  nextOrdemServicoId,
  nextOrdemServicoNumero,
  nextUsuarioId,
  ordensServico,
  solicitacoesAtendimento,
  usuarios,
} from './data';

const ACCESS_TOKEN_PREFIX = 'mock-access-token';
const REFRESH_TOKEN_PREFIX = 'mock-refresh-token';

/**
 * Mock de "redefinir senha": qualquer token diferente deste é tratado como
 * inválido/expirado (400). Use este valor no fluxo de demonstração/teste
 * manual de RedefinirSenhaPage: `?token=token-valido-teste`.
 */
const TOKEN_REDEFINICAO_SENHA_VALIDO = 'token-valido-teste';

function toPublicUsuario(usuario: (typeof usuarios)[number]): Usuario {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    ativo: usuario.ativo,
    telefone: usuario.telefone,
    valorHora: usuario.valorHora,
  };
}

function issueTokens(usuarioId: string): { accessToken: string; refreshToken: string } {
  return {
    accessToken: `${ACCESS_TOKEN_PREFIX}:${usuarioId}`,
    refreshToken: `${REFRESH_TOKEN_PREFIX}:${usuarioId}`,
  };
}

function usuarioIdFromToken(token: string | null, prefix: string): string | null {
  if (!token || !token.startsWith(`${prefix}:`)) {
    return null;
  }
  return token.slice(prefix.length + 1);
}

function usuarioIdFromAuthHeader(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return usuarioIdFromToken(authHeader.slice('Bearer '.length), ACCESS_TOKEN_PREFIX);
}

export const handlers = [
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as AuthLoginRequest;
    const usuario = usuarios.find((candidate) => candidate.email === body.email);

    if (!usuario || usuario.senha !== body.senha) {
      return HttpResponse.json({ message: 'Email ou senha inválidos.' }, { status: 401 });
    }

    if (!usuario.ativo) {
      return HttpResponse.json({ message: 'Usuário inativo.' }, { status: 403 });
    }

    const tokens = issueTokens(usuario.id);
    const response: AuthLoginResponse = { ...tokens, usuario: toPublicUsuario(usuario) };
    return HttpResponse.json(response);
  }),

  http.post('*/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as AuthRefreshRequest;
    const usuarioId = usuarioIdFromToken(body.refreshToken, REFRESH_TOKEN_PREFIX);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Refresh token inválido.' }, { status: 401 });
    }

    const response: AuthRefreshResponse = issueTokens(usuario.id);
    return HttpResponse.json(response);
  }),

  http.get('*/auth/me', ({ request }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }

    return HttpResponse.json(toPublicUsuario(usuario));
  }),

  http.post('*/auth/esqueci-senha', async () => {
    // Nunca revela se o e-mail existe: sempre 200, mesma mensagem.
    return HttpResponse.json({
      message: 'Se esse e-mail estiver cadastrado, você vai receber um link para redefinir sua senha.',
    });
  }),

  http.post('*/auth/redefinir-senha', async ({ request }) => {
    const body = (await request.json()) as { token: string; nova_senha: string };

    if (body.token !== TOKEN_REDEFINICAO_SENHA_VALIDO) {
      return HttpResponse.json({ message: 'Token inválido ou expirado.' }, { status: 400 });
    }

    return HttpResponse.json({ message: 'Senha redefinida com sucesso!' });
  }),

  http.get('*/usuarios', () => {
    return HttpResponse.json(usuarios.map(toPublicUsuario));
  }),

  http.post('*/usuarios', async ({ request }) => {
    const body = (await request.json()) as Partial<Usuario> & { senha?: string };
    const novoUsuario = {
      id: nextUsuarioId(),
      nome: body.nome ?? '',
      email: body.email ?? '',
      papel: body.papel ?? 'atendente',
      ativo: body.ativo ?? true,
      telefone: body.telefone,
      valorHora: body.valorHora,
      senha: body.senha ?? '123456',
    };
    usuarios.push(novoUsuario);
    return HttpResponse.json(toPublicUsuario(novoUsuario), { status: 201 });
  }),

  http.get('*/clientes', () => {
    return HttpResponse.json(clientes);
  }),

  http.post('*/clientes', async ({ request }) => {
    const body = (await request.json()) as Partial<Cliente>;
    const novoCliente: Cliente = {
      id: nextClienteId(),
      nome: body.nome ?? '',
      telefone_whatsapp: body.telefone_whatsapp ?? '',
      email: body.email,
      documento: body.documento,
      criado_em: new Date().toISOString(),
    };
    clientes.push(novoCliente);
    return HttpResponse.json(novoCliente, { status: 201 });
  }),

  http.get('*/clientes/:id/resumo', ({ params }) => {
    const cliente = clientes.find((item) => item.id === params.id);

    if (!cliente) {
      return HttpResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    const ordensDoCliente = ordensServico.filter((os) => os.cliente_id === cliente.id);

    const ordensResumo: ClienteResumoOrdemServico[] = ordensDoCliente.map((os) => ({
      id: os.id,
      numero: os.numero,
      categoria_nome:
        categoriasServico.find((categoria) => categoria.id === os.categoria_servico_id)?.nome ??
        os.categoria_servico_id,
      descricao_problema: os.descricao_problema,
      status: os.status,
      prioridade: os.prioridade,
      valor_cobrado: os.valor_cobrado ?? null,
      criado_em: os.criado_em,
    }));

    const totalValorCobrado = ordensResumo.reduce((total, os) => total + (os.valor_cobrado ?? 0), 0);

    const resumo: ClienteResumo = {
      total_ordens_servico: ordensResumo.length,
      total_valor_cobrado: totalValorCobrado,
      ordens_servico: ordensResumo,
    };

    return HttpResponse.json(resumo);
  }),

  http.get('*/clientes/:id', ({ params }) => {
    const cliente = clientes.find((item) => item.id === params.id);

    if (!cliente) {
      return HttpResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    return HttpResponse.json(cliente);
  }),

  http.get('*/categorias-servico', () => {
    return HttpResponse.json(categoriasServico);
  }),

  http.post('*/categorias-servico', async ({ request }) => {
    const body = (await request.json()) as Partial<CategoriaServico>;
    const novaCategoria: CategoriaServico = {
      id: nextCategoriaId(),
      nome: body.nome ?? '',
      area: body.area ?? 'outro',
      ativo: body.ativo ?? true,
    };
    categoriasServico.push(novaCategoria);
    return HttpResponse.json(novaCategoria, { status: 201 });
  }),

  http.patch('*/categorias-servico/:id', async ({ request, params }) => {
    const categoria = categoriasServico.find((item) => item.id === params.id);

    if (!categoria) {
      return HttpResponse.json({ message: 'Categoria não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as Partial<CategoriaServico>;
    Object.assign(categoria, body);
    return HttpResponse.json(categoria);
  }),

  http.get('*/faq', ({ request }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const incluirInativas = url.searchParams.get('incluir_inativas') === 'true';
    const podeVerInativas = usuario.papel === 'admin' && incluirInativas;
    const resultado = podeVerInativas ? faqEntries : faqEntries.filter((item) => item.ativo);

    return HttpResponse.json(resultado);
  }),

  http.post('*/faq', async ({ request }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<FaqEntry>;
    const agora = new Date().toISOString();
    const novaEntrada: FaqEntry = {
      id: nextFaqId(),
      pergunta: body.pergunta ?? '',
      resposta: body.resposta ?? '',
      tags: body.tags,
      ativo: body.ativo ?? true,
      criado_em: agora,
      atualizado_em: agora,
    };

    faqEntries.push(novaEntrada);
    return HttpResponse.json(novaEntrada, { status: 201 });
  }),

  http.patch('*/faq/:id', async ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const entrada = faqEntries.find((item) => item.id === params.id);
    if (!entrada) {
      return HttpResponse.json({ message: 'Pergunta não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as Partial<FaqEntry>;
    Object.assign(entrada, body, { atualizado_em: new Date().toISOString() });
    return HttpResponse.json(entrada);
  }),

  http.get('*/ordens-servico', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as StatusOrdemServico | null;
    const tecnicoId = url.searchParams.get('tecnico_id');
    const clienteId = url.searchParams.get('cliente_id');
    const page = Number(url.searchParams.get('page') ?? '1') || 1;
    const pageSize = Number(url.searchParams.get('page_size') ?? '10') || 10;

    let filtradas = ordensServico;

    if (status) {
      filtradas = filtradas.filter((os) => os.status === status);
    }
    if (tecnicoId) {
      filtradas = filtradas.filter((os) => os.tecnico_id === tecnicoId);
    }
    if (clienteId) {
      filtradas = filtradas.filter((os) => os.cliente_id === clienteId);
    }

    const start = (page - 1) * pageSize;
    const paginadas = filtradas.slice(start, start + pageSize);

    const response: PaginatedResponse<OrdemServico> = {
      data: paginadas,
      page,
      page_size: pageSize,
      total: filtradas.length,
    };

    return HttpResponse.json(response);
  }),

  http.post('*/ordens-servico', async ({ request }) => {
    const body = (await request.json()) as Partial<OrdemServico>;
    const agora = new Date().toISOString();
    const cliente = clientes.find((item) => item.id === body.cliente_id);

    const novaOrdemServico: OrdemServico = {
      id: nextOrdemServicoId(),
      numero: nextOrdemServicoNumero(),
      cliente_id: body.cliente_id ?? '',
      cliente_nome: cliente?.nome ?? body.cliente_nome ?? '',
      categoria_servico_id: body.categoria_servico_id ?? '',
      descricao_problema: body.descricao_problema ?? '',
      endereco_atendimento: body.endereco_atendimento,
      status: 'aberta',
      prioridade: body.prioridade ?? 'normal',
      criado_em: agora,
      atualizado_em: agora,
    };

    ordensServico.push(novaOrdemServico);
    return HttpResponse.json(novaOrdemServico, { status: 201 });
  }),

  http.get('*/ordens-servico/:id', ({ params }) => {
    const ordemServico = ordensServico.find((os) => os.id === params.id);

    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    return HttpResponse.json(ordemServico);
  }),

  http.patch('*/ordens-servico/:id', async ({ request, params }) => {
    const ordemServico = ordensServico.find((os) => os.id === params.id);

    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as Partial<OrdemServico>;
    Object.assign(ordemServico, body, { atualizado_em: new Date().toISOString() });
    return HttpResponse.json(ordemServico);
  }),

  http.patch('*/ordens-servico/:id/status', async ({ request, params }) => {
    const ordemServico = ordensServico.find((os) => os.id === params.id);

    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as { status: StatusOrdemServico; observacao?: string };
    const statusAnterior = ordemServico.status;
    const usuarioId = usuarioIdFromAuthHeader(request);
    const agora = new Date().toISOString();

    ordemServico.status = body.status;
    ordemServico.atualizado_em = agora;

    historicoStatusOS.push({
      id: nextHistoricoId(),
      ordem_servico_id: ordemServico.id,
      status_anterior: statusAnterior,
      status_novo: body.status,
      alterado_por_usuario_id: usuarioId ?? undefined,
      alterado_por_bot: !usuarioId,
      observacao: body.observacao,
      criado_em: agora,
    });

    return HttpResponse.json(ordemServico);
  }),

  http.patch('*/ordens-servico/:id/valor', async ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const ordemServico = ordensServico.find((os) => os.id === params.id);
    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as { valor_cobrado: number };
    ordemServico.valor_cobrado = body.valor_cobrado;
    ordemServico.atualizado_em = new Date().toISOString();

    return HttpResponse.json(ordemServico);
  }),

  http.get('*/ordens-servico/:id/disponibilidade', ({ params }) => {
    const ordemServico = ordensServico.find((os) => os.id === params.id);

    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    const semDataAgendada = !ordemServico.data_agendada;

    // Simulação simples: um usuário é considerado "ocupado" se já estiver
    // atribuído (como técnico ou ajudante) a outra OS com a mesma data_agendada.
    const usuarioOcupado = (usuarioId: string): boolean => {
      if (semDataAgendada) {
        return false;
      }
      return ordensServico.some(
        (os) =>
          os.id !== ordemServico.id &&
          os.data_agendada === ordemServico.data_agendada &&
          (os.tecnico_id === usuarioId || os.ajudante_id === usuarioId),
      );
    };

    const tecnicosDisponiveis = usuarios
      .filter((usuario) => usuario.papel === 'tecnico' && usuario.ativo && !usuarioOcupado(usuario.id))
      .map((usuario) => ({ id: usuario.id, nome: usuario.nome }));

    const ajudantesDisponiveis = usuarios
      .filter((usuario) => usuario.papel === 'ajudante' && usuario.ativo && !usuarioOcupado(usuario.id))
      .map((usuario) => ({ id: usuario.id, nome: usuario.nome }));

    const response: DisponibilidadeOrdemServico = {
      tecnicos_disponiveis: tecnicosDisponiveis,
      ajudantes_disponiveis: ajudantesDisponiveis,
      sem_data_agendada: semDataAgendada,
    };

    return HttpResponse.json(response);
  }),

  http.patch('*/ordens-servico/:id/atribuir', async ({ request, params }) => {
    const ordemServico = ordensServico.find((os) => os.id === params.id);

    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      tecnico_id: string;
      ajudante_id?: string | null;
      data_agendada?: string | null;
    };
    const tecnico = usuarios.find((usuario) => usuario.id === body.tecnico_id);

    if (!tecnico) {
      return HttpResponse.json({ message: 'Técnico não encontrado.' }, { status: 404 });
    }

    const ajudante = body.ajudante_id
      ? usuarios.find((usuario) => usuario.id === body.ajudante_id)
      : undefined;

    if (body.ajudante_id && !ajudante) {
      return HttpResponse.json({ message: 'Ajudante não encontrado.' }, { status: 404 });
    }

    const dataAgendadaFinal = body.data_agendada !== undefined ? body.data_agendada : ordemServico.data_agendada;

    if (dataAgendadaFinal) {
      const conflito = ordensServico.some(
        (os) =>
          os.id !== ordemServico.id &&
          os.data_agendada === dataAgendadaFinal &&
          ((os.tecnico_id && os.tecnico_id === tecnico.id) ||
            (Boolean(ajudante) && os.ajudante_id === ajudante?.id)),
      );

      if (conflito) {
        return HttpResponse.json(
          { message: 'Técnico ou ajudante não está disponível nesse horário, escolha outro.' },
          { status: 409 },
        );
      }
    }

    const statusAnterior = ordemServico.status;
    const agora = new Date().toISOString();

    ordemServico.tecnico_id = tecnico.id;
    ordemServico.tecnico_nome = tecnico.nome;
    ordemServico.ajudante_id = ajudante?.id ?? null;
    ordemServico.status = 'atribuida';
    ordemServico.atualizado_em = agora;
    if (body.data_agendada !== undefined) {
      ordemServico.data_agendada = body.data_agendada;
    }

    if (statusAnterior !== 'atribuida') {
      const usuarioId = usuarioIdFromAuthHeader(request);
      historicoStatusOS.push({
        id: nextHistoricoId(),
        ordem_servico_id: ordemServico.id,
        status_anterior: statusAnterior,
        status_novo: 'atribuida',
        alterado_por_usuario_id: usuarioId ?? undefined,
        alterado_por_bot: !usuarioId,
        observacao: `Atribuída ao técnico ${tecnico.nome}.`,
        criado_em: agora,
      });
    }

    return HttpResponse.json(ordemServico);
  }),

  http.get('*/ordens-servico/:id/historico', ({ params }) => {
    const historico = historicoStatusOS.filter((item) => item.ordem_servico_id === params.id);
    return HttpResponse.json(historico);
  }),

  http.get('*/ordens-servico/:id/midias', ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin' && usuario.papel !== 'tecnico') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores e técnicos.' }, { status: 403 });
    }

    const ordemServico = ordensServico.find((os) => os.id === params.id);
    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    const midias: MidiaOrdemServico[] = midiasOrdemServico.filter(
      (midia) => midiaOrdemServicoIdPorMidiaId[midia.id] === ordemServico.id,
    );

    return HttpResponse.json(midias);
  }),

  http.get('*/ordens-servico/:id/midias/:midiaId/arquivo', ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin' && usuario.papel !== 'tecnico') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores e técnicos.' }, { status: 403 });
    }

    const midia = midiasOrdemServico.find(
      (item) => item.id === params.midiaId && midiaOrdemServicoIdPorMidiaId[item.id] === params.id,
    );
    if (!midia) {
      return HttpResponse.json({ message: 'Mídia não encontrada.' }, { status: 404 });
    }

    // Mock não possui um arquivo de vídeo real: retorna um blob vazio apenas com o
    // mime_type correto, suficiente para o elemento <video> montar o player sem quebrar.
    return HttpResponse.arrayBuffer(new ArrayBuffer(0), { headers: { 'Content-Type': midia.mime_type } });
  }),

  http.delete('*/ordens-servico/:id/midias/:midiaId', ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const index = midiasOrdemServico.findIndex(
      (item) => item.id === params.midiaId && midiaOrdemServicoIdPorMidiaId[item.id] === params.id,
    );
    if (index === -1) {
      return HttpResponse.json({ message: 'Mídia não encontrada.' }, { status: 404 });
    }

    midiasOrdemServico.splice(index, 1);
    delete midiaOrdemServicoIdPorMidiaId[params.midiaId as string];

    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/ordens-servico/:id/estimativa-custo', ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const ordemServico = ordensServico.find((os) => os.id === params.id);
    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    return HttpResponse.json(estimativasCustoOS[ordemServico.id] ?? null);
  }),

  http.put('*/ordens-servico/:id/estimativa-custo', async ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const ordemServico = ordensServico.find((os) => os.id === params.id);
    if (!ordemServico) {
      return HttpResponse.json({ message: 'Ordem de serviço não encontrada.' }, { status: 404 });
    }

    if (!ordemServico.tecnico_id) {
      return HttpResponse.json(
        { message: 'A ordem de serviço não possui técnico atribuído.' },
        { status: 400 },
      );
    }

    const tecnico = usuarios.find((candidate) => candidate.id === ordemServico.tecnico_id);
    if (!tecnico || tecnico.valorHora == null) {
      return HttpResponse.json(
        { message: 'O técnico atribuído não possui valor/hora cadastrado.' },
        { status: 400 },
      );
    }

    const ajudante = ordemServico.ajudante_id
      ? usuarios.find((candidate) => candidate.id === ordemServico.ajudante_id)
      : undefined;

    const body = (await request.json()) as EstimativaCustoOSRequest;
    const agora = new Date().toISOString();
    const existente = estimativasCustoOS[ordemServico.id];

    const dadosCalculo = {
      horas_estimadas_tecnico: body.horas_estimadas_tecnico,
      valor_hora_tecnico: tecnico.valorHora,
      horas_estimadas_ajudante: body.horas_estimadas_ajudante,
      valor_hora_ajudante: ajudante?.valorHora ?? undefined,
      custo_combustivel: body.custo_combustivel ?? 0,
      custo_pedagio: body.custo_pedagio ?? 0,
      custo_desgaste_veiculo: body.custo_desgaste_veiculo ?? 0,
      custo_almoco: body.custo_almoco ?? 0,
      custo_janta: body.custo_janta ?? 0,
      custo_estadia: body.custo_estadia ?? 0,
      turno: body.turno ?? 'diurno',
      custo_adicional_noturno: body.custo_adicional_noturno ?? 0,
      outros_custos: body.outros_custos ?? 0,
    } as const;

    const estimativa: EstimativaCustoOS = {
      id: existente?.id ?? nextEstimativaCustoId(),
      ordem_servico_id: ordemServico.id,
      ...dadosCalculo,
      custo_total: calcularCustoTotalEstimativa(dadosCalculo),
      criado_em: existente?.criado_em ?? agora,
      atualizado_em: agora,
    };

    estimativasCustoOS[ordemServico.id] = estimativa;

    return HttpResponse.json(estimativa);
  }),

  http.get('*/solicitacoes-atendimento', ({ request }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'atendente' && usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a atendentes e administradores.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as StatusSolicitacaoAtendimento | null;
    const resultado = status
      ? solicitacoesAtendimento.filter((item) => item.status === status)
      : solicitacoesAtendimento;

    return HttpResponse.json(resultado);
  }),

  ...pendenciasHandlers,
  ...checklistHandlers,
  ...historicoClienteHandlers,
  ...fotosEvidenciaHandlers,
  ...analyticsHandlers,
  ...alertasHandlers,
  ...slaHandlers,
  ...relatorioHandlers,

  http.patch('*/solicitacoes-atendimento/:id/responder', async ({ request, params }) => {
    const usuarioId = usuarioIdFromAuthHeader(request);
    const usuario = usuarios.find((candidate) => candidate.id === usuarioId);

    if (!usuario) {
      return HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });
    }
    if (usuario.papel !== 'atendente' && usuario.papel !== 'admin') {
      return HttpResponse.json({ message: 'Acesso restrito a atendentes e administradores.' }, { status: 403 });
    }

    const solicitacao = solicitacoesAtendimento.find((item) => item.id === params.id);
    if (!solicitacao) {
      return HttpResponse.json({ message: 'Solicitação não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as { resposta_texto: string; salvar_como_faq?: boolean };
    const agora = new Date().toISOString();

    solicitacao.status = 'respondida';
    solicitacao.resposta_texto = body.resposta_texto;
    solicitacao.respondido_em = agora;

    if (body.salvar_como_faq) {
      const novaEntradaFaq: FaqEntry = {
        id: nextFaqId(),
        pergunta: solicitacao.mensagem_cliente,
        resposta: body.resposta_texto,
        ativo: true,
        criado_em: agora,
        atualizado_em: agora,
      };
      faqEntries.push(novaEntradaFaq);
    }

    return HttpResponse.json(solicitacao satisfies SolicitacaoAtendimento);
  }),
];

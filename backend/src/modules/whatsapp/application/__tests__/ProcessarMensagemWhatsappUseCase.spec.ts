import { describe, expect, it, vi } from 'vitest';
import { CriarOrdemServicoUseCase } from '../../../ordens-servico/application/CriarOrdemServicoUseCase';
import { ListarOrdensServicoUseCase } from '../../../ordens-servico/application/ListarOrdensServicoUseCase';
import { VerificarDisponibilidadeUseCase } from '../../../ordens-servico/application/VerificarDisponibilidadeUseCase';
import {
  criarOrdemServicoFake,
  FakeHistoricoStatusOSRepository,
  FakeNumeroOSGenerator,
  FakeOrdemServicoRepository,
} from '../../../ordens-servico/application/__tests__/fakes';
import { BuscarRespostaFaqUseCase, type ChamarModeloFn } from '../../../faq/application/BuscarRespostaFaqUseCase';
import { CriarSolicitacaoAtendimentoUseCase } from '../../../atendimento-humano/application/CriarSolicitacaoAtendimentoUseCase';
import { FakeSolicitacaoAtendimentoRepository } from '../../../atendimento-humano/application/__tests__/fakes';
import { ConsultarStatusOSViaWhatsappUseCase } from '../ConsultarStatusOSViaWhatsappUseCase';
import {
  ConsultarPagamentoViaWhatsappUseCase,
  type BuscarPagamentoDaOSFn,
} from '../ConsultarPagamentoViaWhatsappUseCase';
import { ProcessarMensagemWhatsappUseCase } from '../ProcessarMensagemWhatsappUseCase';
import {
  criarCategoriaServicoFake,
  criarFaqEntryFake,
  criarUsuarioFake,
  FakeCategoriaServicoRepository,
  FakeClienteRepository,
  FakeConversaWhatsappRepository,
  FakeFaqEntryRepository,
  FakeUsuarioRepository,
} from './fakes';

function montarUseCase(
  opts: { chamarModeloFaq?: ChamarModeloFn; buscarPagamentoDaOS?: BuscarPagamentoDaOSFn } = {},
) {
  const clienteRepository = new FakeClienteRepository();
  const conversaWhatsappRepository = new FakeConversaWhatsappRepository();
  const categoriaServicoRepository = new FakeCategoriaServicoRepository([
    criarCategoriaServicoFake({ id: 'cat-1', nome: 'Eletrica' }),
    criarCategoriaServicoFake({ id: 'cat-2', nome: 'Automacao', area: 'automacao' }),
  ]);
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const historicoStatusOSRepository = new FakeHistoricoStatusOSRepository();
  const numeroOSGenerator = new FakeNumeroOSGenerator();

  const criarOrdemServicoUseCase = new CriarOrdemServicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    numeroOSGenerator,
  });

  const listarOrdensServicoUseCase = new ListarOrdensServicoUseCase({ ordemServicoRepository });
  const consultarStatusOSViaWhatsappUseCase = new ConsultarStatusOSViaWhatsappUseCase({
    ordemServicoRepository,
    listarOrdensServicoUseCase,
  });
  const consultarPagamentoViaWhatsappUseCase = new ConsultarPagamentoViaWhatsappUseCase({
    ordemServicoRepository,
    listarOrdensServicoUseCase,
    buscarPagamentoDaOS: opts.buscarPagamentoDaOS ?? (async () => ({ statusPagamento: 'sem_valor' })),
  });

  const faqEntryRepository = new FakeFaqEntryRepository([criarFaqEntryFake()]);
  const buscarRespostaFaqUseCase = new BuscarRespostaFaqUseCase({
    faqEntryRepository,
    chamarModelo: opts.chamarModeloFaq ?? (async () => JSON.stringify({ respondeu: false, resposta: null })),
  });

  const solicitacaoAtendimentoRepository = new FakeSolicitacaoAtendimentoRepository();
  const criarSolicitacaoAtendimentoUseCase = new CriarSolicitacaoAtendimentoUseCase({
    solicitacaoAtendimentoRepository,
  });

  const usuarioRepository = new FakeUsuarioRepository();
  const verificarDisponibilidadeUseCase = new VerificarDisponibilidadeUseCase({ ordemServicoRepository });

  const useCase = new ProcessarMensagemWhatsappUseCase({
    conversaWhatsappRepository,
    clienteRepository,
    categoriaServicoRepository,
    criarOrdemServicoUseCase,
    verificarDisponibilidadeUseCase,
    usuarioRepository,
    consultarStatusOSViaWhatsappUseCase,
    consultarPagamentoViaWhatsappUseCase,
    buscarRespostaFaqUseCase,
    criarSolicitacaoAtendimentoUseCase,
  });

  return {
    useCase,
    clienteRepository,
    conversaWhatsappRepository,
    ordemServicoRepository,
    faqEntryRepository,
    solicitacaoAtendimentoRepository,
    usuarioRepository,
  };
}

const TELEFONE = '5511999998888';

describe('ProcessarMensagemWhatsappUseCase', () => {
  it('conduz um cliente novo do inicio ate a criacao da OS ao longo de varias mensagens', async () => {
    const { useCase, clienteRepository, ordemServicoRepository } = montarUseCase();

    const passo1 = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
    expect(passo1.conversa.estadoFluxo).toBe('aguardando_nome_cliente');
    expect(clienteRepository.clientes).toHaveLength(1);
    expect(clienteRepository.clientes[0]?.telefoneWhatsapp).toBe(TELEFONE);

    const passo2 = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao Pereira' });
    expect(passo2.conversa.estadoFluxo).toBe('aguardando_categoria');
    expect(passo2.conversa.contextoDados.nomeCliente).toBe('Joao Pereira');
    expect(passo2.respostasParaEnviar).toEqual(
      expect.arrayContaining([{ tipo: 'menu_categorias', categorias: expect.any(Array) }]),
    );

    const passo3 = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'cat-1' });
    expect(passo3.conversa.estadoFluxo).toBe('aguardando_descricao');
    expect(passo3.conversa.contextoDados.categoriaId).toBe('cat-1');

    const passo4 = await useCase.execute({
      telefone: TELEFONE,
      mensagemRecebida: 'Disjuntor esta desarmando toda hora',
    });

    expect(passo4.conversa.estadoFluxo).toBe('aguardando_email');
    expect(passo4.ordemServicoCriada).toBeUndefined();

    const passo5 = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'nao' });

    expect(passo5.conversa.estadoFluxo).toBe('aguardando_data_agendamento');
    expect(passo5.ordemServicoCriada).toBeUndefined();

    const passo6 = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'ainda nao sei' });

    expect(passo6.conversa.estadoFluxo).toBe('os_criada');
    expect(passo6.ordemServicoCriada).toBeDefined();
    expect(passo6.ordemServicoCriada?.clienteId).toBe(clienteRepository.clientes[0]?.id);
    expect(passo6.ordemServicoCriada?.categoriaServicoId).toBe('cat-1');
    expect(passo6.ordemServicoCriada?.descricaoProblema).toBe('Disjuntor esta desarmando toda hora');
    expect(passo6.ordemServicoCriada?.criadoVia).toBe('whatsapp');
    expect(passo6.ordemServicoCriada?.criadoPorUsuarioId).toBeUndefined();
    expect(passo6.ordemServicoCriada?.dataAgendada).toBeUndefined();
    expect(passo6.conversa.contextoDados.numeroOrdemServico).toBe(passo6.ordemServicoCriada?.numero);
    expect(
      passo6.respostasParaEnviar.some(
        (comando) => comando.tipo === 'texto' && comando.mensagem.includes(passo6.ordemServicoCriada!.numero),
      ),
    ).toBe(true);
    expect(ordemServicoRepository.ordens).toHaveLength(1);
  });

  it('pula a pergunta do nome quando o cliente ja existe (telefone conhecido)', async () => {
    const { useCase, clienteRepository } = montarUseCase();
    await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });

    const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });

    expect(resultado.conversa.estadoFluxo).toBe('aguardando_categoria');
    expect(clienteRepository.clientes).toHaveLength(1);
  });

  it('mantem o estado aguardando_categoria e reenvia o menu quando a categoria escolhida e invalida', async () => {
    const { useCase } = montarUseCase();

    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao' });

    const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'categoria-que-nao-existe' });

    expect(resultado.conversa.estadoFluxo).toBe('aguardando_categoria');
    expect(resultado.conversa.contextoDados.categoriaId).toBeUndefined();
  });

  it('inicia uma nova conversa quando a anterior ja havia concluido em os_criada', async () => {
    const { useCase, conversaWhatsappRepository } = montarUseCase();

    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao' });
    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'cat-1' });
    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Problema eletrico qualquer' });
    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'nao' });
    await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'ainda nao sei' });

    const novaConversa = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi de novo' });

    expect(novaConversa.conversa.estadoFluxo).not.toBe('inicio');
    expect(conversaWhatsappRepository.conversas.filter((c) => c.telefoneWhatsapp === TELEFONE)).toHaveLength(2);
  });

  describe('consulta de status de OS', () => {
    it('responde a consulta por numero de OS pertencente ao proprio cliente, sem iniciar abertura de OS', async () => {
      const { useCase, clienteRepository, ordemServicoRepository, conversaWhatsappRepository } = montarUseCase();
      const cliente = await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });
      ordemServicoRepository.seed(
        criarOrdemServicoFake({
          id: 'os-1',
          numero: 'OS-2026-000123',
          clienteId: cliente.id,
          status: 'em_andamento',
        }),
      );

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'OS-2026-000123' });

      expect(resultado.conversa.estadoFluxo).toBe('inicio');
      expect(resultado.ordemServicoCriada).toBeUndefined();
      const mensagem = resultado.respostasParaEnviar[0];
      expect(mensagem.tipo === 'texto' ? mensagem.mensagem : '').toContain('OS-2026-000123');
      expect(conversaWhatsappRepository.conversas.filter((c) => c.telefoneWhatsapp === TELEFONE)).toHaveLength(1);
    });

    it('nega a consulta quando o numero de OS informado pertence a outro cliente', async () => {
      const { useCase, clienteRepository, ordemServicoRepository } = montarUseCase();
      await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000999', clienteId: 'cliente-de-outra-pessoa' }),
      );

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'OS-2026-000999' });

      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem.tipo === 'texto' ? mensagem.mensagem : '';
      expect(texto.toLowerCase()).toContain('nao encontramos');
      expect(texto).not.toContain('cliente-de-outra-pessoa');
    });

    it('consulta sem numero: informa que nao ha OS em aberto quando o cliente nao possui nenhuma ativa', async () => {
      const { useCase, clienteRepository } = montarUseCase();
      await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'qual o status da minha OS?' });

      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem.tipo === 'texto' ? mensagem.mensagem : '';
      expect(texto.toLowerCase()).toContain('nao possui nenhuma');
    });

    it('consulta sem numero: responde direto quando ha exatamente uma OS ativa do cliente', async () => {
      const { useCase, clienteRepository, ordemServicoRepository } = montarUseCase();
      const cliente = await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: cliente.id, status: 'aberta' }),
      );

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'gostaria de acompanhar' });

      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem.tipo === 'texto' ? mensagem.mensagem : '';
      expect(texto).toContain('OS-2026-000001');
    });

    it('consulta sem numero: lista resumidamente quando ha multiplas OS ativas do cliente', async () => {
      const { useCase, clienteRepository, ordemServicoRepository } = montarUseCase();
      const cliente = await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: cliente.id, status: 'aberta' }),
      );
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-2', numero: 'OS-2026-000002', clienteId: cliente.id, status: 'triagem' }),
      );

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'status' });

      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem.tipo === 'texto' ? mensagem.mensagem : '';
      expect(texto).toContain('OS-2026-000001');
      expect(texto).toContain('OS-2026-000002');
    });

    it('encaminha mensagem sobre pagamento para a consulta de pagamento (nao para consulta de status)', async () => {
      const buscarPagamentoDaOS = vi.fn(async () => ({
        statusPagamento: 'pendente' as const,
        valor: 150,
        pixCopiaECola: 'codigo-pix-fake',
      }));
      const { useCase, clienteRepository, ordemServicoRepository } = montarUseCase({ buscarPagamentoDaOS });
      const cliente = await clienteRepository.create({ nome: 'Maria Cliente', telefoneWhatsapp: TELEFONE });
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: cliente.id, status: 'concluida' }),
      );

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'ja paguei?' });

      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem.tipo === 'texto' ? mensagem.mensagem : '';
      expect(texto).toContain('codigo-pix-fake');
      expect(buscarPagamentoDaOS).toHaveBeenCalledTimes(1);
    });

    it('nao interrompe o fluxo de abertura em andamento com uma mensagem ambigua (parecida com consulta)', async () => {
      const { useCase } = montarUseCase();

      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao' });

      // Em aguardando_categoria, "status" nao e uma categoria valida: deve
      // reenviar o menu de categorias, sem ser tratado como consulta.
      const emCategoria = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'status' });
      expect(emCategoria.conversa.estadoFluxo).toBe('aguardando_categoria');

      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'cat-1' });

      // Em aguardando_descricao, uma mensagem com "123" deve ser tratada como
      // a propria descricao do problema, nao como consulta por numero de OS.
      const emDescricao = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: '123' });
      expect(emDescricao.conversa.estadoFluxo).toBe('aguardando_email');
      expect(emDescricao.conversa.contextoDados.descricaoProblema).toBe('123');
      expect(emDescricao.ordemServicoCriada).toBeUndefined();

      const emEmail = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'nao' });
      expect(emEmail.conversa.estadoFluxo).toBe('aguardando_data_agendamento');

      const finalizado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'ainda nao sei' });
      expect(finalizado.conversa.estadoFluxo).toBe('os_criada');
      expect(finalizado.ordemServicoCriada).toBeDefined();
    });
  });

  describe('coleta de e-mail opcional (aguardando_email)', () => {
    async function chegarEmAguardandoEmail(useCase: ProcessarMensagemWhatsappUseCase) {
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao Pereira' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'cat-1' });
      return useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Disjuntor desarmando toda hora' });
    }

    it('pergunta se o cliente quer receber a OS em PDF por e-mail apos a descricao do problema', async () => {
      const { useCase } = montarUseCase();

      const resultado = await chegarEmAguardandoEmail(useCase);

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_email');
      expect(
        resultado.respostasParaEnviar.some(
          (comando) => comando.tipo === 'texto' && comando.mensagem.toLowerCase().includes('e-mail'),
        ),
      ).toBe(true);
    });

    it('guarda o e-mail informado no contexto e avanca para aguardando_data_agendamento quando o e-mail e valido', async () => {
      const { useCase, clienteRepository } = montarUseCase();
      await chegarEmAguardandoEmail(useCase);

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'joao@exemplo.com' });

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_data_agendamento');
      expect(resultado.conversa.contextoDados.emailCliente).toBe('joao@exemplo.com');
      expect(resultado.ordemServicoCriada).toBeUndefined();

      const finalizado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'ainda nao sei' });

      expect(finalizado.conversa.estadoFluxo).toBe('os_criada');
      expect(finalizado.ordemServicoCriada).toBeDefined();

      const cliente = clienteRepository.clientes.find((item) => item.telefoneWhatsapp === TELEFONE);
      expect(cliente?.email).toBe('joao@exemplo.com');
    });

    it.each(['nao', 'não', 'Nao', 'N', 'pular', ''])(
      'pula a coleta de e-mail sem atualizar o cliente quando a resposta e uma recusa ("%s")',
      async (recusa) => {
        const { useCase, clienteRepository } = montarUseCase();
        await chegarEmAguardandoEmail(useCase);

        const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: recusa });

        expect(resultado.conversa.estadoFluxo).toBe('aguardando_data_agendamento');
        expect(resultado.conversa.contextoDados.emailCliente).toBeUndefined();
        expect(resultado.ordemServicoCriada).toBeUndefined();

        const finalizado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'ainda nao sei' });

        expect(finalizado.conversa.estadoFluxo).toBe('os_criada');
        expect(finalizado.ordemServicoCriada).toBeDefined();

        const cliente = clienteRepository.clientes.find((item) => item.telefoneWhatsapp === TELEFONE);
        expect(cliente?.email).toBeUndefined();
      },
    );

    it('repete a pergunta quando a entrada nao e nem recusa nem um e-mail valido', async () => {
      const { useCase } = montarUseCase();
      await chegarEmAguardandoEmail(useCase);

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'talvez depois' });

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_email');
      expect(resultado.ordemServicoCriada).toBeUndefined();
    });
  });

  describe('agendamento (aguardando_data_agendamento) e checagem de disponibilidade', () => {
    async function chegarEmAguardandoDataAgendamento(useCase: ProcessarMensagemWhatsappUseCase) {
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao Pereira' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'cat-1' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Disjuntor desarmando toda hora' });
      return useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'nao' });
    }

    it('cria a OS com dataAgendada quando a data informada e valida e ha tecnico disponivel', async () => {
      const { useCase, usuarioRepository, ordemServicoRepository } = montarUseCase();
      usuarioRepository.seed(criarUsuarioFake({ id: 'tecnico-1', papel: 'tecnico' }));

      const emAgendamento = await chegarEmAguardandoDataAgendamento(useCase);
      expect(emAgendamento.conversa.estadoFluxo).toBe('aguardando_data_agendamento');

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: '20/08/2026 09:00' });

      expect(resultado.conversa.estadoFluxo).toBe('os_criada');
      expect(resultado.ordemServicoCriada).toBeDefined();
      expect(resultado.ordemServicoCriada?.dataAgendada).toEqual(new Date(2026, 7, 20, 9, 0));
      expect(ordemServicoRepository.ordens).toHaveLength(1);
    });

    it.each(['ainda nao sei', 'Ainda não sei', 'nao sei', 'Não Sei', 'depois', 'DEPOIS'])(
      'recusa da data ("%s") pula para a criacao da OS sem dataAgendada',
      async (recusa) => {
        const { useCase } = montarUseCase();

        const emAgendamento = await chegarEmAguardandoDataAgendamento(useCase);
        expect(emAgendamento.conversa.estadoFluxo).toBe('aguardando_data_agendamento');

        const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: recusa });

        expect(resultado.conversa.estadoFluxo).toBe('os_criada');
        expect(resultado.ordemServicoCriada).toBeDefined();
        expect(resultado.ordemServicoCriada?.dataAgendada).toBeUndefined();
      },
    );

    it('repete a pergunta quando a entrada nao e nem uma data valida nem uma recusa reconhecida', async () => {
      const { useCase } = montarUseCase();

      await chegarEmAguardandoDataAgendamento(useCase);

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'qualquer coisa' });

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_data_agendamento');
      expect(resultado.ordemServicoCriada).toBeUndefined();
    });

    it('nao avanca e pede outra data quando a data informada e valida mas nenhum tecnico esta disponivel', async () => {
      const { useCase, ordemServicoRepository, usuarioRepository } = montarUseCase();
      usuarioRepository.seed(criarUsuarioFake({ id: 'tecnico-ocupado', papel: 'tecnico' }));
      ordemServicoRepository.seed(
        criarOrdemServicoFake({
          id: 'os-ocupada',
          tecnicoId: 'tecnico-ocupado',
          dataAgendada: new Date(2026, 7, 20, 9, 0),
        }),
      );

      await chegarEmAguardandoDataAgendamento(useCase);

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: '20/08/2026 09:00' });

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_data_agendamento');
      expect(resultado.ordemServicoCriada).toBeUndefined();
      expect(ordemServicoRepository.ordens).toHaveLength(1);
      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem?.tipo === 'texto' ? mensagem.mensagem.toLowerCase() : '';
      expect(texto).toContain('ocupado');
    });

    it('checa disponibilidade novamente e cria a OS quando o cliente escolhe uma segunda data livre apos a primeira estar ocupada', async () => {
      const { useCase, ordemServicoRepository, usuarioRepository } = montarUseCase();
      usuarioRepository.seed(criarUsuarioFake({ id: 'tecnico-ocupado', papel: 'tecnico' }));
      ordemServicoRepository.seed(
        criarOrdemServicoFake({
          id: 'os-ocupada',
          tecnicoId: 'tecnico-ocupado',
          dataAgendada: new Date(2026, 7, 20, 9, 0),
        }),
      );

      await chegarEmAguardandoDataAgendamento(useCase);

      const primeiraTentativa = await useCase.execute({
        telefone: TELEFONE,
        mensagemRecebida: '20/08/2026 09:00',
      });
      expect(primeiraTentativa.conversa.estadoFluxo).toBe('aguardando_data_agendamento');
      expect(primeiraTentativa.ordemServicoCriada).toBeUndefined();

      const segundaTentativa = await useCase.execute({
        telefone: TELEFONE,
        mensagemRecebida: '21/08/2026 09:00',
      });

      expect(segundaTentativa.conversa.estadoFluxo).toBe('os_criada');
      expect(segundaTentativa.ordemServicoCriada).toBeDefined();
      expect(segundaTentativa.ordemServicoCriada?.dataAgendada).toEqual(new Date(2026, 7, 21, 9, 0));
      expect(ordemServicoRepository.ordens).toHaveLength(2);
    });
  });

  describe('deteccao de duvida geral -> FAQ -> escalonamento', () => {
    it('responde com a resposta da FAQ quando a mensagem parece duvida geral e a FAQ sabe responder', async () => {
      const respostaFaq = 'Atendemos de segunda a sexta, das 8h as 18h.';
      const { useCase, solicitacaoAtendimentoRepository, conversaWhatsappRepository } = montarUseCase({
        chamarModeloFaq: async () => JSON.stringify({ respondeu: true, resposta: respostaFaq }),
      });

      const resultado = await useCase.execute({
        telefone: TELEFONE,
        mensagemRecebida: 'Qual o horario de atendimento?',
      });

      expect(resultado.respostasParaEnviar).toEqual([{ tipo: 'texto', mensagem: respostaFaq }]);
      expect(resultado.conversa.estadoFluxo).toBe('inicio');
      expect(solicitacaoAtendimentoRepository.solicitacoes).toHaveLength(0);
      expect(conversaWhatsappRepository.conversas.filter((c) => c.telefoneWhatsapp === TELEFONE)).toHaveLength(1);
    });

    it('cria solicitacao de atendimento e avisa o cliente quando a FAQ nao sabe responder', async () => {
      const { useCase, clienteRepository, solicitacaoAtendimentoRepository } = montarUseCase({
        chamarModeloFaq: async () => JSON.stringify({ respondeu: false, resposta: null }),
      });

      const resultado = await useCase.execute({
        telefone: TELEFONE,
        mensagemRecebida: 'Voces fazem instalacao de piscina?',
      });

      expect(solicitacaoAtendimentoRepository.solicitacoes).toHaveLength(1);
      expect(solicitacaoAtendimentoRepository.solicitacoes[0]?.mensagemCliente).toBe(
        'Voces fazem instalacao de piscina?',
      );
      expect(solicitacaoAtendimentoRepository.solicitacoes[0]?.clienteId).toBe(clienteRepository.clientes[0]?.id);
      expect(resultado.conversa.estadoFluxo).toBe('inicio');

      const mensagem = resultado.respostasParaEnviar[0];
      const texto = mensagem?.tipo === 'texto' ? mensagem.mensagem.toLowerCase() : '';
      expect(texto).toContain('encaminhei');
    });

    it('nao chama a FAQ quando a mensagem expressa intencao de consulta de status', async () => {
      const chamarModeloFaq = vi.fn(async () => JSON.stringify({ respondeu: false, resposta: null }));
      const { useCase, solicitacaoAtendimentoRepository } = montarUseCase({ chamarModeloFaq });

      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'qual o status da minha OS?' });

      expect(chamarModeloFaq).not.toHaveBeenCalled();
      expect(solicitacaoAtendimentoRepository.solicitacoes).toHaveLength(0);
    });

    it('segue o fluxo padrao de abertura de OS sem chamar a FAQ quando a mensagem nao parece pergunta', async () => {
      const chamarModeloFaq = vi.fn(async () => JSON.stringify({ respondeu: false, resposta: null }));
      const { useCase } = montarUseCase({ chamarModeloFaq });

      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_nome_cliente');
      expect(chamarModeloFaq).not.toHaveBeenCalled();
    });

    it('nao interrompe o fluxo de abertura de OS em andamento com uma mensagem ambigua parecida com pergunta', async () => {
      const chamarModeloFaq = vi.fn(async () => JSON.stringify({ respondeu: true, resposta: 'nao deveria chegar aqui' }));
      const { useCase } = montarUseCase({ chamarModeloFaq });

      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Oi' });
      await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Joao' });

      // Em aguardando_categoria (fluxo ja em andamento), uma mensagem com "?"
      // nao deve ser desviada para a FAQ.
      const resultado = await useCase.execute({ telefone: TELEFONE, mensagemRecebida: 'Qual categoria eu escolho?' });

      expect(resultado.conversa.estadoFluxo).toBe('aguardando_categoria');
      expect(chamarModeloFaq).not.toHaveBeenCalled();
    });
  });
});

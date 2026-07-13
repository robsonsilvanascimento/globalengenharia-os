import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { WhatsappConversaJobData } from '../../../../shared/infra/queues';

const {
  enviarTextoMock,
  enviarMenuCategoriasMock,
  enviarAudioMock,
  marcarComoLidoEDigitandoMock,
  baixarMediaMock,
  transcreverAudioMock,
  gerarAudioMock,
} = vi.hoisted(() => ({
  enviarTextoMock: vi.fn(),
  enviarMenuCategoriasMock: vi.fn(),
  enviarAudioMock: vi.fn(),
  marcarComoLidoEDigitandoMock: vi.fn(),
  baixarMediaMock: vi.fn(),
  transcreverAudioMock: vi.fn(),
  gerarAudioMock: vi.fn(),
}));

vi.mock('../MetaCloudApiClient', () => ({
  enviarTexto: enviarTextoMock,
  enviarMenuCategorias: enviarMenuCategoriasMock,
  enviarAudio: enviarAudioMock,
  marcarComoLidoEDigitando: marcarComoLidoEDigitandoMock,
  baixarMedia: baixarMediaMock,
}));

vi.mock('../../../../shared/infra/audio/TranscreverAudioService', () => ({
  transcreverAudio: transcreverAudioMock,
}));

vi.mock('../../../../shared/infra/audio/GerarAudioService', () => ({
  gerarAudio: gerarAudioMock,
}));

import { processarJob, type WhatsappConversaWorkerDeps } from './whatsapp-conversa-worker';

const TELEFONE = '5511999999999';
const WA_MESSAGE_ID = 'wamid.entrada-1';

function buildJob(data: Partial<WhatsappConversaJobData>): Job<WhatsappConversaJobData> {
  return {
    data: {
      telefoneCliente: TELEFONE,
      waMessageId: WA_MESSAGE_ID,
      recebidoEm: new Date().toISOString(),
      ...data,
    },
  } as Job<WhatsappConversaJobData>;
}

function buildDeps(): WhatsappConversaWorkerDeps & {
  processarMensagemWhatsappUseCase: { execute: ReturnType<typeof vi.fn> };
  mensagemWhatsappRepository: { create: ReturnType<typeof vi.fn> };
  conversaWhatsappRepository: { findByTelefone: ReturnType<typeof vi.fn> };
  clienteRepository: { findByTelefone: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  criarMidiaOrdemServicoUseCase: { execute: ReturnType<typeof vi.fn> };
} {
  return {
    processarMensagemWhatsappUseCase: { execute: vi.fn() },
    mensagemWhatsappRepository: { create: vi.fn() },
    conversaWhatsappRepository: { findByTelefone: vi.fn().mockResolvedValue(null) },
    clienteRepository: {
      findByTelefone: vi.fn().mockResolvedValue({ id: 'cliente-1' }),
      create: vi.fn(),
    },
    criarMidiaOrdemServicoUseCase: { execute: vi.fn() },
  } as unknown as WhatsappConversaWorkerDeps & {
    processarMensagemWhatsappUseCase: { execute: ReturnType<typeof vi.fn> };
    mensagemWhatsappRepository: { create: ReturnType<typeof vi.fn> };
    conversaWhatsappRepository: { findByTelefone: ReturnType<typeof vi.fn> };
    clienteRepository: { findByTelefone: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    criarMidiaOrdemServicoUseCase: { execute: ReturnType<typeof vi.fn> };
  };
}

describe('processarJob (whatsapp-conversa-worker)', () => {
  beforeEach(() => {
    enviarTextoMock.mockReset().mockResolvedValue({ sucesso: true, messageId: 'wamid.saida-1' });
    enviarMenuCategoriasMock.mockReset().mockResolvedValue({ sucesso: true, messageId: 'wamid.saida-menu-1' });
    enviarAudioMock.mockReset().mockResolvedValue({ sucesso: true, messageId: 'wamid.saida-audio-1' });
    marcarComoLidoEDigitandoMock.mockReset().mockResolvedValue({ sucesso: true, messageId: WA_MESSAGE_ID });
    baixarMediaMock.mockReset();
    transcreverAudioMock.mockReset();
    gerarAudioMock.mockReset();
  });

  it('chama marcarComoLidoEDigitando com o waMessageId assim que o job e processado', async () => {
    const deps = buildDeps();
    deps.processarMensagemWhatsappUseCase.execute.mockResolvedValue({
      conversa: { id: 'conversa-1' },
      respostasParaEnviar: [],
    });

    const job = buildJob({ tipo: 'text', conteudo: 'Ola' });
    await processarJob(job, deps);

    expect(marcarComoLidoEDigitandoMock).toHaveBeenCalledWith(WA_MESSAGE_ID);
  });

  it('nao bloqueia o processamento quando marcarComoLidoEDigitando falha', async () => {
    marcarComoLidoEDigitandoMock.mockResolvedValue({ sucesso: false, erro: 'erro qualquer' });

    const deps = buildDeps();
    deps.processarMensagemWhatsappUseCase.execute.mockResolvedValue({
      conversa: { id: 'conversa-1' },
      respostasParaEnviar: [{ tipo: 'texto', mensagem: 'Oi!' }],
    });

    const job = buildJob({ tipo: 'text', conteudo: 'Ola' });
    await processarJob(job, deps);

    expect(deps.processarMensagemWhatsappUseCase.execute).toHaveBeenCalledTimes(1);
    expect(enviarTextoMock).toHaveBeenCalledWith(TELEFONE, 'Oi!');
  });

  it('mensagem de texto normal: processa e envia resposta via enviarTexto (sem TTS)', async () => {
    const deps = buildDeps();
    deps.processarMensagemWhatsappUseCase.execute.mockResolvedValue({
      conversa: { id: 'conversa-1' },
      respostasParaEnviar: [{ tipo: 'texto', mensagem: 'Resposta em texto' }],
    });

    const job = buildJob({ tipo: 'text', conteudo: 'Preciso de um encanador' });
    await processarJob(job, deps);

    expect(deps.processarMensagemWhatsappUseCase.execute).toHaveBeenCalledWith({
      telefone: TELEFONE,
      mensagemRecebida: 'Preciso de um encanador',
    });
    expect(gerarAudioMock).not.toHaveBeenCalled();
    expect(enviarTextoMock).toHaveBeenCalledWith(TELEFONE, 'Resposta em texto');
    expect(enviarAudioMock).not.toHaveBeenCalled();
    expect(deps.mensagemWhatsappRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'entrada', tipoConteudo: 'text', conteudo: 'Preciso de um encanador' }),
    );
  });

  it('fluxo completo de audio: baixa, transcreve, processa e responde em audio (TTS)', async () => {
    const buffer = Buffer.from('audio-binario');
    baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: buffer, mimeType: 'audio/ogg' });
    transcreverAudioMock.mockResolvedValue({ sucesso: true, texto: 'Preciso de um encanador' });
    gerarAudioMock.mockResolvedValue({ sucesso: true, conteudo: Buffer.from('audio-resposta'), mimeType: 'audio/ogg' });

    const deps = buildDeps();
    deps.processarMensagemWhatsappUseCase.execute.mockResolvedValue({
      conversa: { id: 'conversa-1' },
      respostasParaEnviar: [{ tipo: 'texto', mensagem: 'Certo, qual categoria?' }],
    });

    const job = buildJob({ tipo: 'audio', conteudo: 'media-id-123' });
    await processarJob(job, deps);

    expect(baixarMediaMock).toHaveBeenCalledWith('media-id-123');
    expect(transcreverAudioMock).toHaveBeenCalledWith(buffer, 'audio/ogg');
    expect(deps.processarMensagemWhatsappUseCase.execute).toHaveBeenCalledWith({
      telefone: TELEFONE,
      mensagemRecebida: 'Preciso de um encanador',
    });
    expect(gerarAudioMock).toHaveBeenCalledWith('Certo, qual categoria?');
    expect(enviarAudioMock).toHaveBeenCalledWith(TELEFONE, Buffer.from('audio-resposta'), 'audio/ogg');
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(deps.mensagemWhatsappRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'entrada', tipoConteudo: 'audio', conteudo: 'Preciso de um encanador' }),
    );
    expect(deps.mensagemWhatsappRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'saida', tipoConteudo: 'audio', conteudo: 'Certo, qual categoria?' }),
    );
  });

  it('menu de categorias e sempre enviado como interactive, mesmo quando a pergunta veio em audio', async () => {
    baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: Buffer.from('x'), mimeType: 'audio/ogg' });
    transcreverAudioMock.mockResolvedValue({ sucesso: true, texto: 'Quero abrir uma OS' });

    const deps = buildDeps();
    deps.processarMensagemWhatsappUseCase.execute.mockResolvedValue({
      conversa: { id: 'conversa-1' },
      respostasParaEnviar: [{ tipo: 'menu_categorias', categorias: [{ id: 'cat-1', nome: 'Encanamento' }] }],
    });

    const job = buildJob({ tipo: 'audio', conteudo: 'media-id-456' });
    await processarJob(job, deps);

    expect(enviarMenuCategoriasMock).toHaveBeenCalledWith(TELEFONE, [{ id: 'cat-1', nome: 'Encanamento' }]);
    expect(gerarAudioMock).not.toHaveBeenCalled();
    expect(enviarAudioMock).not.toHaveBeenCalled();
  });

  it('falha ao baixar o audio: responde com mensagem amigavel e nao avanca a conversa', async () => {
    baixarMediaMock.mockResolvedValue({ sucesso: false, erro: 'download falhou' });

    const deps = buildDeps();

    const job = buildJob({ tipo: 'audio', conteudo: 'media-id-789' });
    await processarJob(job, deps);

    expect(deps.processarMensagemWhatsappUseCase.execute).not.toHaveBeenCalled();
    expect(transcreverAudioMock).not.toHaveBeenCalled();
    expect(enviarTextoMock).toHaveBeenCalledWith(
      TELEFONE,
      'Nao consegui entender seu audio, pode tentar novamente ou escrever sua mensagem?',
    );
    expect(deps.mensagemWhatsappRepository.create).not.toHaveBeenCalled();
  });

  it('falha na transcricao do audio: responde com mensagem amigavel e nao avanca a conversa', async () => {
    baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: Buffer.from('x'), mimeType: 'audio/ogg' });
    transcreverAudioMock.mockResolvedValue({ sucesso: false, erro: 'transcricao falhou' });

    const deps = buildDeps();

    const job = buildJob({ tipo: 'audio', conteudo: 'media-id-999' });
    await processarJob(job, deps);

    expect(deps.processarMensagemWhatsappUseCase.execute).not.toHaveBeenCalled();
    expect(enviarTextoMock).toHaveBeenCalledWith(
      TELEFONE,
      'Nao consegui entender seu audio, pode tentar novamente ou escrever sua mensagem?',
    );
    expect(deps.mensagemWhatsappRepository.create).not.toHaveBeenCalled();
  });

  it('falha ao gerar audio de resposta (TTS): cai para texto normal', async () => {
    baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: Buffer.from('x'), mimeType: 'audio/ogg' });
    transcreverAudioMock.mockResolvedValue({ sucesso: true, texto: 'Qual o status da minha OS?' });
    gerarAudioMock.mockResolvedValue({ sucesso: false, erro: 'erro da API da OpenAI' });

    const deps = buildDeps();
    deps.processarMensagemWhatsappUseCase.execute.mockResolvedValue({
      conversa: { id: 'conversa-1' },
      respostasParaEnviar: [{ tipo: 'texto', mensagem: 'Sua OS esta em andamento' }],
    });

    const job = buildJob({ tipo: 'audio', conteudo: 'media-id-111' });
    await processarJob(job, deps);

    expect(gerarAudioMock).toHaveBeenCalledWith('Sua OS esta em andamento');
    expect(enviarAudioMock).not.toHaveBeenCalled();
    expect(enviarTextoMock).toHaveBeenCalledWith(TELEFONE, 'Sua OS esta em andamento');
    expect(deps.mensagemWhatsappRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'saida', tipoConteudo: 'text', conteudo: 'Sua OS esta em andamento' }),
    );
  });

  describe('mensagem de video', () => {
    it('baixa o video, cria a midia e confirma com o numero da OS quando a conversa ja tem uma vinculada', async () => {
      const buffer = Buffer.from('video-binario');
      baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: buffer, mimeType: 'video/mp4' });

      const deps = buildDeps();
      deps.clienteRepository.findByTelefone.mockResolvedValue({ id: 'cliente-1' });
      deps.conversaWhatsappRepository.findByTelefone.mockResolvedValue({
        id: 'conversa-1',
        ordemServicoId: 'os-1',
        contextoDados: { numeroOrdemServico: 'OS-2026-0001' },
      });

      const job = buildJob({ tipo: 'video', conteudo: 'media-id-video-1' });
      await processarJob(job, deps);

      expect(baixarMediaMock).toHaveBeenCalledWith('media-id-video-1');
      expect(deps.criarMidiaOrdemServicoUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: 'cliente-1',
          ordemServicoId: 'os-1',
          tipo: 'video',
          buffer,
          mimeType: 'video/mp4',
          whatsappMediaId: 'media-id-video-1',
        }),
      );
      expect(enviarTextoMock).toHaveBeenCalledWith(
        TELEFONE,
        'Recebemos seu video, ele foi anexado a sua Ordem de Servico OS-2026-0001!',
      );
      expect(deps.processarMensagemWhatsappUseCase.execute).not.toHaveBeenCalled();
    });

    it('baixa o video, cria a midia e envia confirmacao generica quando ainda nao ha OS vinculada', async () => {
      const buffer = Buffer.from('video-binario');
      baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: buffer, mimeType: 'video/mp4' });

      const deps = buildDeps();
      deps.clienteRepository.findByTelefone.mockResolvedValue({ id: 'cliente-1' });
      deps.conversaWhatsappRepository.findByTelefone.mockResolvedValue({
        id: 'conversa-1',
        ordemServicoId: undefined,
        contextoDados: {},
      });

      const job = buildJob({ tipo: 'video', conteudo: 'media-id-video-2' });
      await processarJob(job, deps);

      expect(deps.criarMidiaOrdemServicoUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: 'cliente-1',
          ordemServicoId: undefined,
          tipo: 'video',
        }),
      );
      expect(enviarTextoMock).toHaveBeenCalledWith(
        TELEFONE,
        'Recebemos seu video, obrigado! Ele ficara registrado para nossa equipe.',
      );
    });

    it('falha ao baixar o video: responde com mensagem amigavel e nao cria a midia', async () => {
      baixarMediaMock.mockResolvedValue({ sucesso: false, erro: 'download falhou' });

      const deps = buildDeps();

      const job = buildJob({ tipo: 'video', conteudo: 'media-id-video-3' });
      await processarJob(job, deps);

      expect(enviarTextoMock).toHaveBeenCalledWith(
        TELEFONE,
        'Nao consegui processar seu video, pode tentar enviar novamente?',
      );
      expect(deps.criarMidiaOrdemServicoUseCase.execute).not.toHaveBeenCalled();
      expect(deps.processarMensagemWhatsappUseCase.execute).not.toHaveBeenCalled();
    });

    it('nao altera nem consulta o fluxo guiado da conversa (ex.: aguardando_descricao permanece intacto)', async () => {
      const buffer = Buffer.from('video-binario');
      baixarMediaMock.mockResolvedValue({ sucesso: true, conteudo: buffer, mimeType: 'video/mp4' });

      const deps = buildDeps();
      deps.conversaWhatsappRepository.findByTelefone.mockResolvedValue({
        id: 'conversa-1',
        estadoFluxo: 'aguardando_descricao',
        ordemServicoId: undefined,
        contextoDados: { categoriaId: 'cat-1' },
      });

      const job = buildJob({ tipo: 'video', conteudo: 'media-id-video-4' });
      await processarJob(job, deps);

      expect(deps.processarMensagemWhatsappUseCase.execute).not.toHaveBeenCalled();
      expect(deps.mensagemWhatsappRepository.create).not.toHaveBeenCalled();
    });
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { NotificacaoTecnicoJobData } from '../../../../../shared/infra/queues';
import type { Cliente } from '../../../../clientes/domain/Cliente';
import type { ClienteRepository } from '../../../../clientes/domain/ClienteRepository';
import type { OrdemServico } from '../../../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../../../ordens-servico/domain/OrdemServicoRepository';
import type { CategoriaServico } from '../../../../categorias-servico/domain/CategoriaServico';
import type { CategoriaServicoRepository } from '../../../../categorias-servico/domain/CategoriaServicoRepository';
import type { Usuario } from '../../../../auth/domain/Usuario';
import type { UsuarioRepository } from '../../../../auth/domain/UsuarioRepository';

const { enviarTextoMock } = vi.hoisted(() => ({
  enviarTextoMock: vi.fn(),
}));

vi.mock('../../../../whatsapp/infrastructure/MetaCloudApiClient', () => ({
  enviarTexto: enviarTextoMock,
}));

import { processarNotificacaoTecnicoJob } from '../notificacao-tecnico-worker';

function criarClienteFake(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: 'cliente-1',
    nome: 'Cliente Teste',
    telefoneWhatsapp: '5511999999999',
    documento: null,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarOrdemServicoFake(overrides: Partial<OrdemServico> = {}): OrdemServico {
  return {
    id: 'os-1',
    numero: 'OS-0001',
    clienteId: 'cliente-1',
    categoriaServicoId: 'categoria-1',
    descricaoProblema: 'Problema teste',
    prioridade: 'normal',
    status: 'atribuida',
    criadoVia: 'painel',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

function criarTecnicoFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'tecnico-1',
    nome: 'Tecnico Teste',
    email: 'tecnico@teste.com',
    senhaHash: 'hash',
    papel: 'tecnico',
    ativo: true,
    telefone: '5511988888888',
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarAjudanteFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'ajudante-1',
    nome: 'Ajudante Teste',
    email: 'ajudante@teste.com',
    senhaHash: 'hash',
    papel: 'tecnico',
    ativo: true,
    telefone: '5511977777777',
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarCategoriaFake(overrides: Partial<CategoriaServico> = {}): CategoriaServico {
  return {
    id: 'categoria-1',
    nome: 'Instalação Elétrica',
    area: 'eletrica',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarJobFake(
  data: NotificacaoTecnicoJobData,
): Job<NotificacaoTecnicoJobData> {
  return { data } as Job<NotificacaoTecnicoJobData>;
}

describe('processarNotificacaoTecnicoJob', () => {
  let clienteRepository: ClienteRepository;
  let ordemServicoRepository: OrdemServicoRepository;
  let usuarioRepository: UsuarioRepository;
  let categoriaServicoRepository: CategoriaServicoRepository;
  let findClienteByIdMock: ReturnType<typeof vi.fn>;
  let findOrdemServicoByIdMock: ReturnType<typeof vi.fn>;
  let findUsuarioByIdMock: ReturnType<typeof vi.fn>;
  let findCategoriaByIdMock: ReturnType<typeof vi.fn>;

  const jobData: NotificacaoTecnicoJobData = {
    ordemServicoId: 'os-1',
    tecnicoId: 'tecnico-1',
  };

  const jobDataComAjudante: NotificacaoTecnicoJobData = {
    ordemServicoId: 'os-1',
    tecnicoId: 'tecnico-1',
    ajudanteId: 'ajudante-1',
  };

  beforeEach(() => {
    enviarTextoMock.mockReset();
    enviarTextoMock.mockResolvedValue({ sucesso: true, messageId: 'wamid.123' });
    findClienteByIdMock = vi.fn().mockResolvedValue(criarClienteFake());
    findOrdemServicoByIdMock = vi.fn().mockResolvedValue(criarOrdemServicoFake());
    findCategoriaByIdMock = vi.fn().mockResolvedValue(criarCategoriaFake());
    findUsuarioByIdMock = vi.fn().mockImplementation((id: string) => {
      if (id === 'ajudante-1') {
        return Promise.resolve(criarAjudanteFake());
      }
      return Promise.resolve(criarTecnicoFake());
    });

    clienteRepository = { findById: findClienteByIdMock } as unknown as ClienteRepository;
    ordemServicoRepository = { findById: findOrdemServicoByIdMock } as unknown as OrdemServicoRepository;
    usuarioRepository = { findById: findUsuarioByIdMock } as unknown as UsuarioRepository;
    categoriaServicoRepository = { findById: findCategoriaByIdMock } as unknown as CategoriaServicoRepository;
  });

  it('monta a mensagem com dataAgendada formatada em pt-BR e envia ao tecnico', async () => {
    const dataAgendada = new Date(2026, 6, 15, 14, 30);
    findOrdemServicoByIdMock.mockResolvedValue(criarOrdemServicoFake({ dataAgendada }));

    await processarNotificacaoTecnicoJob(criarJobFake(jobData), {
      ordemServicoRepository,
      clienteRepository,
      usuarioRepository,
      categoriaServicoRepository,
    });

    const dataFormatada = dataAgendada.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    expect(enviarTextoMock).toHaveBeenCalledWith(
      '5511988888888',
      expect.stringContaining(dataFormatada),
    );
    expect(enviarTextoMock).toHaveBeenCalledWith(
      '5511988888888',
      expect.stringContaining('OS-0001'),
    );
  });

  it('usa "A combinar" quando a OS nao tem dataAgendada', async () => {
    findOrdemServicoByIdMock.mockResolvedValue(criarOrdemServicoFake({ dataAgendada: undefined }));

    await processarNotificacaoTecnicoJob(criarJobFake(jobData), {
      ordemServicoRepository,
      clienteRepository,
      usuarioRepository,
      categoriaServicoRepository,
    });

    expect(enviarTextoMock).toHaveBeenCalledWith(
      '5511988888888',
      expect.stringContaining('A combinar'),
    );
  });

  it('nao envia e loga aviso quando o tecnico nao tem telefone cadastrado', async () => {
    findUsuarioByIdMock.mockResolvedValue(criarTecnicoFake({ telefone: null }));

    await processarNotificacaoTecnicoJob(criarJobFake(jobData), {
      ordemServicoRepository,
      clienteRepository,
      usuarioRepository,
      categoriaServicoRepository,
    });

    expect(enviarTextoMock).not.toHaveBeenCalled();
  });

  it('trata falha no envio sem lancar excecao', async () => {
    enviarTextoMock.mockResolvedValue({ sucesso: false, erro: 'falha no envio' });

    await expect(
      processarNotificacaoTecnicoJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        usuarioRepository,
        categoriaServicoRepository,
      }),
    ).resolves.not.toThrow();

    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
  });

  it('trata erro inesperado (ex.: repositorio lancando excecao) sem lancar excecao', async () => {
    findOrdemServicoByIdMock.mockRejectedValue(new Error('erro de banco'));

    await expect(
      processarNotificacaoTecnicoJob(criarJobFake(jobData), {
        ordemServicoRepository,
        clienteRepository,
        usuarioRepository,
        categoriaServicoRepository,
      }),
    ).resolves.not.toThrow();

    expect(enviarTextoMock).not.toHaveBeenCalled();
  });

  it('ausencia de ajudanteId no job nao tenta notificar ninguem como ajudante', async () => {
    await processarNotificacaoTecnicoJob(criarJobFake(jobData), {
      ordemServicoRepository,
      clienteRepository,
      usuarioRepository,
      categoriaServicoRepository,
    });

    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect(enviarTextoMock).toHaveBeenCalledWith('5511988888888', expect.any(String));
    expect(findCategoriaByIdMock).not.toHaveBeenCalled();
  });

  it('notifica o ajudante corretamente quando presente e com telefone', async () => {
    const dataAgendada = new Date(2026, 6, 15, 14, 30);
    findOrdemServicoByIdMock.mockResolvedValue(criarOrdemServicoFake({ dataAgendada }));

    await processarNotificacaoTecnicoJob(criarJobFake(jobDataComAjudante), {
      ordemServicoRepository,
      clienteRepository,
      usuarioRepository,
      categoriaServicoRepository,
    });

    expect(enviarTextoMock).toHaveBeenCalledWith('5511988888888', expect.any(String));
    expect(enviarTextoMock).toHaveBeenCalledWith(
      '5511977777777',
      expect.stringContaining('Tecnico Teste'),
    );
    expect(enviarTextoMock).toHaveBeenCalledWith(
      '5511977777777',
      expect.stringContaining('Instalação Elétrica'),
    );
    expect(enviarTextoMock).toHaveBeenCalledWith(
      '5511977777777',
      expect.stringContaining('15/07/2026'),
    );
    expect(enviarTextoMock).toHaveBeenCalledTimes(2);
  });

  it('ajudante presente mas sem telefone nao tenta enviar (loga aviso, nao lanca erro)', async () => {
    findUsuarioByIdMock.mockImplementation((id: string) => {
      if (id === 'ajudante-1') {
        return Promise.resolve(criarAjudanteFake({ telefone: null }));
      }
      return Promise.resolve(criarTecnicoFake());
    });

    await expect(
      processarNotificacaoTecnicoJob(criarJobFake(jobDataComAjudante), {
        ordemServicoRepository,
        clienteRepository,
        usuarioRepository,
        categoriaServicoRepository,
      }),
    ).resolves.not.toThrow();

    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect(enviarTextoMock).toHaveBeenCalledWith('5511988888888', expect.any(String));
  });

  it('falha no envio ao ajudante nao impede o envio ao tecnico', async () => {
    enviarTextoMock.mockImplementation((telefone: string) => {
      if (telefone === '5511977777777') {
        return Promise.reject(new Error('falha ao enviar ao ajudante'));
      }
      return Promise.resolve({ sucesso: true, messageId: 'wamid.123' });
    });

    await expect(
      processarNotificacaoTecnicoJob(criarJobFake(jobDataComAjudante), {
        ordemServicoRepository,
        clienteRepository,
        usuarioRepository,
        categoriaServicoRepository,
      }),
    ).resolves.not.toThrow();

    expect(enviarTextoMock).toHaveBeenCalledWith('5511988888888', expect.any(String));
    expect(enviarTextoMock).toHaveBeenCalledWith('5511977777777', expect.any(String));
  });
});

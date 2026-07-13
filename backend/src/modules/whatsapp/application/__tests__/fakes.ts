import type { Cliente } from '../../../clientes/domain/Cliente';
import type { ClienteRepository, CriarClienteDados } from '../../../clientes/domain/ClienteRepository';
import type { CategoriaServico } from '../../../categorias-servico/domain/CategoriaServico';
import type { CategoriaServicoRepository } from '../../../categorias-servico/domain/CategoriaServicoRepository';
import type { Usuario } from '../../../auth/domain/Usuario';
import type {
  AtualizarUsuarioDados,
  CriarUsuarioDados,
  UsuarioRepository,
} from '../../../auth/domain/UsuarioRepository';
import type { FaqEntry } from '../../../faq/domain/FaqEntry';
import type {
  AtualizarFaqEntryDados,
  CriarFaqEntryDados,
  FaqEntryRepository,
} from '../../../faq/domain/FaqEntryRepository';
import type { ConversaWhatsapp } from '../../domain/ConversaWhatsapp';
import type {
  AtualizarConversaWhatsappDados,
  ConversaWhatsappRepository,
  CriarConversaWhatsappDados,
} from '../../domain/ConversaWhatsappRepository';

/** Fakes em memoria usados nos testes de `ProcessarMensagemWhatsappUseCase` (sem Postgres real). */
export class FakeClienteRepository implements ClienteRepository {
  public clientes: Cliente[] = [];
  private seq = 0;

  seed(cliente: Cliente): void {
    this.clientes.push(cliente);
  }

  async list(): Promise<Cliente[]> {
    return this.clientes;
  }

  async findById(id: string): Promise<Cliente | null> {
    return this.clientes.find((cliente) => cliente.id === id) ?? null;
  }

  async findByTelefone(telefone: string): Promise<Cliente | null> {
    return this.clientes.find((cliente) => cliente.telefoneWhatsapp === telefone) ?? null;
  }

  async create(dados: CriarClienteDados): Promise<Cliente> {
    this.seq += 1;
    const cliente: Cliente = {
      id: `cliente-${this.seq}`,
      nome: dados.nome,
      telefoneWhatsapp: dados.telefoneWhatsapp,
      documento: dados.documento,
      email: dados.email,
      criadoEm: new Date(),
    };
    this.clientes.push(cliente);
    return cliente;
  }

  async update(id: string, dados: Partial<{ nome: string; email: string }>): Promise<Cliente> {
    const cliente = this.clientes.find((item) => item.id === id);
    if (!cliente) {
      throw new Error(`Cliente ${id} nao encontrado (fake)`);
    }

    if (dados.nome !== undefined) cliente.nome = dados.nome;
    if (dados.email !== undefined) cliente.email = dados.email;

    return cliente;
  }
}

export class FakeCategoriaServicoRepository implements CategoriaServicoRepository {
  constructor(public categorias: CategoriaServico[] = []) {}

  async list(incluirInativas: boolean): Promise<CategoriaServico[]> {
    return incluirInativas ? this.categorias : this.categorias.filter((categoria) => categoria.ativo);
  }

  async findById(id: string): Promise<CategoriaServico | null> {
    return this.categorias.find((categoria) => categoria.id === id) ?? null;
  }

  async create(): Promise<CategoriaServico> {
    throw new Error('nao implementado no fake');
  }

  async update(): Promise<CategoriaServico> {
    throw new Error('nao implementado no fake');
  }
}

export class FakeConversaWhatsappRepository implements ConversaWhatsappRepository {
  public conversas: ConversaWhatsapp[] = [];
  private seq = 0;

  async findByTelefone(telefone: string): Promise<ConversaWhatsapp | null> {
    const encontradas = this.conversas
      .filter((conversa) => conversa.telefoneWhatsapp === telefone)
      .sort((a, b) => b.iniciadaEm.getTime() - a.iniciadaEm.getTime());
    return encontradas[0] ?? null;
  }

  async create(dados: CriarConversaWhatsappDados): Promise<ConversaWhatsapp> {
    this.seq += 1;
    const agora = new Date();
    const conversa: ConversaWhatsapp = {
      id: `conversa-${this.seq}`,
      clienteId: dados.clienteId,
      telefoneWhatsapp: dados.telefoneWhatsapp,
      estadoFluxo: dados.estadoFluxo,
      contextoDados: dados.contextoDados,
      iniciadaEm: agora,
      atualizadaEm: agora,
    };
    this.conversas.push(conversa);
    return conversa;
  }

  async update(id: string, dados: AtualizarConversaWhatsappDados): Promise<ConversaWhatsapp> {
    const conversa = this.conversas.find((item) => item.id === id);
    if (!conversa) {
      throw new Error(`ConversaWhatsapp ${id} nao encontrada (fake)`);
    }

    if (dados.estadoFluxo !== undefined) conversa.estadoFluxo = dados.estadoFluxo;
    if (dados.contextoDados !== undefined) conversa.contextoDados = dados.contextoDados;
    if (dados.ordemServicoId !== undefined) conversa.ordemServicoId = dados.ordemServicoId;
    conversa.atualizadaEm = new Date();

    return conversa;
  }
}

/** Fake em memoria de UsuarioRepository, usado para injetar VerificarDisponibilidadeUseCase nos testes. */
export class FakeUsuarioRepository implements UsuarioRepository {
  public usuarios: Usuario[] = [];
  private seq = 0;

  seed(usuario: Usuario): void {
    this.usuarios.push(usuario);
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.find((usuario) => usuario.email === email) ?? null;
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.usuarios.find((usuario) => usuario.id === id) ?? null;
  }

  async create(dados: CriarUsuarioDados): Promise<Usuario> {
    this.seq += 1;
    const usuario: Usuario = {
      id: `usuario-${this.seq}`,
      nome: dados.nome,
      email: dados.email,
      senhaHash: dados.senhaHash,
      papel: dados.papel,
      ativo: dados.ativo ?? true,
      telefone: dados.telefone,
      valorHora: dados.valorHora,
      criadoEm: new Date(),
    };
    this.usuarios.push(usuario);
    return usuario;
  }

  async list(): Promise<Usuario[]> {
    return this.usuarios;
  }

  async update(id: string, dados: AtualizarUsuarioDados): Promise<Usuario> {
    const usuario = this.usuarios.find((item) => item.id === id);
    if (!usuario) {
      throw new Error(`Usuario ${id} nao encontrado (fake)`);
    }

    if (dados.nome !== undefined) usuario.nome = dados.nome;
    if (dados.email !== undefined) usuario.email = dados.email;
    if (dados.senhaHash !== undefined) usuario.senhaHash = dados.senhaHash;
    if (dados.papel !== undefined) usuario.papel = dados.papel;
    if (dados.ativo !== undefined) usuario.ativo = dados.ativo;
    if (dados.telefone !== undefined) usuario.telefone = dados.telefone ?? undefined;
    if (dados.valorHora !== undefined) usuario.valorHora = dados.valorHora ?? undefined;

    return usuario;
  }

  async findByResetTokenHash(): Promise<Usuario | null> {
    throw new Error('nao usado neste fake');
  }

  async salvarTokenReset(): Promise<void> {
    throw new Error('nao usado neste fake');
  }

  async atualizarSenha(): Promise<void> {
    throw new Error('nao usado neste fake');
  }
}

export function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'usuario-tecnico-1',
    nome: 'Tecnico Fulano',
    email: 'tecnico@example.com',
    senhaHash: 'hash-fake',
    papel: 'tecnico',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

/** Fake em memoria de FaqEntryRepository, usado para injetar BuscarRespostaFaqUseCase nos testes. */
export class FakeFaqEntryRepository implements FaqEntryRepository {
  constructor(public entradas: FaqEntry[] = []) {}

  async list(incluirInativas: boolean): Promise<FaqEntry[]> {
    return incluirInativas ? this.entradas : this.entradas.filter((entrada) => entrada.ativo);
  }

  async findById(id: string): Promise<FaqEntry | null> {
    return this.entradas.find((entrada) => entrada.id === id) ?? null;
  }

  async create(_dados: CriarFaqEntryDados): Promise<FaqEntry> {
    throw new Error('nao implementado no fake');
  }

  async update(_id: string, _dados: AtualizarFaqEntryDados): Promise<FaqEntry> {
    throw new Error('nao implementado no fake');
  }
}

export function criarFaqEntryFake(overrides: Partial<FaqEntry> = {}): FaqEntry {
  return {
    id: 'faq-1',
    pergunta: 'Qual o horario de atendimento?',
    resposta: 'Atendemos de segunda a sexta, das 8h as 18h.',
    tags: null,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides,
  };
}

export function criarCategoriaServicoFake(overrides: Partial<CategoriaServico> = {}): CategoriaServico {
  return {
    id: 'categoria-1',
    nome: 'Eletrica',
    area: 'eletrica',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

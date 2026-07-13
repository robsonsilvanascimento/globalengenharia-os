import { describe, expect, it } from 'vitest';
import { processarFluxoConversa, type CategoriaDisponivel } from './FluxoConversa';

const categorias: CategoriaDisponivel[] = [
  { id: 'cat-1', nome: 'Eletrica' },
  { id: 'cat-2', nome: 'Automacao' },
];

describe('processarFluxoConversa', () => {
  describe('estado inicio', () => {
    it('pede o nome quando o cliente e novo (clienteConhecido: false)', () => {
      const resultado = processarFluxoConversa('inicio', { clienteConhecido: false }, 'Oi', categorias);

      expect(resultado.novoEstado).toBe('aguardando_nome_cliente');
      expect(resultado.respostasParaEnviar).toEqual([
        { tipo: 'texto', mensagem: expect.stringContaining('nome completo') },
      ]);
    });

    it('pula direto para o menu de categorias quando o cliente ja e conhecido', () => {
      const resultado = processarFluxoConversa(
        'inicio',
        { clienteConhecido: true, nomeCliente: 'Joao' },
        'Oi',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_categoria');
      expect(resultado.respostasParaEnviar).toEqual([
        { tipo: 'texto', mensagem: expect.stringContaining('Joao') },
        { tipo: 'menu_categorias', categorias },
      ]);
    });
  });

  describe('estado aguardando_nome_cliente', () => {
    it('reenvia a pergunta quando o nome recebido esta vazio', () => {
      const resultado = processarFluxoConversa(
        'aguardando_nome_cliente',
        { clienteConhecido: false },
        '   ',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_nome_cliente');
      expect(resultado.novoContexto.nomeCliente).toBeUndefined();
      expect(resultado.respostasParaEnviar).toHaveLength(1);
    });

    it('avanca para aguardando_categoria e guarda o nome no contexto', () => {
      const resultado = processarFluxoConversa(
        'aguardando_nome_cliente',
        { clienteConhecido: false },
        'Maria Silva',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_categoria');
      expect(resultado.novoContexto.nomeCliente).toBe('Maria Silva');
      expect(resultado.respostasParaEnviar).toEqual([
        { tipo: 'texto', mensagem: expect.stringContaining('Maria Silva') },
        { tipo: 'menu_categorias', categorias },
      ]);
    });
  });

  describe('estado aguardando_categoria', () => {
    it('avanca para aguardando_descricao quando a categoria escolhida por id existe', () => {
      const resultado = processarFluxoConversa(
        'aguardando_categoria',
        { nomeCliente: 'Maria' },
        'cat-2',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_descricao');
      expect(resultado.novoContexto.categoriaId).toBe('cat-2');
      expect(resultado.novoContexto.categoriaNome).toBe('Automacao');
    });

    it('aceita a categoria escolhida pelo nome (case-insensitive)', () => {
      const resultado = processarFluxoConversa(
        'aguardando_categoria',
        { nomeCliente: 'Maria' },
        'eletrica',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_descricao');
      expect(resultado.novoContexto.categoriaId).toBe('cat-1');
    });

    it('mantem o estado e reenvia o menu quando a opcao e invalida (fora do menu)', () => {
      const resultado = processarFluxoConversa(
        'aguardando_categoria',
        { nomeCliente: 'Maria' },
        'cat-inexistente',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_categoria');
      expect(resultado.novoContexto.categoriaId).toBeUndefined();
      expect(resultado.respostasParaEnviar).toEqual([
        { tipo: 'texto', mensagem: expect.stringContaining('invalida') },
        { tipo: 'menu_categorias', categorias },
      ]);
    });
  });

  describe('estado aguardando_descricao', () => {
    it('reenvia a pergunta quando a descricao recebida esta vazia', () => {
      const resultado = processarFluxoConversa(
        'aguardando_descricao',
        { categoriaId: 'cat-1', categoriaNome: 'Eletrica' },
        '',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_descricao');
      expect(resultado.novoContexto.descricaoProblema).toBeUndefined();
    });

    it('avanca para aguardando_email e guarda a descricao no contexto', () => {
      const resultado = processarFluxoConversa(
        'aguardando_descricao',
        { categoriaId: 'cat-1', categoriaNome: 'Eletrica' },
        'Disjuntor desarmando toda hora',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_email');
      expect(resultado.novoContexto.descricaoProblema).toBe('Disjuntor desarmando toda hora');
      expect(resultado.respostasParaEnviar).toEqual([
        { tipo: 'texto', mensagem: expect.stringContaining('e-mail') },
      ]);
    });
  });

  describe('estado aguardando_email', () => {
    const contextoBase = {
      categoriaId: 'cat-1',
      categoriaNome: 'Eletrica',
      descricaoProblema: 'Disjuntor desarmando toda hora',
    };

    it.each(['nao', 'não', 'Nao', 'N', 'pular', ''])(
      'avanca para aguardando_data_agendamento sem guardar e-mail quando a resposta e uma recusa ("%s")',
      (recusa) => {
        const resultado = processarFluxoConversa('aguardando_email', contextoBase, recusa, categorias);

        expect(resultado.novoEstado).toBe('aguardando_data_agendamento');
        expect(resultado.novoContexto.emailCliente).toBeUndefined();
      },
    );

    it('avanca para aguardando_data_agendamento e guarda o e-mail quando o formato e valido', () => {
      const resultado = processarFluxoConversa(
        'aguardando_email',
        contextoBase,
        'cliente@exemplo.com',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_data_agendamento');
      expect(resultado.novoContexto.emailCliente).toBe('cliente@exemplo.com');
    });

    it('mantem o estado e repete a pergunta quando a entrada nao e recusa nem e-mail valido', () => {
      const resultado = processarFluxoConversa('aguardando_email', contextoBase, 'talvez depois', categorias);

      expect(resultado.novoEstado).toBe('aguardando_email');
      expect(resultado.novoContexto.emailCliente).toBeUndefined();
      expect(resultado.respostasParaEnviar).toHaveLength(1);
    });
  });

  describe('estado aguardando_data_agendamento', () => {
    const contextoBase = {
      categoriaId: 'cat-1',
      categoriaNome: 'Eletrica',
      descricaoProblema: 'Disjuntor desarmando toda hora',
    };

    it('avanca para os_criada e guarda a data no contexto (ISO) quando o formato e valido', () => {
      const resultado = processarFluxoConversa(
        'aguardando_data_agendamento',
        contextoBase,
        '15/08/2026 14:30',
        categorias,
      );

      expect(resultado.novoEstado).toBe('os_criada');
      expect(resultado.novoContexto.dataAgendamentoISO).toBe(new Date(2026, 7, 15, 14, 30).toISOString());
    });

    it.each(['ainda nao sei', 'Ainda não sei', 'nao sei', 'Não Sei', 'depois', 'DEPOIS'])(
      'avanca para os_criada sem guardar data quando a resposta e uma recusa ("%s")',
      (recusa) => {
        const resultado = processarFluxoConversa('aguardando_data_agendamento', contextoBase, recusa, categorias);

        expect(resultado.novoEstado).toBe('os_criada');
        expect(resultado.novoContexto.dataAgendamentoISO).toBeUndefined();
      },
    );

    it('mantem o estado e repete a pergunta quando a entrada nao e uma data valida nem uma recusa reconhecida', () => {
      const resultado = processarFluxoConversa(
        'aguardando_data_agendamento',
        contextoBase,
        'qualquer coisa',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_data_agendamento');
      expect(resultado.novoContexto.dataAgendamentoISO).toBeUndefined();
      expect(resultado.respostasParaEnviar).toHaveLength(1);
    });

    it('mantem o estado quando a data informada tem formato correto mas componentes invalidos (ex.: 31/02)', () => {
      const resultado = processarFluxoConversa(
        'aguardando_data_agendamento',
        contextoBase,
        '31/02/2026 10:00',
        categorias,
      );

      expect(resultado.novoEstado).toBe('aguardando_data_agendamento');
      expect(resultado.novoContexto.dataAgendamentoISO).toBeUndefined();
    });
  });

  describe('estado os_criada', () => {
    it('permanece em os_criada e informa o numero da OS ja registrada, sem quebrar o fluxo', () => {
      const resultado = processarFluxoConversa(
        'os_criada',
        { numeroOrdemServico: 'OS-2026-000001' },
        'Alguma mensagem depois',
        categorias,
      );

      expect(resultado.novoEstado).toBe('os_criada');
      expect(resultado.respostasParaEnviar).toEqual([
        { tipo: 'texto', mensagem: expect.stringContaining('OS-2026-000001') },
      ]);
    });
  });
});

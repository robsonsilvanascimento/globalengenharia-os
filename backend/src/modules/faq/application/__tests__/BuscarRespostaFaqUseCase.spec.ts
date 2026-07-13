import { describe, expect, it } from 'vitest';
import { BuscarRespostaFaqUseCase } from '../BuscarRespostaFaqUseCase';
import type { FaqEntry } from '../../domain/FaqEntry';
import type {
  AtualizarFaqEntryDados,
  CriarFaqEntryDados,
  FaqEntryRepository,
} from '../../domain/FaqEntryRepository';

class FakeFaqEntryRepository implements FaqEntryRepository {
  constructor(private readonly entradas: FaqEntry[]) {}

  async list(incluirInativas: boolean): Promise<FaqEntry[]> {
    return incluirInativas ? this.entradas : this.entradas.filter((e) => e.ativo);
  }

  async findById(id: string): Promise<FaqEntry | null> {
    return this.entradas.find((e) => e.id === id) ?? null;
  }

  async create(_dados: CriarFaqEntryDados): Promise<FaqEntry> {
    throw new Error('nao implementado neste fake');
  }

  async update(_id: string, _dados: AtualizarFaqEntryDados): Promise<FaqEntry> {
    throw new Error('nao implementado neste fake');
  }
}

const faqAtiva: FaqEntry = {
  id: 'faq-1',
  pergunta: 'Qual o horario de atendimento?',
  resposta: 'Atendemos de segunda a sexta, das 8h as 18h.',
  tags: 'horario',
  ativo: true,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

describe('BuscarRespostaFaqUseCase', () => {
  it('retorna respondeu:true com a resposta quando o modelo encontra a informacao no JSON valido', async () => {
    const repository = new FakeFaqEntryRepository([faqAtiva]);
    const chamarModelo = async () =>
      JSON.stringify({ respondeu: true, resposta: 'Atendemos de segunda a sexta, das 8h as 18h.' });

    const useCase = new BuscarRespostaFaqUseCase({ faqEntryRepository: repository, chamarModelo });

    const resultado = await useCase.execute('Voces atendem em qual horario?');

    expect(resultado).toEqual({
      respondeu: true,
      resposta: 'Atendemos de segunda a sexta, das 8h as 18h.',
    });
  });

  it('retorna respondeu:false quando o modelo nao encontra informacao suficiente na FAQ', async () => {
    const repository = new FakeFaqEntryRepository([faqAtiva]);
    const chamarModelo = async () => JSON.stringify({ respondeu: false, resposta: null });

    const useCase = new BuscarRespostaFaqUseCase({ faqEntryRepository: repository, chamarModelo });

    const resultado = await useCase.execute('Voces fazem instalacao de piscina?');

    expect(resultado).toEqual({ respondeu: false });
  });

  it('retorna respondeu:false sem lancar excecao quando o modelo retorna JSON malformado', async () => {
    const repository = new FakeFaqEntryRepository([faqAtiva]);
    const chamarModelo = async () => 'isto nao e um JSON valido {{{';

    const useCase = new BuscarRespostaFaqUseCase({ faqEntryRepository: repository, chamarModelo });

    const resultado = await useCase.execute('Qual o horario de atendimento?');

    expect(resultado).toEqual({ respondeu: false });
  });

  it('retorna respondeu:false sem lancar excecao quando a chamada ao modelo falha', async () => {
    const repository = new FakeFaqEntryRepository([faqAtiva]);
    const chamarModelo = async () => {
      throw new Error('rede indisponivel / chave invalida / rate limit');
    };

    const useCase = new BuscarRespostaFaqUseCase({ faqEntryRepository: repository, chamarModelo });

    const resultado = await useCase.execute('Qual o horario de atendimento?');

    expect(resultado).toEqual({ respondeu: false });
  });

  it('retorna respondeu:false sem chamar o modelo quando nao ha entradas ativas na FAQ', async () => {
    const repository = new FakeFaqEntryRepository([]);
    let chamado = false;
    const chamarModelo = async () => {
      chamado = true;
      return JSON.stringify({ respondeu: true, resposta: 'nao deveria chegar aqui' });
    };

    const useCase = new BuscarRespostaFaqUseCase({ faqEntryRepository: repository, chamarModelo });

    const resultado = await useCase.execute('Qualquer pergunta');

    expect(resultado).toEqual({ respondeu: false });
    expect(chamado).toBe(false);
  });

  it('trata resposta com JSON envolto em bloco de codigo markdown', async () => {
    const repository = new FakeFaqEntryRepository([faqAtiva]);
    const chamarModelo = async () =>
      '```json\n{"respondeu": true, "resposta": "Atendemos de segunda a sexta, das 8h as 18h."}\n```';

    const useCase = new BuscarRespostaFaqUseCase({ faqEntryRepository: repository, chamarModelo });

    const resultado = await useCase.execute('Qual o horario de atendimento?');

    expect(resultado).toEqual({
      respondeu: true,
      resposta: 'Atendemos de segunda a sexta, das 8h as 18h.',
    });
  });
});

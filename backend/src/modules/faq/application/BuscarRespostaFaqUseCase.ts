import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../../shared/infra/Logger';
import type { FaqEntry } from '../domain/FaqEntry';
import type { FaqEntryRepository } from '../domain/FaqEntryRepository';

/** Resultado da busca de resposta na FAQ via IA. */
export type RespostaFaq = { respondeu: true; resposta: string } | { respondeu: false };

/**
 * Funcao que envia o prompt ao modelo de IA e retorna o texto bruto da
 * resposta. Permite injetar um fake nos testes, sem depender da API real da
 * Anthropic.
 */
export type ChamarModeloFn = (params: { systemPrompt: string; pergunta: string }) => Promise<string>;

export interface BuscarRespostaFaqDeps {
  faqEntryRepository: FaqEntryRepository;
  /** Cliente Anthropic customizado (opcional, util em testes). Se omitido, um cliente real e criado usando ANTHROPIC_API_KEY. */
  anthropicClient?: Anthropic;
  /** Funcao que chama o modelo (opcional, para testes). Se informada, tem prioridade sobre anthropicClient. */
  chamarModelo?: ChamarModeloFn;
}

const MODELO_DEFAULT = 'claude-haiku-4-5-20251001';

function montarSystemPrompt(faqEntries: FaqEntry[]): string {
  const baseConhecimento = faqEntries
    .map((entry, index) => `${index + 1}. Pergunta: ${entry.pergunta}\n   Resposta: ${entry.resposta}`)
    .join('\n');

  return [
    'Voce e um assistente de atendimento ao cliente que responde perguntas usando EXCLUSIVAMENTE as informacoes da base de conhecimento (FAQ) fornecida abaixo.',
    'Regras obrigatorias:',
    '- Nunca invente, deduza ou complemente informacoes que nao estejam explicitamente na base de conhecimento.',
    '- Se nenhuma entrada da base tiver informacao suficiente para responder a pergunta com seguranca, responda com respondeu=false e resposta=null.',
    '- Responda SEMPRE e SOMENTE com um JSON valido, sem nenhum texto, explicacao ou marcacao (como blocos de codigo) antes ou depois, no formato exato:',
    '{"respondeu": boolean, "resposta": string | null}',
    '',
    'Base de conhecimento (FAQ):',
    baseConhecimento || '(nenhuma entrada disponivel)',
  ].join('\n');
}

/** Remove eventuais blocos de codigo markdown (```json ... ```) que o modelo possa incluir apesar da instrucao. */
function limparTextoResposta(texto: string): string {
  return texto.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function parseRespostaModelo(textoResposta: string): RespostaFaq {
  try {
    const json = JSON.parse(limparTextoResposta(textoResposta));

    if (json && typeof json === 'object' && json.respondeu === true && typeof json.resposta === 'string') {
      return { respondeu: true, resposta: json.resposta };
    }

    return { respondeu: false };
  } catch {
    return { respondeu: false };
  }
}

/**
 * Usa a API da Anthropic para tentar responder a pergunta de um cliente
 * usando somente as entradas ativas da FAQ (base de conhecimento), para uso
 * pelo bot do WhatsApp. Nunca lanca excecao: qualquer falha (parse de JSON,
 * rede, chave invalida, rate limit) e tratada como `respondeu: false`, para
 * que quem chama sempre possa cair no fallback de atendimento humano.
 */
export class BuscarRespostaFaqUseCase {
  private readonly chamarModelo: ChamarModeloFn;

  constructor(private readonly deps: BuscarRespostaFaqDeps) {
    this.chamarModelo = deps.chamarModelo ?? this.criarChamarModeloPadrao(deps.anthropicClient);
  }

  private criarChamarModeloPadrao(anthropicClientCustomizado?: Anthropic): ChamarModeloFn {
    const client = anthropicClientCustomizado ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const modelo = process.env.ANTHROPIC_MODEL ?? MODELO_DEFAULT;

    return async ({ systemPrompt, pergunta }) => {
      const mensagem = await client.messages.create({
        model: modelo,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: pergunta }],
      });

      const bloco = mensagem.content[0];
      return bloco && bloco.type === 'text' ? bloco.text : '';
    };
  }

  async execute(pergunta: string): Promise<RespostaFaq> {
    try {
      const faqEntries = await this.deps.faqEntryRepository.list(false);

      if (faqEntries.length === 0) {
        return { respondeu: false };
      }

      const systemPrompt = montarSystemPrompt(faqEntries);
      const textoResposta = await this.chamarModelo({ systemPrompt, pergunta });

      return parseRespostaModelo(textoResposta);
    } catch (error) {
      logger.warn({ err: error }, 'Falha ao consultar o modelo de IA para responder pergunta da FAQ');
      return { respondeu: false };
    }
  }
}

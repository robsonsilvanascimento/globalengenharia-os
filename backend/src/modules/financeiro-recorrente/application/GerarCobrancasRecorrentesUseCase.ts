import type { ContaReceberRepository } from '../domain/ContaReceberRepository';
import type { ContratoRecorrenteRepository } from '../domain/ContratoRecorrenteRepository';
import { montarNumeroConta } from '../domain/numeroConta';
import { adicionarPeriodo } from '../domain/periodicidade';

/** Trava o numero de ciclos gerados por contrato numa unica passada, evitando
 * loop infinito caso alguma data fique no passado distante. */
const MAX_CICLOS_POR_EXECUCAO = 36;

/**
 * Verdadeiro apenas quando o P2002 (violacao de unica) foi no indice
 * (contrato_id, vencimento_em) — a duplicata de conta que queremos ignorar. Uma
 * colisao no indice de `numero` NAO deve ser engolida (pularia a cobranca): ela
 * propaga para o job ser reexecutado e recomputar o numero.
 */
function ehConflitoContratoVencimento(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return false;
  const target = e.meta?.target;
  const alvo = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return alvo.includes('vencimento');
}

export interface ResultadoGeracao {
  contasGeradas: number;
  contratosProcessados: number;
}

/**
 * Para cada contrato ativo com cobranca vencida, gera a(s) conta(s) a receber
 * do(s) ciclo(s) devido(s) e avanca `proximaCobrancaEm`. Idempotente: nao
 * duplica conta ja existente para o mesmo contrato/vencimento. Ao ultrapassar
 * a data de termino, o contrato e desativado.
 */
export class GerarCobrancasRecorrentesUseCase {
  constructor(
    private readonly deps: {
      contratoRecorrenteRepository: ContratoRecorrenteRepository;
      contaReceberRepository: ContaReceberRepository;
    },
  ) {}

  async execute(referencia: Date = new Date()): Promise<ResultadoGeracao> {
    const { contratoRecorrenteRepository, contaReceberRepository } = this.deps;
    const contratos = await contratoRecorrenteRepository.listarVencendoAte(referencia);

    let contasGeradas = 0;
    for (const contrato of contratos) {
      let proxima = contrato.proximaCobrancaEm;
      let ciclos = 0;

      while (proxima.getTime() <= referencia.getTime() && ciclos < MAX_CICLOS_POR_EXECUCAO) {
        // Encerrou o contrato: para de faturar e desativa.
        if (contrato.dataFim && proxima.getTime() > contrato.dataFim.getTime()) break;

        const jaExiste = await contaReceberRepository.existeParaContratoNoVencimento(contrato.id, proxima);
        if (!jaExiste) {
          const ano = proxima.getFullYear();
          const sequencial = (await contaReceberRepository.contarNoAno(ano)) + 1;
          try {
            await contaReceberRepository.criar({
              numero: montarNumeroConta(ano, sequencial),
              clienteId: contrato.clienteId,
              contratoId: contrato.id,
              descricao: contrato.descricao,
              valor: contrato.valor,
              vencimentoEm: proxima,
              criadoPorId: contrato.criadoPorId,
            });
            contasGeradas += 1;
          } catch (err) {
            // Corrida com outra execucao (cron + faturamento manual): o indice
            // unico (contrato_id, vencimento_em) barra a duplicata. So engole
            // esse conflito especifico; qualquer outro erro (inclusive colisao
            // de numero) propaga para o job reexecutar.
            if (!ehConflitoContratoVencimento(err)) throw err;
          }
        }

        proxima = adicionarPeriodo(proxima, contrato.periodicidade);
        ciclos += 1;
      }

      await contratoRecorrenteRepository.atualizarProximaCobranca(contrato.id, proxima);

      // Passou da data de termino: desativa para nao reprocessar.
      if (contrato.dataFim && proxima.getTime() > contrato.dataFim.getTime()) {
        await contratoRecorrenteRepository.definirAtivo(contrato.id, false);
      }
    }

    return { contasGeradas, contratosProcessados: contratos.length };
  }
}

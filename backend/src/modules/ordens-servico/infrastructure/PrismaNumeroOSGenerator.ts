import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { NumeroOSGenerator } from '../domain/NumeroOSGenerator';

const TAMANHO_SEQUENCIAL_MINIMO = 2;
const TAMANHO_MES = 2;

/**
 * Gera numeros de OS unicos e sequenciais por ano/mes usando a tabela auxiliar
 * `Counter` (upsert com incremento atomico). Como `chave` e a chave primaria,
 * o Postgres resolve o upsert concorrente via ON CONFLICT DO UPDATE de forma
 * atomica, sem condicao de corrida.
 *
 * Formato: `{ano}{mes}{sequencial}` — ex.: `20260701`, `20260702`, ...,
 * `20260710`, ..., `202607100`. O sequencial tem no minimo 2 digitos e cresce
 * naturalmente conforme necessario (sem preenchimento fixo de zeros). O
 * contador reinicia a cada mes.
 */
export class PrismaNumeroOSGenerator implements NumeroOSGenerator {
  constructor(private readonly client: PrismaClient = prisma) {}

  async gerarNumero(ano: number, mes: number): Promise<string> {
    const mesFormatado = String(mes).padStart(TAMANHO_MES, '0');
    const chave = `ordem-servico-${ano}-${mesFormatado}`;

    const contador = await this.client.counter.upsert({
      where: { chave },
      create: { chave, valor: 1 },
      update: { valor: { increment: 1 } },
    });

    const sequencial = String(contador.valor).padStart(TAMANHO_SEQUENCIAL_MINIMO, '0');
    return `${ano}${mesFormatado}${sequencial}`;
  }
}

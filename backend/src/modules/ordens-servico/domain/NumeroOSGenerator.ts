/**
 * Gera o numero sequencial e unico de uma Ordem de Servico, no formato
 * `{ano}{mes}{sequencial}` (ex.: 20260701, 20260702, ..., 20260710). O
 * sequencial tem no minimo 2 digitos e cresce conforme necessario; o contador
 * reinicia a cada mes. A implementacao concreta (Prisma, via tabela auxiliar
 * Counter) garante atomicidade do incremento mesmo sob concorrencia.
 *
 * @param ano ano com 4 digitos (ex.: 2026)
 * @param mes mes de 1 a 12
 */
export interface NumeroOSGenerator {
  gerarNumero(ano: number, mes: number): Promise<string>;
}

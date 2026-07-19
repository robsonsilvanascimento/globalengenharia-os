/** Numero sequencial da conta a receber no formato CR-AAAA-NNNN. */
export function montarNumeroConta(ano: number, sequencial: number): string {
  return `CR-${ano}-${String(sequencial).padStart(4, '0')}`;
}

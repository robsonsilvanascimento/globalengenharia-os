export type Periodicidade = 'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export const PERIODICIDADES: Periodicidade[] = ['semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];

export const PERIODICIDADE_ROTULO: Record<Periodicidade, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

/**
 * Avanca uma data em um ciclo da periodicidade. Usa aritmetica de mes nativa
 * (setMonth trata a virada de ano). Ex.: mensal a partir de 10/01 -> 10/02.
 */
export function adicionarPeriodo(data: Date, periodicidade: Periodicidade): Date {
  const d = new Date(data);
  switch (periodicidade) {
    case 'semanal':
      d.setDate(d.getDate() + 7);
      break;
    case 'mensal':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'bimestral':
      d.setMonth(d.getMonth() + 2);
      break;
    case 'trimestral':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'semestral':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'anual':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

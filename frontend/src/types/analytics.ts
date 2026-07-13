export interface OsPorMes {
  mes: string;
  total: number;
}

export interface ReceitaPorMes {
  mes: string;
  valor: number;
}

export interface OsPorStatus {
  status: string;
  total: number;
}

export interface RankingTecnico {
  tecnico_id: string;
  nome: string;
  concluidas: number;
}

export interface TmrCategoria {
  categoria: string;
  horas: number;
}

export interface TmrTecnico {
  tecnico_id: string;
  nome: string;
  horas: number;
}

export interface TmrPrioridade {
  prioridade: string;
  horas: number;
}

export interface AnalyticsResumo {
  os_por_mes: OsPorMes[];
  receita_por_mes: ReceitaPorMes[];
  os_por_status: OsPorStatus[];
  ranking_tecnicos: RankingTecnico[];
  tmr_por_categoria: TmrCategoria[];
  tmr_por_tecnico: TmrTecnico[];
  tmr_por_prioridade: TmrPrioridade[];
}

/**
 * Erro base do dominio de Ordens de Servico. Nao carrega status HTTP nem
 * qualquer detalhe de transporte — o mapeamento para AppError/HTTP acontece
 * na camada de rota.
 */
export class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * Erro base do dominio de Auth. Nao carrega status HTTP nem qualquer detalhe
 * de transporte — o mapeamento para AppError/HTTP acontece na camada de rota,
 * quando os controllers forem implementados.
 */
export class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

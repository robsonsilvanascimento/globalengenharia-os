import type { EstimativaCustoOS } from '../../domain/EstimativaCustoOS';
import type {
  EstimativaCustoOSRepository,
  UpsertEstimativaCustoOSDados,
} from '../../domain/EstimativaCustoOSRepository';

/**
 * Repositorio em memoria usado apenas nos testes de unidade dos casos de uso,
 * para nao depender de um Postgres real no ambiente de CI/local. LIMITACAO:
 * nao cobre comportamento especifico do Prisma/Postgres (constraint unique de
 * ordemServicoId, tipos Decimal, etc.) — isso deve ser validado por um teste
 * de integracao real contra o banco quando houver um ambiente disponivel.
 */
export class FakeEstimativaCustoOSRepository implements EstimativaCustoOSRepository {
  private estimativas: EstimativaCustoOS[] = [];
  private seq = 0;

  seed(estimativa: EstimativaCustoOS): void {
    this.estimativas.push(estimativa);
  }

  async findByOrdemServicoId(ordemServicoId: string): Promise<EstimativaCustoOS | null> {
    return this.estimativas.find((e) => e.ordemServicoId === ordemServicoId) ?? null;
  }

  async upsert(ordemServicoId: string, dados: UpsertEstimativaCustoOSDados): Promise<EstimativaCustoOS> {
    const existente = this.estimativas.find((e) => e.ordemServicoId === ordemServicoId);

    if (existente) {
      Object.assign(existente, dados, { atualizadoEm: new Date() });
      return existente;
    }

    this.seq += 1;
    const nova: EstimativaCustoOS = {
      id: `estimativa-${this.seq}`,
      ordemServicoId,
      ...dados,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.estimativas.push(nova);
    return nova;
  }
}

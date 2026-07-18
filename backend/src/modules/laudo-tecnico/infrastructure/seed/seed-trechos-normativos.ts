import { logger } from '../../../../shared/infra/Logger';
import type { TrechoNormativoRepository } from '../../domain/TrechoNormativoRepository';
import { TRECHOS_NORMATIVOS_SEED } from './trechos-normativos.seed';

/**
 * Popula a biblioteca de trechos normativos com a base inicial, apenas se
 * ainda estiver vazia (idempotente: nao duplica em reinicios nem sobrescreve
 * o que o admin ja cadastrou/editou). Chamado no boot do servidor.
 */
export async function seedTrechosNormativos(repository: TrechoNormativoRepository): Promise<void> {
  const existentes = await repository.contarAtivos();
  if (existentes > 0) return;

  const criados = await repository.criarVarios(TRECHOS_NORMATIVOS_SEED);
  logger.info({ criados }, 'Biblioteca de trechos normativos populada com a base inicial');
}

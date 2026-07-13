import type { NotificacaoEnviada, StatusEnvioNotificacao } from './NotificacaoEnviada';

/** Dados necessarios para registrar uma tentativa de notificacao (ja com o resultado do envio). */
export interface CriarNotificacaoEnviadaDados {
  ordemServicoId: string;
  clienteId: string;
  tipoEvento: string;
  templateUsado?: string;
  statusEnvio: StatusEnvioNotificacao;
  tentativas: number;
  enviadoEm?: Date;
}

/**
 * Contrato de persistencia para NotificacaoEnviada. Nenhum detalhe de
 * Prisma/SQL vaza aqui — a implementacao concreta (repositorio Prisma) fica
 * em infrastructure/.
 */
export interface NotificacaoEnviadaRepository {
  create(dados: CriarNotificacaoEnviadaDados): Promise<NotificacaoEnviada>;
}

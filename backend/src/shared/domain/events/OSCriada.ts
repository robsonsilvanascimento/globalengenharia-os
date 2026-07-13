export const OS_CRIADA_EVENT = 'os.criada';

/** Evento de dominio publicado sempre que uma nova Ordem de Servico e criada. */
export interface OSCriada {
  ordemServicoId: string;
  clienteId: string;
  timestamp: Date;
}

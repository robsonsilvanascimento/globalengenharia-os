import type { Cliente } from './Cliente';

/** Dados necessarios para criar um Cliente. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarClienteDados {
  nome: string;
  telefoneWhatsapp: string;
  documento?: string;
  email?: string;
}

/**
 * Contrato de persistencia para Cliente. Nenhum detalhe de Prisma/SQL vaza aqui —
 * a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 *
 * `findByTelefone` e usado pelo modulo whatsapp para identificar o cliente a
 * partir do numero recebido no webhook — mantenha esta assinatura estavel.
 *
 * `update` e usado pelo modulo whatsapp para atualizar nome/email do cliente
 * coletados durante a conversa (o cliente novo hoje e criado com nome
 * placeholder e nunca atualizado).
 */
export interface ClienteRepository {
  list(): Promise<Cliente[]>;
  findById(id: string): Promise<Cliente | null>;
  findByTelefone(telefone: string): Promise<Cliente | null>;
  create(dados: CriarClienteDados): Promise<Cliente>;
  update(id: string, dados: Partial<{ nome: string; email: string }>): Promise<Cliente>;
}

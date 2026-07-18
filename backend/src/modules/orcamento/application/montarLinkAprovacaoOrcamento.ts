/**
 * Monta o link do portal onde o cliente ve e aprova/recusa o orcamento, a
 * partir do token secreto do orcamento. Em producao, `FRONTEND_URL` ausente
 * falha alto (mesmo criterio do link de reset de senha) para nao enviar ao
 * cliente um link quebrado apontando para localhost.
 */
export function montarLinkAprovacaoOrcamento(tokenAprovacao: string): string {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FRONTEND_URL precisa estar definida no ambiente de producao');
    }
    return `http://localhost:5173/orcamento/${tokenAprovacao}`;
  }

  return `${frontendUrl.replace(/\/$/, '')}/orcamento/${tokenAprovacao}`;
}

/**
 * Deteccao de intencao de CONSULTA/PAGAMENTO a partir do texto bruto
 * recebido do cliente. Funcao pura (sem I/O): usada pela camada de
 * aplicacao apenas quando nao ha fluxo de abertura de OS em andamento
 * (estado `inicio`), para decidir se a mensagem deve ser tratada como
 * duvida sobre pagamento/Pix em vez de iniciar o fluxo guiado de nova OS ou
 * uma consulta de status comum.
 */

/**
 * Resultado da deteccao. `numeroOS` (quando presente) ja vem normalizado,
 * seguindo o mesmo formato de `detectarIntencaoConsulta`.
 */
export interface IntencaoPagamento {
  numeroOS?: string;
}

const PALAVRAS_CHAVE_PAGAMENTO = [
  'pix',
  'pagar',
  'pagamento',
  'paguei',
  'cobranca',
  'boleto',
  'fatura',
  'divida',
  'devo',
];

/** Ex.: "OS-2026-000123", "os 2026 123", "OS2026123". */
const PADRAO_NUMERO_OS_COMPLETO = /\bos[-\s]?(\d{4})[-\s]?(\d{1,})\b/i;

/** Faixa Unicode dos diacriticos combinantes (acentos) apos normalize('NFD'). */
const DIACRITICOS_COMBINANTES = /[̀-ͯ]/g;

/** Remove acentos para comparacao case/acento-insensitive (ex.: "cobrança" -> "cobranca"). */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS_COMBINANTES, '');
}

/**
 * Detecta se a mensagem recebida expressa duvida/intencao relacionada a
 * pagamento (ex.: "ja paguei", "quero pagar", "cade meu pix", "quanto eu
 * devo"). Retorna `null` quando a mensagem nao parece sobre pagamento (nesse
 * caso o chamador deve seguir com a deteccao de consulta de status comum ou
 * com o fluxo normal de abertura de OS).
 */
export function detectarIntencaoPagamento(mensagemRecebida: string): IntencaoPagamento | null {
  const texto = mensagemRecebida.trim();

  if (!texto) {
    return null;
  }

  const textoNormalizado = normalizar(texto);
  const contemPalavraChave = PALAVRAS_CHAVE_PAGAMENTO.some((palavra) => textoNormalizado.includes(palavra));

  if (!contemPalavraChave) {
    return null;
  }

  const matchCompleto = texto.match(PADRAO_NUMERO_OS_COMPLETO);
  if (matchCompleto) {
    const ano = matchCompleto[1] ?? '';
    const sequencia = matchCompleto[2] ?? '';
    return { numeroOS: `OS-${ano}-${sequencia.padStart(6, '0')}` };
  }

  return {};
}

/**
 * Deteccao de intencao de CONSULTA DE STATUS a partir do texto bruto
 * recebido do cliente. Funcao pura (sem I/O): usada pela camada de
 * aplicacao apenas quando nao ha fluxo de abertura de OS em andamento
 * (estado `inicio`), para decidir se a mensagem deve ser tratada como
 * consulta em vez de iniciar o fluxo guiado de nova OS.
 */

/**
 * Resultado da deteccao. `numeroOS` (quando presente) ja vem normalizado:
 * - Padrao completo `OS-AAAA-NNNNNN` (ex.: "os 2026 123" -> "OS-2026-000123").
 * - Apenas digitos (ex.: "123"): mantido como string de digitos, cabendo ao
 *   repositorio (`OrdemServicoRepository.findByNumero`) resolver a busca por
 *   sufixo/sequencial.
 */
export interface IntencaoConsultaStatus {
  numeroOS?: string;
}

const PALAVRAS_CHAVE_CONSULTA = [
  'status',
  'andamento',
  'consultar',
  'consulta',
  'acompanhar',
  'acompanhamento',
];

/** Ex.: "OS-2026-000123", "os 2026 123", "OS2026123". */
const PADRAO_NUMERO_OS_COMPLETO = /\bos[-\s]?(\d{4})[-\s]?(\d{1,})\b/i;

/** Mensagem contendo apenas digitos (ex.: "123", "000123"). */
const PADRAO_APENAS_DIGITOS = /^\d{1,}$/;

/**
 * Detecta se a mensagem recebida expressa intencao de consultar o status de
 * uma OS. Retorna `null` quando a mensagem nao parece uma consulta (nesse
 * caso o chamador deve seguir com o fluxo normal de abertura de OS).
 */
export function detectarIntencaoConsulta(mensagemRecebida: string): IntencaoConsultaStatus | null {
  const texto = mensagemRecebida.trim();

  if (!texto) {
    return null;
  }

  const matchCompleto = texto.match(PADRAO_NUMERO_OS_COMPLETO);
  if (matchCompleto) {
    const ano = matchCompleto[1] ?? '';
    const sequencia = matchCompleto[2] ?? '';
    return { numeroOS: `OS-${ano}-${sequencia.padStart(6, '0')}` };
  }

  if (PADRAO_APENAS_DIGITOS.test(texto)) {
    return { numeroOS: texto };
  }

  const textoNormalizado = texto.toLowerCase();
  const contemPalavraChave = PALAVRAS_CHAVE_CONSULTA.some((palavra) => textoNormalizado.includes(palavra));

  return contemPalavraChave ? {} : null;
}

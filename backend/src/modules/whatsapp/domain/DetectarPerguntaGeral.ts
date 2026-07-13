/**
 * Deteccao heuristica de PERGUNTA/DUVIDA GERAL a partir do texto bruto
 * recebido do cliente. Funcao pura (sem I/O): usada pela camada de
 * aplicacao apenas quando nao ha fluxo de abertura de OS em andamento
 * (estado `inicio`) e a mensagem ja foi descartada como intencao de
 * consulta de status (`detectarIntencaoConsulta`), para decidir se deve
 * ser encaminhada a FAQ (via IA) em vez de iniciar o fluxo guiado de nova OS.
 */

const PALAVRAS_INICIO_PERGUNTA = [
  'como',
  'qual',
  'quando',
  'onde',
  'por que',
  'porque',
  'quanto',
  'posso',
  'voces',
  'voce',
  'atende',
  'fazem',
];

/** Faixa Unicode dos diacriticos combinantes (acentos) apos normalize('NFD'). */
const DIACRITICOS_COMBINANTES = /[̀-ͯ]/g;

/** Remove acentos para comparacao case/acento-insensitive (ex.: "vocês" -> "voces"). */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS_COMBINANTES, '');
}

/**
 * Detecta se a mensagem recebida parece uma pergunta/duvida geral: termina
 * com "?" ou comeca com uma das palavras interrogativas/tipicas de duvida
 * mais comuns em portugues. Retorna `false` quando a mensagem parece um
 * comando/afirmacao comum (ex.: um nome, uma descricao de problema), caso em
 * que o chamador deve seguir com o fluxo normal de abertura de OS.
 */
export function detectarPerguntaGeral(mensagemRecebida: string): boolean {
  const texto = mensagemRecebida.trim();

  if (!texto) {
    return false;
  }

  if (texto.endsWith('?')) {
    return true;
  }

  const textoNormalizado = normalizar(texto);

  return PALAVRAS_INICIO_PERGUNTA.some((palavra) => textoNormalizado.startsWith(palavra));
}

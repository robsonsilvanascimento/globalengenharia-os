import { describe, expect, it } from 'vitest';
import { detectarPerguntaGeral } from './DetectarPerguntaGeral';

describe('detectarPerguntaGeral', () => {
  it('retorna false para mensagem vazia/so espacos', () => {
    expect(detectarPerguntaGeral('')).toBe(false);
    expect(detectarPerguntaGeral('   ')).toBe(false);
  });

  it('retorna false para mensagens tipicas de abertura de OS (nome, descricao de problema)', () => {
    expect(detectarPerguntaGeral('Joao Pereira')).toBe(false);
    expect(detectarPerguntaGeral('Meu chuveiro parou de funcionar')).toBe(false);
    expect(detectarPerguntaGeral('Oi')).toBe(false);
  });

  it('detecta pergunta pelo "?" no final', () => {
    expect(detectarPerguntaGeral('Voces atendem aos sabados?')).toBe(true);
    expect(detectarPerguntaGeral('Isso resolve meu problema ?')).toBe(true);
  });

  it.each([
    'Como funciona a garantia?',
    'Qual o horario de atendimento',
    'Quando vocês abrem',
    'Onde fica a loja',
    'Por que demora tanto',
    'Porque o servico e cobrado',
    'Quanto custa a visita',
    'Posso pagar no cartao',
    'Vocês atendem final de semana',
    'Voce atende em domicilio',
    'Atende final de semana',
    'Fazem instalacao de ar condicionado',
  ])('detecta pergunta/duvida geral pela palavra inicial em "%s"', (mensagem) => {
    expect(detectarPerguntaGeral(mensagem)).toBe(true);
  });

  it('e case/acento-insensitive para as palavras iniciais', () => {
    expect(detectarPerguntaGeral('VOCÊS fazem manutencao preventiva')).toBe(true);
    expect(detectarPerguntaGeral('COMO faco para agendar')).toBe(true);
  });
});

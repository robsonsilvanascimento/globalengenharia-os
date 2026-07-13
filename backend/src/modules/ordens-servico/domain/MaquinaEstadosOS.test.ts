import { describe, expect, it } from 'vitest';
import { podeTransicionar } from './MaquinaEstadosOS';
import type { StatusOS } from './OrdemServico';

describe('podeTransicionar (Maquina de Estados da OS)', () => {
  it('permite transicao valida de progresso na sequencia (aberta -> triagem)', () => {
    expect(podeTransicionar('aberta', 'triagem', 'atendente')).toBe(true);
  });

  it('permite o ciclo aguardando_peca <-> em_andamento', () => {
    expect(podeTransicionar('em_andamento', 'aguardando_peca', 'atendente')).toBe(true);
    expect(podeTransicionar('aguardando_peca', 'em_andamento', 'atendente')).toBe(true);
  });

  it('bloqueia pular etapas na sequencia de progresso (aberta -> atribuida)', () => {
    expect(podeTransicionar('aberta', 'atribuida', 'admin')).toBe(false);
  });

  it('bloqueia pular etapas na sequencia de progresso (triagem -> em_andamento)', () => {
    expect(podeTransicionar('triagem', 'em_andamento', 'admin')).toBe(false);
  });

  it('nunca permite transicionar a partir de concluida', () => {
    const statusPossiveis: StatusOS[] = [
      'aberta',
      'triagem',
      'atribuida',
      'em_andamento',
      'aguardando_peca',
      'cancelada',
    ];
    const papeis = ['atendente', 'tecnico', 'admin', 'bot'] as const;

    for (const statusNovo of statusPossiveis) {
      for (const papel of papeis) {
        expect(podeTransicionar('concluida', statusNovo, papel)).toBe(false);
      }
    }
  });

  it('retorna false quando statusNovo e igual ao statusAtual', () => {
    expect(podeTransicionar('em_andamento', 'em_andamento', 'admin')).toBe(false);
  });

  it('bloqueia tecnico tentando cancelar', () => {
    expect(podeTransicionar('em_andamento', 'cancelada', 'tecnico')).toBe(false);
  });

  it('bloqueia tecnico movendo para triagem ou atribuida', () => {
    expect(podeTransicionar('aberta', 'triagem', 'tecnico')).toBe(false);
    expect(podeTransicionar('triagem', 'atribuida', 'tecnico')).toBe(false);
  });

  it('permite atendente cancelar a partir de qualquer status ativo (nao terminal)', () => {
    const statusAtivos: StatusOS[] = [
      'aberta',
      'triagem',
      'atribuida',
      'em_andamento',
      'aguardando_peca',
    ];

    for (const statusAtual of statusAtivos) {
      expect(podeTransicionar(statusAtual, 'cancelada', 'atendente')).toBe(true);
      expect(podeTransicionar(statusAtual, 'cancelada', 'admin')).toBe(true);
    }
  });

  it('bloqueia cancelar uma OS ja cancelada', () => {
    expect(podeTransicionar('cancelada', 'cancelada', 'atendente')).toBe(false);
  });

  it('bot nunca executa transicoes de status via esta funcao', () => {
    expect(podeTransicionar('aberta', 'triagem', 'bot')).toBe(false);
    expect(podeTransicionar('aberta', 'cancelada', 'bot')).toBe(false);
  });

  it('permite tecnico executar as transicoes especificas permitidas', () => {
    expect(podeTransicionar('atribuida', 'em_andamento', 'tecnico')).toBe(true);
    expect(podeTransicionar('em_andamento', 'aguardando_peca', 'tecnico')).toBe(true);
    expect(podeTransicionar('aguardando_peca', 'em_andamento', 'tecnico')).toBe(true);
    expect(podeTransicionar('em_andamento', 'concluida', 'tecnico')).toBe(true);
  });

  it('ajudante nunca executa nenhuma transicao de status (nem progresso nem cancelamento)', () => {
    const statusIniciais: StatusOS[] = [
      'aberta',
      'triagem',
      'atribuida',
      'em_andamento',
      'aguardando_peca',
    ];
    const statusPossiveis: StatusOS[] = [
      'aberta',
      'triagem',
      'atribuida',
      'em_andamento',
      'aguardando_peca',
      'concluida',
      'cancelada',
    ];

    for (const statusAtual of statusIniciais) {
      for (const statusNovo of statusPossiveis) {
        expect(podeTransicionar(statusAtual, statusNovo, 'ajudante')).toBe(false);
      }
    }
  });
});

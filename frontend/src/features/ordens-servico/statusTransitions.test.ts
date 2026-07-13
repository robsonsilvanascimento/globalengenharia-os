import { describe, expect, it } from 'vitest';
import { getValidTransitions, isStatusTerminal } from './statusTransitions';

describe('getValidTransitions', () => {
  it('allows the full happy-path progression for admin/atendente (papel = null or non-tecnico)', () => {
    expect(getValidTransitions('aberta', 'admin')).toEqual(['triagem', 'cancelada']);
    expect(getValidTransitions('triagem', 'atendente')).toEqual(['atribuida', 'cancelada']);
    expect(getValidTransitions('atribuida', null)).toEqual(['em_andamento', 'cancelada']);
    expect(getValidTransitions('em_andamento', 'admin')).toEqual(['aguardando_peca', 'concluida', 'cancelada']);
    expect(getValidTransitions('aguardando_peca', 'admin')).toEqual(['em_andamento', 'cancelada']);
  });

  it('allows cancellation from every non-terminal status for non-tecnico roles', () => {
    const naoTerminal: Array<Parameters<typeof getValidTransitions>[0]> = [
      'aberta',
      'triagem',
      'atribuida',
      'em_andamento',
      'aguardando_peca',
    ];
    naoTerminal.forEach((status) => {
      expect(getValidTransitions(status, 'admin')).toContain('cancelada');
    });
  });

  it('restricts tecnico to execution-only transitions, never triagem/atribuicao/cancelamento', () => {
    expect(getValidTransitions('aberta', 'tecnico')).toEqual([]);
    expect(getValidTransitions('triagem', 'tecnico')).toEqual([]);
    expect(getValidTransitions('atribuida', 'tecnico')).toEqual(['em_andamento']);
    expect(getValidTransitions('em_andamento', 'tecnico')).toEqual(['aguardando_peca', 'concluida']);
    expect(getValidTransitions('aguardando_peca', 'tecnico')).toEqual(['em_andamento']);
  });

  it('never allows tecnico to cancel an OS', () => {
    const todos: Array<Parameters<typeof getValidTransitions>[0]> = [
      'aberta',
      'triagem',
      'atribuida',
      'em_andamento',
      'aguardando_peca',
      'concluida',
      'cancelada',
    ];
    todos.forEach((status) => {
      expect(getValidTransitions(status, 'tecnico')).not.toContain('cancelada');
    });
  });

  it('returns no transitions from terminal statuses, regardless of role', () => {
    expect(getValidTransitions('concluida', 'admin')).toEqual([]);
    expect(getValidTransitions('cancelada', 'admin')).toEqual([]);
    expect(getValidTransitions('concluida', 'tecnico')).toEqual([]);
    expect(getValidTransitions('cancelada', 'tecnico')).toEqual([]);
  });
});

describe('isStatusTerminal', () => {
  it('flags concluida and cancelada as terminal', () => {
    expect(isStatusTerminal('concluida')).toBe(true);
    expect(isStatusTerminal('cancelada')).toBe(true);
  });

  it('does not flag any other status as terminal', () => {
    expect(isStatusTerminal('aberta')).toBe(false);
    expect(isStatusTerminal('triagem')).toBe(false);
    expect(isStatusTerminal('atribuida')).toBe(false);
    expect(isStatusTerminal('em_andamento')).toBe(false);
    expect(isStatusTerminal('aguardando_peca')).toBe(false);
  });
});

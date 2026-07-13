import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { StatusSummaryCards } from './StatusSummaryCards';

vi.mock('./useStatusCountsQuery', async () => {
  const actual = await vi.importActual<typeof import('./useStatusCountsQuery')>('./useStatusCountsQuery');
  return {
    ...actual,
    useStatusCountsQuery: () => ({
      counts: {
        aberta: 3,
        triagem: 1,
        atribuida: 2,
        em_andamento: 5,
        aguardando_peca: 0,
        concluida: 12,
        cancelada: 4,
      },
      isLoading: false,
      isError: false,
    }),
  };
});

describe('StatusSummaryCards', () => {
  it('renders one card for each of the 7 OS statuses', () => {
    render(<StatusSummaryCards statusAtivo="" onSelecionarStatus={() => {}} />);

    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText('Triagem')).toBeInTheDocument();
    expect(screen.getByText('Atribuída')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Aguardando peça')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('toggles the active status on click, un-selecting when clicked again', async () => {
    const user = userEvent.setup();
    const onSelecionarStatus = vi.fn();
    render(<StatusSummaryCards statusAtivo="" onSelecionarStatus={onSelecionarStatus} />);

    await user.click(screen.getByText('Aberta'));
    expect(onSelecionarStatus).toHaveBeenCalledWith('aberta');
  });

  it('deselects the currently active status when its card is clicked again', async () => {
    const user = userEvent.setup();
    const onSelecionarStatus = vi.fn();
    render(<StatusSummaryCards statusAtivo="aberta" onSelecionarStatus={onSelecionarStatus} />);

    await user.click(screen.getByText('Aberta'));
    expect(onSelecionarStatus).toHaveBeenCalledWith('');
  });
});

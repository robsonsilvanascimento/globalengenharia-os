import './ErrorState.css';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Ocorreu um erro ao carregar os dados.', onRetry }: ErrorStateProps) {
  return (
    <div className="ui-error-state">
      <span className="ui-error-message">{message}</span>
      {onRetry && (
        <button type="button" className="ui-error-retry" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

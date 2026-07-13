import './LoadingState.css';

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Carregando...' }: LoadingStateProps) {
  return (
    <div className="ui-loading-state">
      <span className="ui-loading-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

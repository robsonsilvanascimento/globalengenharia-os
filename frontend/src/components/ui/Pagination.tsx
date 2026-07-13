import './Pagination.css';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="ui-pagination">
      <button
        type="button"
        className="ui-pagination-button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrevious}
      >
        Anterior
      </button>
      <span className="ui-pagination-info">
        Página {currentPage} de {totalPages}
      </span>
      <button
        type="button"
        className="ui-pagination-button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
      >
        Próximo
      </button>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import type { SelectOption } from '../../components/ui/Select';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { httpClient } from '../../lib/api/httpClient';
import type { AreaCategoriaServico, CategoriaServico } from '../../types/api';
import { CATEGORIAS_SERVICO_QUERY_KEY, useCategoriasServicoQuery } from './useCategoriasServicoQuery';
import { CategoriaServicoForm } from './CategoriaServicoForm';
import './CategoriasServicoPage.css';

const AREA_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'Todas as áreas' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'automacao', label: 'Automação' },
  { value: 'energia_solar', label: 'Energia Solar' },
  { value: 'outro', label: 'Outro' },
];

export function CategoriasServicoPage() {
  const { data, isLoading, isError, refetch } = useCategoriasServicoQuery();
  const queryClient = useQueryClient();

  const [areaFiltro, setAreaFiltro] = useState<AreaCategoriaServico | ''>('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      httpClient.patch<CategoriaServico>(`/categorias-servico/${id}`, { ativo }),
    onMutate: async ({ id, ativo }) => {
      await queryClient.cancelQueries({ queryKey: CATEGORIAS_SERVICO_QUERY_KEY });
      const previous = queryClient.getQueryData<CategoriaServico[]>(CATEGORIAS_SERVICO_QUERY_KEY);

      queryClient.setQueryData<CategoriaServico[]>(CATEGORIAS_SERVICO_QUERY_KEY, (current) =>
        current?.map((categoria) => (categoria.id === id ? { ...categoria, ativo } : categoria)),
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CATEGORIAS_SERVICO_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIAS_SERVICO_QUERY_KEY });
    },
  });

  const categoriasFiltradas = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.filter((categoria) => {
      if (!mostrarInativas && !categoria.ativo) {
        return false;
      }
      if (areaFiltro && categoria.area !== areaFiltro) {
        return false;
      }
      return true;
    });
  }, [data, areaFiltro, mostrarInativas]);

  const columns: TableColumn<CategoriaServico>[] = [
    { key: 'nome', header: 'Nome' },
    {
      key: 'area',
      header: 'Área',
      render: (categoria) => <Badge variant="area" value={categoria.area} />,
    },
    {
      key: 'ativo',
      header: 'Ativo',
      render: (categoria) => (
        <button
          type="button"
          className={`categorias-servico-toggle ${categoria.ativo ? 'is-active' : 'is-inactive'}`}
          onClick={() => toggleAtivoMutation.mutate({ id: categoria.id, ativo: !categoria.ativo })}
          disabled={toggleAtivoMutation.isPending}
        >
          {categoria.ativo ? 'Ativo' : 'Inativo'}
        </button>
      ),
    },
  ];

  function handleFormSuccess(): void {
    setIsModalOpen(false);
  }

  return (
    <div className="categorias-servico-page">
      <div className="categorias-servico-header">
        <h1 className="categorias-servico-title">Categorias de serviço</h1>
        <button type="button" className="categorias-servico-new-button" onClick={() => setIsModalOpen(true)}>
          Nova categoria
        </button>
      </div>

      <div className="categorias-servico-filters">
        <div className="categorias-servico-filter-field">
          <label htmlFor="area-filtro">Área</label>
          <Select
            id="area-filtro"
            options={AREA_FILTER_OPTIONS}
            value={areaFiltro}
            onChange={(value) => setAreaFiltro(value as AreaCategoriaServico | '')}
          />
        </div>

        <label className="categorias-servico-filter-checkbox">
          <input
            type="checkbox"
            checked={mostrarInativas}
            onChange={(event) => setMostrarInativas(event.target.checked)}
          />
          Mostrar inativas
        </label>
      </div>

      {isLoading && <LoadingState message="Carregando categorias..." />}
      {isError && <ErrorState message="Não foi possível carregar as categorias." onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <Table
          columns={columns}
          rows={categoriasFiltradas}
          rowKey={(categoria) => categoria.id}
          emptyMessage="Nenhuma categoria encontrada."
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova categoria">
        <CategoriaServicoForm onSuccess={handleFormSuccess} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
}

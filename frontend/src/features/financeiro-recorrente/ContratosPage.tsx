import { useState } from 'react';
import { useClientesQuery } from '../clientes/useClientesQuery';
import {
  PERIODICIDADE_ROTULO,
  useAlternarContrato,
  useContratos,
  useCriarContrato,
  useFaturarAgora,
  type CriarContratoInput,
  type Periodicidade,
} from './useFinanceiroRecorrente';
import './financeiro-recorrente.css';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PERIODICIDADES: Periodicidade[] = ['semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ContratosPage() {
  const [ativo, setAtivo] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const clientes = useClientesQuery();
  const { data: contratos, isLoading } = useContratos({ ativo });
  const alternar = useAlternarContrato();
  const faturar = useFaturarAgora();

  async function faturarAgora() {
    setAviso(null);
    const res = await faturar.mutateAsync();
    setAviso(
      res.contas_geradas > 0
        ? `${res.contas_geradas} conta(s) gerada(s) a partir de ${res.contratos_processados} contrato(s) vencido(s).`
        : 'Nenhuma cobrança pendente no momento.',
    );
  }

  const lista = contratos ?? [];

  return (
    <div className="fr-page">
      <div className="fr-head">
        <div>
          <h1>Contratos Recorrentes</h1>
          <p>
            Contratos de serviço recorrente. A cada ciclo o sistema gera automaticamente uma conta a receber
            (também há faturamento diário automático).
          </p>
        </div>
        <div className="fr-acoes-topo">
          <button className="fr-btn fr-btn-secundario" onClick={faturarAgora} disabled={faturar.isPending}>
            {faturar.isPending ? 'Faturando…' : 'Faturar agora'}
          </button>
          <button className="fr-btn fr-btn-primario" onClick={() => setNovoAberto(true)}>
            + Novo contrato
          </button>
        </div>
      </div>

      {aviso && <p className="fr-erro" style={{ color: '#0f8a57' }}>{aviso}</p>}

      <div className="fr-filtros">
        <select value={ativo} onChange={(e) => setAtivo(e.target.value)}>
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <div className="fr-tabela-wrap">
        <table className="fr-tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Periodicidade</th>
              <th className="fr-num-col">Valor</th>
              <th>Próxima cobrança</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="fr-vazio">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && lista.length === 0 && (
              <tr>
                <td colSpan={7} className="fr-vazio">
                  Nenhum contrato cadastrado.
                </td>
              </tr>
            )}
            {lista.map((contrato) => (
              <tr key={contrato.id}>
                <td>{contrato.cliente_nome}</td>
                <td>{contrato.descricao}</td>
                <td>{PERIODICIDADE_ROTULO[contrato.periodicidade]}</td>
                <td className="fr-num-col">{moeda.format(contrato.valor)}</td>
                <td>{dataBR(contrato.proxima_cobranca_em)}</td>
                <td>
                  <span className={`fr-badge ${contrato.ativo ? 'ativo' : 'inativo'}`}>
                    {contrato.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <button
                    className="fr-btn-link"
                    onClick={() => alternar.mutate({ id: contrato.id, ativo: !contrato.ativo })}
                  >
                    {contrato.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {novoAberto && (
        <NovoContratoModal
          clientes={(clientes.data ?? []).map((c) => ({ id: c.id, nome: c.nome }))}
          onClose={() => setNovoAberto(false)}
        />
      )}
    </div>
  );
}

function NovoContratoModal({ clientes, onClose }: { clientes: { id: string; nome: string }[]; onClose: () => void }) {
  const criar = useCriarContrato();
  const [form, setForm] = useState({
    cliente_id: '',
    descricao: '',
    valor: '',
    periodicidade: 'mensal' as Periodicidade,
    data_inicio: '',
    data_fim: '',
  });
  const [erro, setErro] = useState<string | null>(null);

  const valido = form.cliente_id && form.descricao.trim() && Number(form.valor) > 0 && form.data_inicio;

  async function salvar() {
    setErro(null);
    try {
      const body: CriarContratoInput = {
        cliente_id: form.cliente_id,
        descricao: form.descricao.trim(),
        valor: Number(form.valor),
        periodicidade: form.periodicidade,
        data_inicio: new Date(`${form.data_inicio}T12:00:00`).toISOString(),
        data_fim: form.data_fim ? new Date(`${form.data_fim}T12:00:00`).toISOString() : null,
      };
      await criar.mutateAsync(body);
      onClose();
    } catch {
      setErro('Não foi possível criar o contrato. Verifique os dados.');
    }
  }

  return (
    <div className="fr-modal-overlay" onClick={onClose}>
      <div className="fr-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo contrato recorrente</h2>
        {erro && <p className="fr-erro">{erro}</p>}
        <label>
          Cliente
          <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
            <option value="">Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Descrição
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Manutenção preventiva mensal" />
        </label>
        <div className="fr-modal-linha">
          <label>
            Valor por ciclo (R$)
            <input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </label>
          <label>
            Periodicidade
            <select value={form.periodicidade} onChange={(e) => setForm({ ...form, periodicidade: e.target.value as Periodicidade })}>
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p}>
                  {PERIODICIDADE_ROTULO[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fr-modal-linha">
          <label>
            Início (1ª cobrança)
            <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          </label>
          <label>
            Término (opcional)
            <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          </label>
        </div>
        <div className="fr-modal-acoes">
          <button className="fr-btn fr-btn-secundario" onClick={onClose}>
            Cancelar
          </button>
          <button className="fr-btn fr-btn-primario" disabled={!valido || criar.isPending} onClick={salvar}>
            {criar.isPending ? 'Salvando…' : 'Criar contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}

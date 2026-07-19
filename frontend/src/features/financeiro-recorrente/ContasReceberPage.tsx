import { useState } from 'react';
import { useClientesQuery } from '../clientes/useClientesQuery';
import {
  useBaixarConta,
  useCancelarConta,
  useContasReceber,
  useCriarConta,
  type ContaReceber,
  type CriarContaInput,
  type StatusContaReceber,
} from './useFinanceiroRecorrente';
import './financeiro-recorrente.css';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_ROTULO: Record<StatusContaReceber, string> = {
  aberta: 'Aberta',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ContasReceberPage() {
  const [status, setStatus] = useState<StatusContaReceber | ''>('');
  const [clienteId, setClienteId] = useState('');
  const [novaAberta, setNovaAberta] = useState(false);
  const [baixando, setBaixando] = useState<ContaReceber | null>(null);

  const clientes = useClientesQuery();
  const { data, isLoading } = useContasReceber({ status, cliente_id: clienteId });
  const cancelar = useCancelarConta();

  const contas = data?.contas ?? [];
  const resumo = data?.resumo;

  return (
    <div className="fr-page">
      <div className="fr-head">
        <div>
          <h1>Contas a Receber</h1>
          <p>Recebíveis avulsos e gerados pelos contratos. Dê baixa quando o cliente pagar.</p>
        </div>
        <div className="fr-acoes-topo">
          <button className="fr-btn fr-btn-primario" onClick={() => setNovaAberta(true)}>
            + Nova conta
          </button>
        </div>
      </div>

      <div className="fr-cards">
        <div className="fr-card aberto">
          <div className="fr-card-rotulo">A receber (aberto)</div>
          <div className="fr-card-valor">{moeda.format(resumo?.total_aberto ?? 0)}</div>
        </div>
        <div className="fr-card vencido">
          <div className="fr-card-rotulo">Vencido</div>
          <div className="fr-card-valor">{moeda.format(resumo?.total_vencido ?? 0)}</div>
        </div>
        <div className="fr-card recebido">
          <div className="fr-card-rotulo">Recebido</div>
          <div className="fr-card-valor">{moeda.format(resumo?.total_recebido ?? 0)}</div>
        </div>
        <div className="fr-card">
          <div className="fr-card-rotulo">Contas no filtro</div>
          <div className="fr-card-valor">{resumo?.quantidade ?? 0}</div>
        </div>
      </div>

      <div className="fr-filtros">
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusContaReceber | '')}>
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="vencida">Vencida</option>
          <option value="paga">Paga</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {(clientes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="fr-tabela-wrap">
        <table className="fr-tabela">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Vencimento</th>
              <th className="fr-num-col">Valor</th>
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
            {!isLoading && contas.length === 0 && (
              <tr>
                <td colSpan={7} className="fr-vazio">
                  Nenhuma conta encontrada com esse filtro.
                </td>
              </tr>
            )}
            {contas.map((conta) => (
              <tr key={conta.id}>
                <td>{conta.numero}</td>
                <td>{conta.cliente_nome ?? '—'}</td>
                <td>{conta.descricao}</td>
                <td>{dataBR(conta.vencimento_em)}</td>
                <td className="fr-num-col">{moeda.format(conta.valor)}</td>
                <td>
                  <span className={`fr-badge ${conta.status}`}>{STATUS_ROTULO[conta.status]}</span>
                </td>
                <td>
                  {(conta.status === 'aberta' || conta.status === 'vencida') && (
                    <div className="fr-linha-acoes">
                      <button className="fr-btn-link" onClick={() => setBaixando(conta)}>
                        Dar baixa
                      </button>
                      <button
                        className="fr-btn-link perigo"
                        onClick={() => {
                          if (confirm(`Cancelar a conta ${conta.numero}?`)) cancelar.mutate(conta.id);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  {conta.status === 'paga' && conta.pago_em && (
                    <span style={{ color: '#8a94a2', fontSize: '0.8rem' }}>
                      Pago em {dataBR(conta.pago_em)}
                      {conta.forma_pagamento ? ` · ${conta.forma_pagamento}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {novaAberta && (
        <NovaContaModal
          clientes={(clientes.data ?? []).map((c) => ({ id: c.id, nome: c.nome }))}
          onClose={() => setNovaAberta(false)}
        />
      )}
      {baixando && <BaixaModal conta={baixando} onClose={() => setBaixando(null)} />}
    </div>
  );
}

function NovaContaModal({ clientes, onClose }: { clientes: { id: string; nome: string }[]; onClose: () => void }) {
  const criar = useCriarConta();
  const [form, setForm] = useState({ cliente_id: '', descricao: '', valor: '', vencimento_em: '', observacao: '' });
  const [erro, setErro] = useState<string | null>(null);

  const valido = form.cliente_id && form.descricao.trim() && Number(form.valor) > 0 && form.vencimento_em;

  async function salvar() {
    setErro(null);
    try {
      const body: CriarContaInput = {
        cliente_id: form.cliente_id,
        descricao: form.descricao.trim(),
        valor: Number(form.valor),
        vencimento_em: new Date(`${form.vencimento_em}T12:00:00`).toISOString(),
        observacao: form.observacao.trim() || null,
      };
      await criar.mutateAsync(body);
      onClose();
    } catch {
      setErro('Não foi possível criar a conta. Verifique os dados.');
    }
  }

  return (
    <div className="fr-modal-overlay" onClick={onClose}>
      <div className="fr-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nova conta a receber</h2>
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
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Serviço de instalação" />
        </label>
        <div className="fr-modal-linha">
          <label>
            Valor (R$)
            <input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </label>
          <label>
            Vencimento
            <input type="date" value={form.vencimento_em} onChange={(e) => setForm({ ...form, vencimento_em: e.target.value })} />
          </label>
        </div>
        <label>
          Observação (opcional)
          <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        </label>
        <div className="fr-modal-acoes">
          <button className="fr-btn fr-btn-secundario" onClick={onClose}>
            Cancelar
          </button>
          <button className="fr-btn fr-btn-primario" disabled={!valido || criar.isPending} onClick={salvar}>
            {criar.isPending ? 'Salvando…' : 'Criar conta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BaixaModal({ conta, onClose }: { conta: ContaReceber; onClose: () => void }) {
  const baixar = useBaixarConta();
  const [forma, setForma] = useState('pix');
  const [valor, setValor] = useState(String(conta.valor));
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    try {
      await baixar.mutateAsync({ id: conta.id, forma_pagamento: forma || null, valor_pago: Number(valor) || undefined });
      onClose();
    } catch {
      setErro('Não foi possível dar baixa. Tente novamente.');
    }
  }

  return (
    <div className="fr-modal-overlay" onClick={onClose}>
      <div className="fr-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Dar baixa — {conta.numero}</h2>
        {erro && <p className="fr-erro">{erro}</p>}
        <div className="fr-modal-linha">
          <label>
            Valor recebido (R$)
            <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
          <label>
            Forma de pagamento
            <select value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option>
            </select>
          </label>
        </div>
        <div className="fr-modal-acoes">
          <button className="fr-btn fr-btn-secundario" onClick={onClose}>
            Cancelar
          </button>
          <button className="fr-btn fr-btn-primario" disabled={baixar.isPending} onClick={confirmar}>
            {baixar.isPending ? 'Confirmando…' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

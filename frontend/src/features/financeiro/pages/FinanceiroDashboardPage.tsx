import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  useResumoFinanceiro,
  useInadimplentes,
  useRankingTecnicos,
} from '../hooks/useFinanceiro';
import './FinanceiroDashboardPage.css';

type Aba = 'resumo' | 'inadimplentes' | 'ranking';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const BAR_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554', '#2563eb', '#3b82f6'];

export default function FinanceiroDashboardPage() {
  const [aba, setAba] = useState<Aba>('resumo');

  const [resumoInputInicio, setResumoInputInicio] = useState('');
  const [resumoInputFim, setResumoInputFim] = useState('');
  const [resumoDataInicio, setResumoDataInicio] = useState<string | undefined>();
  const [resumoDataFim, setResumoDataFim] = useState<string | undefined>();

  const [rankingInputInicio, setRankingInputInicio] = useState('');
  const [rankingInputFim, setRankingInputFim] = useState('');
  const [rankingDataInicio, setRankingDataInicio] = useState<string | undefined>();
  const [rankingDataFim, setRankingDataFim] = useState<string | undefined>();

  const resumo = useResumoFinanceiro(resumoDataInicio, resumoDataFim);
  const inadimplentes = useInadimplentes();
  const ranking = useRankingTecnicos(rankingDataInicio, rankingDataFim);

  function handleAplicarResumo() {
    setResumoDataInicio(resumoInputInicio || undefined);
    setResumoDataFim(resumoInputFim || undefined);
  }

  function handleAplicarRanking() {
    setRankingDataInicio(rankingInputInicio || undefined);
    setRankingDataFim(rankingInputFim || undefined);
  }

  const top10 = ranking.data ? [...ranking.data].sort((a, b) => b.total_gerado - a.total_gerado).slice(0, 10) : [];

  return (
    <div className="fin-page">
      <h1>Dashboard Financeiro</h1>

      <div className="fin-tabs">
        {(['resumo', 'inadimplentes', 'ranking'] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            className={`fin-tab${aba === a ? ' fin-tab-active' : ''}`}
            onClick={() => setAba(a)}
          >
            {a === 'resumo' ? 'Resumo' : a === 'inadimplentes' ? 'Inadimplentes' : 'Ranking Técnicos'}
          </button>
        ))}
      </div>

      {aba === 'resumo' && (
        <>
          <div className="fin-filtro">
            <label>
              Data início
              <input
                type="date"
                value={resumoInputInicio}
                onChange={(e) => setResumoInputInicio(e.target.value)}
              />
            </label>
            <label>
              Data fim
              <input
                type="date"
                value={resumoInputFim}
                onChange={(e) => setResumoInputFim(e.target.value)}
              />
            </label>
            <button type="button" onClick={handleAplicarResumo}>
              Aplicar
            </button>
          </div>

          {resumo.isLoading && <p>Carregando...</p>}
          {resumo.isError && <p>Erro ao carregar dados.</p>}

          {resumo.data && (
            <>
              <div className="fin-cards">
                <div className="fin-card">
                  <div className="fin-card-label">Receita Total</div>
                  <div className="fin-card-value">
                    {currencyFormatter.format(resumo.data.receita_total)}
                  </div>
                </div>
                <div className="fin-card">
                  <div className="fin-card-label">Receita Paga</div>
                  <div className="fin-card-value green">
                    {currencyFormatter.format(resumo.data.receita_paga)}
                  </div>
                </div>
                <div className="fin-card">
                  <div className="fin-card-label">A Receber</div>
                  <div className="fin-card-value yellow">
                    {currencyFormatter.format(resumo.data.receita_pendente)}
                  </div>
                </div>
                <div className="fin-card">
                  <div className="fin-card-label">Inadimplentes</div>
                  <div className="fin-card-value red">{resumo.data.total_inadimplentes}</div>
                </div>
              </div>

              <div className="fin-chart-box">
                <h2>Fluxo Mensal de Receita</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={resumo.data.fluxo_mensal}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => currencyFormatter.format(v)} />
                    <Area
                      type="monotone"
                      dataKey="receita"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="url(#colorReceita)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="fin-cards-sm">
                <div className="fin-card-sm">
                  <div className="fin-card-sm-label">OS Pagas</div>
                  <div className="fin-card-sm-value">{resumo.data.total_os_pagas}</div>
                </div>
                <div className="fin-card-sm">
                  <div className="fin-card-sm-label">OS Pendentes</div>
                  <div className="fin-card-sm-value">{resumo.data.total_os_pendentes}</div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {aba === 'inadimplentes' && (
        <>
          {inadimplentes.isLoading && <p>Carregando...</p>}
          {inadimplentes.isError && <p>Erro ao carregar dados.</p>}
          {inadimplentes.data && (
            <div className="fin-table-box">
              <h2>Ordens de Serviço Inadimplentes</h2>
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Nº OS</th>
                    <th>Cliente</th>
                    <th>Valor</th>
                    <th>Dias em Atraso</th>
                    <th>Técnico</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplentes.data.map((os) => (
                    <tr key={os.id}>
                      <td>{os.numero}</td>
                      <td>{os.cliente_nome}</td>
                      <td>{currencyFormatter.format(os.valor_cobrado)}</td>
                      <td>
                        {os.dias_em_atraso > 7 ? (
                          <span className="fin-badge-red">{os.dias_em_atraso}d</span>
                        ) : (
                          <span className="fin-days">{os.dias_em_atraso}d</span>
                        )}
                      </td>
                      <td>{os.tecnico_nome ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba === 'ranking' && (
        <>
          <div className="fin-filtro">
            <label>
              Data início
              <input
                type="date"
                value={rankingInputInicio}
                onChange={(e) => setRankingInputInicio(e.target.value)}
              />
            </label>
            <label>
              Data fim
              <input
                type="date"
                value={rankingInputFim}
                onChange={(e) => setRankingInputFim(e.target.value)}
              />
            </label>
            <button type="button" onClick={handleAplicarRanking}>
              Aplicar
            </button>
          </div>

          {ranking.isLoading && <p>Carregando...</p>}
          {ranking.isError && <p>Erro ao carregar dados.</p>}

          {ranking.data && (
            <>
              <div className="fin-table-box">
                <h2>Ranking de Técnicos</h2>
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Técnico</th>
                      <th>Total OS</th>
                      <th>Total Gerado</th>
                      <th>Comissão Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((t, index) => (
                      <tr key={t.tecnico_id}>
                        <td>{index + 1}</td>
                        <td>{t.tecnico_nome}</td>
                        <td>{t.total_os}</td>
                        <td>{currencyFormatter.format(t.total_gerado)}</td>
                        <td>{currencyFormatter.format(t.comissao_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {top10.length > 0 && (
                <div className="fin-chart-box">
                  <h2>Top 10 Técnicos por Receita Gerada</h2>
                  <ResponsiveContainer width="100%" height={top10.length * 48 + 40}>
                    <BarChart
                      data={top10}
                      layout="vertical"
                      margin={{ left: 120, right: 24, top: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis type="category" dataKey="tecnico_nome" tick={{ fontSize: 12 }} width={110} />
                      <Tooltip formatter={(v: number) => currencyFormatter.format(v)} />
                      <Bar dataKey="total_gerado" radius={[0, 4, 4, 0]}>
                        {top10.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

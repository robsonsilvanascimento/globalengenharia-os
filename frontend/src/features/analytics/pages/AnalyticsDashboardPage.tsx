import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAnalyticsResumo, type AnalyticsResumoFiltros } from '../hooks/useAnalyticsResumo';
import type { AnalyticsResumo } from '../../../types/analytics';
import './AnalyticsDashboardPage.css';

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function calcularTotalOS(resumo: AnalyticsResumo): number {
  return resumo.os_por_status.reduce((acc, s) => acc + s.total, 0);
}

function calcularOsConcluidas(resumo: AnalyticsResumo): number {
  return resumo.os_por_status.find((s) => s.status.toLowerCase() === 'concluida')?.total ?? 0;
}

function calcularReceitaTotal(resumo: AnalyticsResumo): number {
  return resumo.receita_por_mes.reduce((acc, r) => acc + r.valor, 0);
}

function calcularTmrMedio(resumo: AnalyticsResumo): number {
  if (resumo.tmr_por_categoria.length === 0) return 0;
  const soma = resumo.tmr_por_categoria.reduce((acc, t) => acc + t.horas, 0);
  return soma / resumo.tmr_por_categoria.length;
}

export default function AnalyticsDashboardPage() {
  const [inputInicio, setInputInicio] = useState('');
  const [inputFim, setInputFim] = useState('');
  const [filtros, setFiltros] = useState<AnalyticsResumoFiltros>({});

  const { data, isLoading, isError } = useAnalyticsResumo(filtros);

  function handleAplicar() {
    setFiltros({
      dataInicio: inputInicio || undefined,
      dataFim: inputFim || undefined,
    });
  }

  return (
    <div className="analytics-page">
      <h1>Dashboard Analytics</h1>

      <div className="analytics-filtro">
        <label>
          Data início
          <input
            type="date"
            value={inputInicio}
            onChange={(e) => setInputInicio(e.target.value)}
          />
        </label>
        <label>
          Data fim
          <input
            type="date"
            value={inputFim}
            onChange={(e) => setInputFim(e.target.value)}
          />
        </label>
        <button type="button" onClick={handleAplicar}>
          Aplicar
        </button>
      </div>

      {isLoading && <p>Carregando...</p>}
      {isError && <p>Erro ao carregar dados.</p>}

      {data && (
        <>
          <div className="analytics-cards">
            <div className="analytics-card">
              <div className="analytics-card-label">Total OS</div>
              <div className="analytics-card-value">{calcularTotalOS(data)}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-label">OS Concluídas</div>
              <div className="analytics-card-value">{calcularOsConcluidas(data)}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-label">Receita Total</div>
              <div className="analytics-card-value">{currencyFormatter.format(calcularReceitaTotal(data))}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-label">TMR Médio Geral</div>
              <div className="analytics-card-value">{calcularTmrMedio(data).toFixed(1)}h</div>
            </div>
          </div>

          <div className="analytics-charts">
            <div className="analytics-chart-box">
              <h2>OS por Mês</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.os_por_mes}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="analytics-chart-box">
              <h2>Receita Acumulada</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.receita_por_mes}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => currencyFormatter.format(v)} />
                  <Line type="monotone" dataKey="valor" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="analytics-chart-box full-width">
              <h2>OS por Status</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.os_por_status}
                    dataKey="total"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ status, percent }) => `${status} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {data.os_por_status.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="analytics-tables">
            <div className="analytics-table-box">
              <h2>Ranking de Técnicos</h2>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>OS Concluídas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking_tecnicos.map((tecnico, index) => (
                    <tr key={tecnico.tecnico_id}>
                      <td>{index + 1}</td>
                      <td>{tecnico.nome}</td>
                      <td>{tecnico.concluidas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="analytics-table-box">
              <h2>TMR por Categoria</h2>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Tempo Médio (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tmr_por_categoria.map((item) => (
                    <tr key={item.categoria}>
                      <td>{item.categoria}</td>
                      <td>{item.horas.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

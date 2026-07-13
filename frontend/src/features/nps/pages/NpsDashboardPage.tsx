import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useResultadosNps } from '../hooks/useResultadosNps';
import type { ResultadosNPS } from '../../../types/api';
import './NpsDashboardPage.css';

function buildDistribuicaoNotas(respostas: ResultadosNPS['respostas']) {
  const contagem: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) contagem[i] = 0;
  for (const r of respostas) contagem[r.nota] = (contagem[r.nota] ?? 0) + 1;
  return Array.from({ length: 11 }, (_, i) => ({ nota: String(i), quantidade: contagem[i] }));
}

function scoreClass(score: number): string {
  if (score > 50) return 'score-positivo';
  if (score > 0) return 'score-neutro';
  return 'score-negativo';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function NpsDashboardPage() {
  const [inputInicio, setInputInicio] = useState('');
  const [inputFim, setInputFim] = useState('');
  const [dataInicio, setDataInicio] = useState<string | undefined>();
  const [dataFim, setDataFim] = useState<string | undefined>();

  const { data, isLoading, isError } = useResultadosNps(dataInicio, dataFim);

  function handleAplicar() {
    setDataInicio(inputInicio || undefined);
    setDataFim(inputFim || undefined);
  }

  const pieData = data
    ? [
        { name: 'Promotores', value: data.promotores },
        { name: 'Neutros', value: data.neutros },
        { name: 'Detratores', value: data.detratores },
      ]
    : [];

  const PIE_COLORS = ['#16a34a', '#d97706', '#dc2626'];

  return (
    <div className="nps-page">
      <h1>NPS — Resultados</h1>

      <div className="nps-filtro">
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
          <div className="nps-cards">
            <div className="nps-card">
              <div className="nps-card-label">Score NPS</div>
              <div className={`nps-card-value ${scoreClass(data.score_nps)}`}>
                {data.score_nps}
              </div>
            </div>
            <div className="nps-card">
              <div className="nps-card-label">Total Respostas</div>
              <div className="nps-card-value">{data.total}</div>
            </div>
            <div className="nps-card">
              <div className="nps-card-label">Promotores</div>
              <div className="nps-card-value score-positivo">{data.promotores}</div>
            </div>
            <div className="nps-card">
              <div className="nps-card-label">Detratores</div>
              <div className="nps-card-value score-negativo">{data.detratores}</div>
            </div>
          </div>

          <div className="nps-charts">
            <div className="nps-chart-box">
              <h2>Distribuição de Notas</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={buildDistribuicaoNotas(data.respostas)}>
                  <XAxis dataKey="nota" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="nps-chart-box">
              <h2>Promotores / Neutros / Detratores</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="nps-table-box">
            <h2>Respostas</h2>
            <table className="nps-table">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Cliente</th>
                  <th>OS</th>
                  <th>Data</th>
                  <th>Comentário</th>
                </tr>
              </thead>
              <tbody>
                {data.respostas.map((r, i) => (
                  <tr key={i}>
                    <td>{r.nota}</td>
                    <td>{r.cliente_nome}</td>
                    <td>{r.ordem_servico_numero}</td>
                    <td>{formatDate(r.criado_em)}</td>
                    <td>{r.comentario ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRota, type ParadaRota } from './useRastreio';
import './rastreio.css';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function horaAgendada(iso: string | null): string {
  if (!iso) return 'sem horário';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mapsUrl(p: ParadaRota): string {
  if (p.latitude !== null && p.longitude !== null) {
    return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(p.endereco_atendimento ?? p.cliente_nome)}`;
}

export function RotaPage() {
  const [data, setData] = useState(hojeISO());
  const { data: rota, isLoading } = useRota(data);

  const paradas = rota?.paradas ?? [];

  return (
    <div className="rota-page">
      <div className="rota-head">
        <h1>Minha Rota</h1>
        <p className="rota-resumo">
          As ordens agendadas do dia, ordenadas pelo trajeto mais curto a partir da sua última localização.
        </p>
      </div>

      <div className="rota-controles">
        <label>
          Dia:{' '}
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        {rota && paradas.length > 0 && (
          <span className="rota-resumo">
            {paradas.length} parada(s) · ~{rota.distancia_total_km} km no total
          </span>
        )}
      </div>

      {isLoading && <p className="rota-vazio">Carregando…</p>}
      {!isLoading && paradas.length === 0 && <p className="rota-vazio">Nenhuma OS agendada para este dia.</p>}

      <ul className="rota-lista">
        {paradas.map((p) => (
          <li key={p.ordem_servico_id} className="rota-parada">
            <div className="rota-ordem">{p.ordem}</div>
            <div className="rota-parada-info">
              <div className="rota-parada-num">
                {p.numero} — {p.cliente_nome}
              </div>
              <div className="rota-parada-meta">
                {horaAgendada(p.data_agendada)} · {p.endereco_atendimento ?? 'endereço não informado'}
              </div>
              <div className="rota-links">
                <Link to={`/ordens-servico/${p.ordem_servico_id}`}>abrir OS</Link>
                <a href={mapsUrl(p)} target="_blank" rel="noreferrer">
                  navegar
                </a>
              </div>
            </div>
            {p.distancia_km !== null && <div className="rota-dist">{p.distancia_km.toFixed(1)} km</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

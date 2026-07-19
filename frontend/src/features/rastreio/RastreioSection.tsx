import { useState } from 'react';
import {
  obterLocalizacao,
  useCheckin,
  useRastreioOS,
  useRegistrarACaminho,
  type EventoRastreio,
} from './useRastreio';
import './rastreio.css';

const ROTULO: Record<EventoRastreio['tipo'], string> = {
  a_caminho: 'Técnico a caminho',
  chegada: 'Check-in no local',
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function RastreioSection({ osId, podeAgir }: { osId: string; podeAgir: boolean }) {
  const eventos = useRastreioOS(osId);
  const aCaminho = useRegistrarACaminho(osId);
  const checkin = useCheckin(osId);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'caminho' | 'checkin' | null>(null);

  async function marcarACaminho() {
    setErro(null);
    setOcupado('caminho');
    try {
      const coord = await obterLocalizacao(); // opcional
      await aCaminho.mutateAsync(coord ?? {});
    } catch {
      setErro('Não foi possível registrar. Tente novamente.');
    } finally {
      setOcupado(null);
    }
  }

  async function fazerCheckin() {
    setErro(null);
    setOcupado('checkin');
    try {
      const coord = await obterLocalizacao();
      if (!coord) {
        setErro('O check-in precisa da sua localização. Permita o acesso ao GPS e tente de novo.');
        return;
      }
      await checkin.mutateAsync(coord);
    } catch {
      setErro('Não foi possível registrar o check-in. Tente novamente.');
    } finally {
      setOcupado(null);
    }
  }

  const lista = eventos.data ?? [];

  return (
    <section className="rastreio-section">
      <div className="rastreio-header">
        <h3 className="rastreio-title">Rastreio / GPS</h3>
        {podeAgir && (
          <div className="rastreio-acoes">
            <button className="rastreio-btn caminho" onClick={marcarACaminho} disabled={ocupado !== null}>
              {ocupado === 'caminho' ? 'Registrando…' : 'Estou a caminho'}
            </button>
            <button className="rastreio-btn checkin" onClick={fazerCheckin} disabled={ocupado !== null}>
              {ocupado === 'checkin' ? 'Localizando…' : 'Cheguei (check-in)'}
            </button>
          </div>
        )}
      </div>

      {erro && <p className="rastreio-erro">{erro}</p>}

      {lista.length === 0 ? (
        <p className="rastreio-vazio">Nenhum evento de rastreio ainda.</p>
      ) : (
        <ul className="rastreio-lista">
          {lista.map((ev) => (
            <li key={ev.id} className="rastreio-evento">
              <span className={`rastreio-pino ${ev.tipo}`} />
              <span>
                {ROTULO[ev.tipo]} · {quando(ev.criado_em)}
              </span>
              {ev.latitude !== null && ev.longitude !== null && (
                <a href={mapsUrl(ev.latitude, ev.longitude)} target="_blank" rel="noreferrer">
                  ver no mapa
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

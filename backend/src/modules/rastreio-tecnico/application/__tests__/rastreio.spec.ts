import { describe, expect, it, beforeEach, vi } from 'vitest';
import { haversineKm, roteirizar } from '../../domain/geo';
import { RegistrarACaminhoUseCase } from '../RegistrarACaminhoUseCase';
import { RegistrarChegadaUseCase } from '../RegistrarChegadaUseCase';
import { RoteirizarDiaUseCase } from '../RoteirizarDiaUseCase';
import type { RastreioTecnicoOS } from '../../domain/RastreioTecnicoOS';
import type { CriarRastreioDados, RastreioTecnicoRepository } from '../../domain/RastreioTecnicoRepository';
import type { OrdemAgendada, OrdemAgendadaRepository } from '../../domain/OrdemAgendadaRepository';
import type { BuscarOSParaRastreio, OSParaRastreio } from '../ports';

class FakeRastreioRepo implements RastreioTecnicoRepository {
  public eventos: RastreioTecnicoOS[] = [];
  public ultimaLoc: { latitude: number; longitude: number } | null = null;
  private seq = 0;
  async criar(d: CriarRastreioDados): Promise<RastreioTecnicoOS> {
    const e: RastreioTecnicoOS = {
      id: `ev-${(this.seq += 1)}`,
      ordemServicoId: d.ordemServicoId,
      tecnicoId: d.tecnicoId,
      tipo: d.tipo,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      criadoEm: new Date(),
    };
    this.eventos.push(e);
    return e;
  }
  async listarPorOrdemServico(id: string): Promise<RastreioTecnicoOS[]> {
    return this.eventos.filter((e) => e.ordemServicoId === id);
  }
  async ultimaLocalizacaoDoTecnico(): Promise<{ latitude: number; longitude: number } | null> {
    return this.ultimaLoc;
  }
}

class FakeOrdemAgendadaRepo implements OrdemAgendadaRepository {
  public ordens: OrdemAgendada[] = [];
  public coordsDefinidas: Array<{ id: string; lat: number; lon: number }> = [];
  async listarDoDia(): Promise<OrdemAgendada[]> {
    return this.ordens;
  }
  async definirCoordenadas(ordemServicoId: string, latitude: number, longitude: number): Promise<void> {
    this.coordsDefinidas.push({ id: ordemServicoId, lat: latitude, lon: longitude });
  }
}

function fakeBuscarOS(os: OSParaRastreio | null): BuscarOSParaRastreio {
  return { buscar: async () => os };
}

const OS_BASE: OSParaRastreio = {
  id: 'os-1',
  tecnicoId: 'tec-1',
  clienteId: 'cli-1',
  numero: 'OS-2026-000001',
  latitude: null,
  longitude: null,
};

describe('geo', () => {
  it('haversine ~ distancia conhecida (SP-RJ ~ 360km)', () => {
    const d = haversineKm({ latitude: -23.55, longitude: -46.63 }, { latitude: -22.91, longitude: -43.17 });
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(380);
  });

  it('roteirizar ordena por vizinho mais proximo e joga sem-coord ao fim', () => {
    const paradas = [
      { id: 'a', latitude: -23.6, longitude: -46.6 },
      { id: 'b', latitude: -23.51, longitude: -46.63 },
      { id: 'sem', latitude: null, longitude: null },
      { id: 'c', latitude: -23.55, longitude: -46.63 },
    ];
    const inicio = { latitude: -23.5, longitude: -46.63 };
    const { ordenadas, distanciaTotalKm } = roteirizar(inicio, paradas);
    expect(ordenadas.map((o) => o.parada.id)).toEqual(['b', 'c', 'a', 'sem']);
    expect(ordenadas[3]?.distanciaKm).toBeNull();
    expect(distanciaTotalKm).toBeGreaterThan(0);
  });
});

describe('RegistrarACaminhoUseCase', () => {
  let repo: FakeRastreioRepo;
  let notificar: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    repo = new FakeRastreioRepo();
    notificar = vi.fn(async () => {});
  });

  it('registra evento e notifica o cliente', async () => {
    const uc = new RegistrarACaminhoUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(OS_BASE), notificarCliente: notificar });
    const ev = await uc.execute({ ordemServicoId: 'os-1', ator: { id: 'tec-1', papel: 'tecnico' }, latitude: -23.5, longitude: -46.6 });
    expect(ev.tipo).toBe('a_caminho');
    expect(notificar).toHaveBeenCalledWith({ ordemServicoId: 'os-1', clienteId: 'cli-1' });
  });

  it('bloqueia tecnico nao atribuido a OS', async () => {
    const uc = new RegistrarACaminhoUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(OS_BASE), notificarCliente: notificar });
    await expect(uc.execute({ ordemServicoId: 'os-1', ator: { id: 'outro', papel: 'tecnico' } })).rejects.toThrow();
    expect(notificar).not.toHaveBeenCalled();
  });

  it('admin pode agir em qualquer OS', async () => {
    const uc = new RegistrarACaminhoUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(OS_BASE), notificarCliente: notificar });
    const ev = await uc.execute({ ordemServicoId: 'os-1', ator: { id: 'admin-1', papel: 'admin' } });
    expect(ev.id).toBeTruthy();
  });

  it('so notifica o cliente uma vez por OS (anti-spam), mas grava todos os eventos', async () => {
    const uc = new RegistrarACaminhoUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(OS_BASE), notificarCliente: notificar });
    const ator = { id: 'tec-1', papel: 'tecnico' };
    await uc.execute({ ordemServicoId: 'os-1', ator });
    await uc.execute({ ordemServicoId: 'os-1', ator });
    await uc.execute({ ordemServicoId: 'os-1', ator });
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(repo.eventos.filter((e) => e.tipo === 'a_caminho')).toHaveLength(3);
  });
});

describe('RegistrarChegadaUseCase', () => {
  let repo: FakeRastreioRepo;
  let ordemRepo: FakeOrdemAgendadaRepo;
  beforeEach(() => {
    repo = new FakeRastreioRepo();
    ordemRepo = new FakeOrdemAgendadaRepo();
  });

  it('exige coordenada valida', async () => {
    const uc = new RegistrarChegadaUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(OS_BASE), ordemAgendadaRepository: ordemRepo });
    await expect(uc.execute({ ordemServicoId: 'os-1', ator: { id: 'tec-1', papel: 'tecnico' }, latitude: 999, longitude: 0 })).rejects.toThrow();
  });

  it('registra chegada e adota as coords na OS quando ela nao tinha', async () => {
    const uc = new RegistrarChegadaUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(OS_BASE), ordemAgendadaRepository: ordemRepo });
    const ev = await uc.execute({ ordemServicoId: 'os-1', ator: { id: 'tec-1', papel: 'tecnico' }, latitude: -23.5, longitude: -46.6 });
    expect(ev.tipo).toBe('chegada');
    expect(ordemRepo.coordsDefinidas).toHaveLength(1);
  });

  it('nao sobrescreve coords ja existentes na OS', async () => {
    const osComCoord: OSParaRastreio = { ...OS_BASE, latitude: -20, longitude: -40 };
    const uc = new RegistrarChegadaUseCase({ rastreioRepository: repo, buscarOS: fakeBuscarOS(osComCoord), ordemAgendadaRepository: ordemRepo });
    await uc.execute({ ordemServicoId: 'os-1', ator: { id: 'tec-1', papel: 'tecnico' }, latitude: -23.5, longitude: -46.6 });
    expect(ordemRepo.coordsDefinidas).toHaveLength(0);
  });
});

describe('RoteirizarDiaUseCase', () => {
  it('monta a rota do dia partindo da ultima localizacao do tecnico', async () => {
    const repo = new FakeRastreioRepo();
    repo.ultimaLoc = { latitude: -23.5, longitude: -46.63 };
    const ordemRepo = new FakeOrdemAgendadaRepo();
    ordemRepo.ordens = [
      { id: 'a', numero: 'OS-1', clienteNome: 'A', enderecoAtendimento: null, latitude: -23.6, longitude: -46.6, dataAgendada: new Date(), status: 'atribuida' },
      { id: 'b', numero: 'OS-2', clienteNome: 'B', enderecoAtendimento: null, latitude: -23.51, longitude: -46.63, dataAgendada: new Date(), status: 'atribuida' },
    ];
    const uc = new RoteirizarDiaUseCase({ ordemAgendadaRepository: ordemRepo, rastreioRepository: repo });
    const res = await uc.execute({ tecnicoId: 'tec-1', dia: new Date() });
    expect(res.paradas.map((p) => p.numero)).toEqual(['OS-2', 'OS-1']);
    expect(res.pontoPartida).toEqual({ latitude: -23.5, longitude: -46.63 });
    expect(res.distanciaTotalKm).toBeGreaterThan(0);
  });
});

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { ForbiddenError } from '../../../../shared/http/errors/AppError';
import type { RastreioTecnicoRepository } from '../../domain/RastreioTecnicoRepository';
import type { OrdemAgendadaRepository } from '../../domain/OrdemAgendadaRepository';
import type { BuscarOSParaRastreio, NotificarClienteACaminho } from '../../application/ports';
import { RegistrarACaminhoUseCase } from '../../application/RegistrarACaminhoUseCase';
import { RegistrarChegadaUseCase } from '../../application/RegistrarChegadaUseCase';
import { RoteirizarDiaUseCase } from '../../application/RoteirizarDiaUseCase';
import type { RastreioTecnicoOS } from '../../domain/RastreioTecnicoOS';

const osIdParams = z.object({ id: z.string().uuid() });
const coordOpcional = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
const coordObrigatoria = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const rotaQuery = z.object({
  tecnico_id: z.string().uuid().optional(),
  data: z.string().datetime().optional(),
});

function rastreioResponse(r: RastreioTecnicoOS) {
  return {
    id: r.id,
    ordem_servico_id: r.ordemServicoId,
    tecnico_id: r.tecnicoId,
    tipo: r.tipo,
    latitude: r.latitude,
    longitude: r.longitude,
    criado_em: r.criadoEm,
  };
}

export interface RastreioTecnicoRoutesDeps {
  rastreioRepository: RastreioTecnicoRepository;
  ordemAgendadaRepository: OrdemAgendadaRepository;
  buscarOS: BuscarOSParaRastreio;
  notificarClienteACaminho: NotificarClienteACaminho;
}

export function registerRastreioTecnicoRoutes(app: FastifyInstance, deps: RastreioTecnicoRoutesDeps): void {
  const equipe = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };
  // Leitura do historico de rastreio tambem liberada pro ajudante (app mobile, somente visualizacao).
  const leituraEquipeComAjudante = {
    preHandler: [authenticate, requireRole(['admin', 'tecnico', 'ajudante'])],
  };

  const registrarACaminho = new RegistrarACaminhoUseCase({
    rastreioRepository: deps.rastreioRepository,
    buscarOS: deps.buscarOS,
    notificarCliente: deps.notificarClienteACaminho,
  });
  const registrarChegada = new RegistrarChegadaUseCase({
    rastreioRepository: deps.rastreioRepository,
    buscarOS: deps.buscarOS,
    ordemAgendadaRepository: deps.ordemAgendadaRepository,
  });
  const roteirizarDia = new RoteirizarDiaUseCase({
    ordemAgendadaRepository: deps.ordemAgendadaRepository,
    rastreioRepository: deps.rastreioRepository,
  });

  // Tecnico avisa que esta a caminho (notifica o cliente).
  app.post('/ordens-servico/:id/a-caminho', equipe, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = coordOpcional.parse(request.body ?? {});
    const evento = await registrarACaminho.execute({
      ordemServicoId: id,
      ator: { id: request.user!.id, papel: request.user!.papel },
      latitude: body.latitude,
      longitude: body.longitude,
    });
    return reply.status(201).send(rastreioResponse(evento));
  });

  // Check-in por GPS na chegada.
  app.post('/ordens-servico/:id/checkin', equipe, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = coordObrigatoria.parse(request.body);
    const evento = await registrarChegada.execute({
      ordemServicoId: id,
      ator: { id: request.user!.id, papel: request.user!.papel },
      latitude: body.latitude,
      longitude: body.longitude,
    });
    return reply.status(201).send(rastreioResponse(evento));
  });

  // Historico de rastreio de uma OS.
  app.get('/ordens-servico/:id/rastreio', leituraEquipeComAjudante, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const eventos = await deps.rastreioRepository.listarPorOrdemServico(id);
    return reply.status(200).send(eventos.map(rastreioResponse));
  });

  // Rota do dia. Tecnico so roteiriza a propria agenda; admin pode informar tecnico_id.
  app.get('/rota', equipe, async (request, reply) => {
    const q = rotaQuery.parse(request.query);
    const usuario = request.user!;

    let tecnicoId = usuario.id;
    if (q.tecnico_id && q.tecnico_id !== usuario.id) {
      if (usuario.papel !== 'admin') throw new ForbiddenError('Voce so pode ver a propria rota');
      tecnicoId = q.tecnico_id;
    }

    const dia = q.data ? new Date(q.data) : new Date();
    const resultado = await roteirizarDia.execute({ tecnicoId, dia });
    return reply.status(200).send({
      distancia_total_km: resultado.distanciaTotalKm,
      ponto_partida: resultado.pontoPartida,
      paradas: resultado.paradas.map((p) => ({
        ordem: p.ordem,
        ordem_servico_id: p.ordemServicoId,
        numero: p.numero,
        cliente_nome: p.clienteNome,
        endereco_atendimento: p.enderecoAtendimento,
        latitude: p.latitude,
        longitude: p.longitude,
        data_agendada: p.dataAgendada,
        status: p.status,
        distancia_km: p.distanciaKm,
      })),
    });
  });
}

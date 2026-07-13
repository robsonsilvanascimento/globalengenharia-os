import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../../../shared/domain/EventBus';
import { OS_STATUS_ALTERADO_EVENT, type OSStatusAlterado } from '../../../shared/domain/events/OSStatusAlterado';
import { OS_REAGENDADA_EVENT, type OSReagendada } from '../../../shared/domain/events/OSReagendada';
import { TECNICO_ATRIBUIDO_OS_EVENT, type TecnicoAtribuidoOS } from '../../../shared/domain/events/TecnicoAtribuidoOS';
import { logger } from '../../../shared/infra/Logger';
import type { GoogleCalendarService } from '../infrastructure/GoogleCalendarService';

/**
 * Registra os listeners de sincronizacao com o Google Calendar.
 * - TecnicoAtribuidoOS  → cria evento no calendario do tecnico
 * - OSReagendada        → atualiza data/hora do evento existente
 * - OSStatusAlterado (concluida | cancelada) → remove o evento
 */
export function registrarSincronizarCalendarioListener(
  eventBus: EventBus,
  calendarService: GoogleCalendarService,
  prisma: PrismaClient,
): void {
  // ── Tecnico atribuido → criar evento ────────────────────────────────────
  eventBus.subscribe<TecnicoAtribuidoOS>(TECNICO_ATRIBUIDO_OS_EVENT, async (evento) => {
    const os = await prisma.ordemServico.findUnique({
      where: { id: evento.ordemServicoId },
      include: { cliente: true, tecnico: true },
    });

    if (!os || !os.dataAgendada || !os.tecnico?.email) {
      logger.info(
        { ordemServicoId: evento.ordemServicoId },
        '[GoogleCalendar] Evento ignorado: OS sem data agendada ou tecnico sem e-mail',
      );
      return;
    }

    const eventId = await calendarService.criarEvento({
      tecnicoEmail: os.tecnico.email,
      osId: os.id,
      osNumero: os.numero,
      clienteNome: os.cliente.nome,
      dataAgendada: os.dataAgendada,
      descricao: os.descricaoProblema,
    });

    if (eventId) {
      await prisma.ordemServico.update({
        where: { id: os.id },
        data: { googleCalendarEventId: eventId },
      });
    }
  });

  // ── OS reagendada → atualizar evento ────────────────────────────────────
  eventBus.subscribe<OSReagendada>(OS_REAGENDADA_EVENT, async (evento) => {
    const os = await prisma.ordemServico.findUnique({
      where: { id: evento.ordemServicoId },
      include: { cliente: true, tecnico: true },
    });

    if (!os?.googleCalendarEventId || !os.tecnico?.email) {
      logger.info(
        { ordemServicoId: evento.ordemServicoId },
        '[GoogleCalendar] Reagendamento ignorado: sem eventId ou tecnico sem e-mail',
      );
      return;
    }

    await calendarService.atualizarEvento(os.googleCalendarEventId, os.tecnico.email, {
      osNumero: os.numero,
      clienteNome: os.cliente.nome,
      dataAgendada: evento.dataAgendada,
      descricao: os.descricaoProblema,
    });
  });

  // ── OS concluida ou cancelada → remover evento ──────────────────────────
  eventBus.subscribe<OSStatusAlterado>(OS_STATUS_ALTERADO_EVENT, async (evento) => {
    if (evento.statusNovo !== 'concluida' && evento.statusNovo !== 'cancelada') return;

    const os = await prisma.ordemServico.findUnique({
      where: { id: evento.ordemServicoId },
      include: { tecnico: true },
    });

    if (!os?.googleCalendarEventId || !os.tecnico?.email) return;

    await calendarService.removerEvento(os.googleCalendarEventId, os.tecnico.email);

    await prisma.ordemServico.update({
      where: { id: os.id },
      data: { googleCalendarEventId: null },
    });
  });
}

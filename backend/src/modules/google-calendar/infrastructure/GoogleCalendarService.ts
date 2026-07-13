import { google } from 'googleapis';
import { logger } from '../../../shared/infra/Logger';

export interface CriarEventoParams {
  tecnicoEmail: string;
  osId: string;
  osNumero: string;
  clienteNome: string;
  dataAgendada: Date;
  descricao?: string;
}

const ENABLED = process.env.GOOGLE_CALENDAR_ENABLED === 'true';

/**
 * Servico de integracao com Google Calendar via Service Account com
 * Domain-Wide Delegation. Usa JWT para impersonar o e-mail do tecnico e
 * criar/atualizar/remover eventos no calendario dele.
 *
 * Todos os metodos sao no-op silenciosos quando GOOGLE_CALENDAR_ENABLED != 'true'.
 * Falhas de comunicacao com o Google nao lancam excecao — apenas logam e retornam null/void.
 */
export class GoogleCalendarService {
  private buildCalendarClient(tecnicoEmail: string) {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON nao configurado');
    }

    const credentials = JSON.parse(credentialsJson) as {
      client_email: string;
      private_key: string;
    };

    // JWT com subject = e-mail do tecnico → Domain-Wide Delegation
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: tecnicoEmail,
    });

    return google.calendar({ version: 'v3', auth });
  }

  async criarEvento(params: CriarEventoParams): Promise<string | null> {
    if (!ENABLED) return null;

    try {
      const calendar = this.buildCalendarClient(params.tecnicoEmail);

      const inicio = new Date(params.dataAgendada);
      const fim = new Date(inicio.getTime() + 2 * 60 * 60 * 1000); // +2 horas

      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `OS ${params.osNumero} — ${params.clienteNome}`,
          description: params.descricao ?? `Ordem de Servico ID: ${params.osId}`,
          start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
          end: { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' },
        },
      });

      const eventId = res.data.id ?? null;
      logger.info({ osId: params.osId, eventId }, '[GoogleCalendar] Evento criado');
      return eventId;
    } catch (err) {
      logger.warn({ err, osId: params.osId }, '[GoogleCalendar] Falha ao criar evento — integracao ignorada');
      return null;
    }
  }

  async atualizarEvento(
    eventId: string,
    tecnicoEmail: string,
    params: Partial<CriarEventoParams>,
  ): Promise<void> {
    if (!ENABLED) return;

    try {
      const calendar = this.buildCalendarClient(tecnicoEmail);

      const patch: Record<string, unknown> = {};

      if (params.osNumero && params.clienteNome) {
        patch['summary'] = `OS ${params.osNumero} — ${params.clienteNome}`;
      }
      if (params.descricao !== undefined) {
        patch['description'] = params.descricao;
      }
      if (params.dataAgendada) {
        const inicio = new Date(params.dataAgendada);
        const fim = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);
        patch['start'] = { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' };
        patch['end'] = { dateTime: fim.toISOString(), timeZone: 'America/Sao_Paulo' };
      }

      await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: patch,
      });

      logger.info({ eventId }, '[GoogleCalendar] Evento atualizado');
    } catch (err) {
      logger.warn({ err, eventId }, '[GoogleCalendar] Falha ao atualizar evento — integracao ignorada');
    }
  }

  async removerEvento(eventId: string, tecnicoEmail: string): Promise<void> {
    if (!ENABLED) return;

    try {
      const calendar = this.buildCalendarClient(tecnicoEmail);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      logger.info({ eventId }, '[GoogleCalendar] Evento removido');
    } catch (err) {
      logger.warn({ err, eventId }, '[GoogleCalendar] Falha ao remover evento — integracao ignorada');
    }
  }
}

import { EventEmitter } from 'node:events';

export type EventHandler<T> = (event: T) => void | Promise<void>;

/**
 * Barramento de eventos de dominio in-process (sem dependencia de infra externa).
 * Usado para desacoplar efeitos colaterais (ex.: enfileirar notificacao de
 * WhatsApp) da logica principal de um caso de uso.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Eventos de dominio podem ter varios subscribers; evita warning do Node.
    this.emitter.setMaxListeners(50);
  }

  publish<T>(eventName: string, event: T): void {
    this.emitter.emit(eventName, event);
  }

  subscribe<T>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.on(eventName, (event: T) => {
      Promise.resolve(handler(event)).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[EventBus] Erro ao processar handler de "${eventName}"`, err);
      });
    });
  }

  unsubscribe<T>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.off(eventName, handler as (...args: unknown[]) => void);
  }
}

/** Instancia singleton compartilhada entre modulos. */
export const eventBus = new EventBus();

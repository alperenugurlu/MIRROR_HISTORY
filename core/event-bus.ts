import { EventEmitter } from 'events';

export interface MirrorHistoryEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

class MirrorHistoryEventBus extends EventEmitter {
  emit(event: 'mirror-history', payload: MirrorHistoryEvent): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  on(event: 'mirror-history', listener: (payload: MirrorHistoryEvent) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

export const eventBus = new MirrorHistoryEventBus();

export function broadcast(type: string, data: Record<string, unknown> = {}): void {
  eventBus.emit('mirror-history', {
    type,
    data,
    timestamp: new Date().toISOString(),
  });
}

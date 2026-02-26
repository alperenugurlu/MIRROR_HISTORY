import type { FastifyRequest, FastifyReply } from 'fastify';
import { eventBus, type MirrorHistoryEvent } from '../core/event-bus';

interface SSEClient {
  id: string;
  reply: FastifyReply;
}

const clients: SSEClient[] = [];
let clientIdCounter = 0;

export function initSSE(): void {
  eventBus.on('mirror-history', (payload: MirrorHistoryEvent) => {
    const data = JSON.stringify(payload);
    const message = `event: mirror-history\ndata: ${data}\n\n`;

    for (let i = clients.length - 1; i >= 0; i--) {
      try {
        clients[i].reply.raw.write(message);
      } catch {
        // Client disconnected
        clients.splice(i, 1);
      }
    }
  });
}

export function handleSSE(request: FastifyRequest, reply: FastifyReply): void {
  const clientId = `sse-${++clientIdCounter}`;

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection message
  reply.raw.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  clients.push({ id: clientId, reply });

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  request.raw.on('close', () => {
    clearInterval(heartbeat);
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx !== -1) clients.splice(idx, 1);
  });
}

export function getClientCount(): number {
  return clients.length;
}

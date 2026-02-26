import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT } from '../core/services/auth-service';

// ── Static API token (for Telegram bot & external callers) ──

const TOKEN_PATH = path.join(os.homedir(), '.mirror-history', 'api-token.txt');

export function getOrCreateToken(): string {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(TOKEN_PATH)) {
    return fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
  }

  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
  return token;
}

let cachedToken: string | null = null;

export function initAuth(): string {
  cachedToken = getOrCreateToken();
  return cachedToken;
}

// Routes that don't require authentication
const PUBLIC_PATHS = ['/health', '/api/auth/login'];

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip auth for public paths and static files
  const urlPath = request.url.split('?')[0];
  if (PUBLIC_PATHS.includes(urlPath) || !urlPath.startsWith('/api/')) return;

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  // Strategy 1: Try JWT verification
  const jwtUser = verifyJWT(token);
  if (jwtUser) {
    // Attach user to request for downstream use
    (request as any).userId = jwtUser.id;
    (request as any).username = jwtUser.username;
    return;
  }

  // Strategy 2: Try static API token (backward compat for Telegram bot)
  if (token === cachedToken) {
    (request as any).userId = 'api-token';
    (request as any).username = 'api';
    return;
  }

  reply.code(403).send({ error: 'Invalid token' });
}

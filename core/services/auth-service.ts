import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import * as db from '../database';
import type { AuthUser, LoginResult } from '../types';

const SALT_ROUNDS = 10;
const JWT_EXPIRY = '4h';
const SECRET_PATH = path.join(os.homedir(), '.mirror-history', 'jwt-secret.txt');

// Dummy hash for timing-attack mitigation (constant-time on invalid usernames)
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-pad', SALT_ROUNDS);

let jwtSecret: string | null = null;

function getJwtSecret(): string {
  if (jwtSecret) return jwtSecret;

  // Environment variable takes precedence
  if (process.env.MIRROR_HISTORY_JWT_SECRET) {
    jwtSecret = process.env.MIRROR_HISTORY_JWT_SECRET;
    return jwtSecret;
  }

  // Read from file or generate
  const dir = path.dirname(SECRET_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(SECRET_PATH)) {
    jwtSecret = fs.readFileSync(SECRET_PATH, 'utf-8').trim();
    return jwtSecret;
  }

  jwtSecret = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(SECRET_PATH, jwtSecret, { mode: 0o600 });
  return jwtSecret;
}

/**
 * Validate password strength: min 8 chars, 1 lowercase, 1 uppercase, 1 digit.
 * Returns error message or null if valid.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/\d/.test(password)) return 'Password must contain at least one digit';
  return null;
}

/**
 * Seed the default admin user if no users exist.
 * Default credentials: admin / changeme
 */
export function seedDefaultUser(): void {
  if (db.getUserCount() > 0) return;

  const hash = bcrypt.hashSync('changeme', SALT_ROUNDS);
  db.createUser('admin', hash, true);
}

/**
 * Verify username/password credentials.
 * Uses dummy bcrypt compare when user not found to prevent timing attacks.
 */
export function verifyCredentials(username: string, password: string): { valid: boolean; user?: AuthUser } {
  const dbUser = db.getUserByUsername(username);

  if (!dbUser) {
    // Perform a dummy compare to equalize timing (prevents user enumeration)
    bcrypt.compareSync(password, DUMMY_HASH);
    return { valid: false };
  }

  const valid = bcrypt.compareSync(password, dbUser.password_hash);
  if (!valid) return { valid: false };

  return {
    valid: true,
    user: {
      id: dbUser.id,
      username: dbUser.username,
      mustChangePassword: dbUser.must_change_password === 1,
    },
  };
}

/**
 * Change a user's password. Validates old password first.
 * Sets must_change_password to false.
 */
export function changePassword(userId: string, oldPassword: string, newPassword: string): { success: boolean; error?: string } {
  const dbUser = db.getUserById(userId);
  if (!dbUser) return { success: false, error: 'User not found' };

  const valid = bcrypt.compareSync(oldPassword, dbUser.password_hash);
  if (!valid) return { success: false, error: 'Current password is incorrect' };

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { success: false, error: strengthError };

  const newHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  db.updateUserPassword(userId, newHash);
  db.logActivity('password_changed', `User ${dbUser.username} changed their password`);
  return { success: true };
}

/**
 * Generate a JWT token for a user.
 * Uses explicit HS256 algorithm and issuer/audience claims.
 */
export function generateJWT(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username },
    getJwtSecret(),
    {
      expiresIn: JWT_EXPIRY,
      algorithm: 'HS256',
      issuer: 'mirror-history',
      audience: 'mirror-history-client',
    },
  );
}

/**
 * Verify a JWT token and return the decoded payload.
 * Validates algorithm, issuer, and audience to prevent token manipulation.
 */
export function verifyJWT(token: string): { id: string; username: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: 'mirror-history',
      audience: 'mirror-history-client',
    }) as { id: string; username: string };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Full login flow: verify credentials + generate JWT.
 */
export function login(username: string, password: string): LoginResult {
  const result = verifyCredentials(username, password);
  if (!result.valid || !result.user) {
    db.logActivity('login_failed', `Failed login attempt for username: ${username}`);
    throw new Error('Invalid username or password');
  }

  db.logActivity('login_success', `User ${username} logged in`);
  const token = generateJWT(result.user);
  return { token, user: result.user };
}

/**
 * Get user info from a JWT token.
 */
export function getUserFromToken(token: string): AuthUser | null {
  const decoded = verifyJWT(token);
  if (!decoded) return null;

  const dbUser = db.getUserById(decoded.id);
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    username: dbUser.username,
    mustChangePassword: dbUser.must_change_password === 1,
  };
}

// ── Electron IPC auth (in-memory session) ──

let currentSessionUser: AuthUser | null = null;

export function ipcLogin(username: string, password: string): LoginResult {
  const result = login(username, password);
  currentSessionUser = result.user;
  return result;
}

export function ipcLogout(): void {
  currentSessionUser = null;
}

export function ipcGetCurrentUser(): AuthUser | null {
  return currentSessionUser;
}

export function ipcChangePassword(oldPassword: string, newPassword: string): { success: boolean; error?: string } {
  if (!currentSessionUser) return { success: false, error: 'Not authenticated' };
  const result = changePassword(currentSessionUser.id, oldPassword, newPassword);
  if (result.success && currentSessionUser) {
    currentSessionUser = { ...currentSessionUser, mustChangePassword: false };
  }
  return result;
}

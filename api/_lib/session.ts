import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '../../src/shared/types.js';
import { HttpError } from './db.js';

export const COOKIE = 'pp_session';
export const SESSION_DAYS = 90;

export interface SessionPayload {
  email: string;
  role: Role;
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new HttpError(503, 'SESSION_SECRET is missing or shorter than 32 characters.');
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare against a same-length buffer so the length check doesn't leak timing.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function createToken(email: string, role: Role, now = Date.now()): string {
  const payload: SessionPayload = { email, role, exp: Math.floor(now / 1000) + SESSION_DAYS * 86400 };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

export function verifyToken(token: string, now = Date.now()): SessionPayload | null {
  const [data, mac] = token.split('.');
  if (!data || !mac || !safeEqual(sign(data), mac)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof p.email !== 'string' || typeof p.exp !== 'number') return null;
    if (p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name = COOKIE): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

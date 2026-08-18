import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { loadConfig } from '@kdp/config';
import type { Role } from '@kdp/shared';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  sid: string;
}

export function signAccessToken(payload: AccessTokenPayload): { token: string; expiresAt: Date } {
  const config = loadConfig();
  const expiresInSeconds = config.ACCESS_TOKEN_TTL_MINUTES * 60;
  const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: expiresInSeconds });
  return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = loadConfig();
  return jwt.verify(token, config.JWT_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

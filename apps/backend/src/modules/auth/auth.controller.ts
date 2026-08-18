import type { Request, Response } from 'express';
import { loadConfig } from '@kdp/config';
import type { AuthResponse, LoginInput, RegisterInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { AppError } from '../../common/errors/app-error.js';
import { authService, type IssuedTokens } from './auth.service.js';

const REFRESH_COOKIE_NAME = 'rt';
const REFRESH_COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, tokens: IssuedTokens): void {
  const config = loadConfig();
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: config.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshTokenExpiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  const config = loadConfig();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: config.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
  });
}

function requestMeta(req: Request) {
  return { userAgent: req.header('user-agent') ?? '', ip: req.ip ?? '' };
}

function toAuthResponse(user: AuthResponse['user'], tokens: IssuedTokens): AuthResponse {
  return {
    user,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
  };
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.register(req.body as RegisterInput, requestMeta(req));
    setRefreshCookie(res, tokens);
    ok(res, toAuthResponse(user, tokens), 201);
  },

  async login(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await authService.login(req.body as LoginInput, requestMeta(req));
    setRefreshCookie(res, tokens);
    ok(res, toAuthResponse(user, tokens));
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE_NAME];
    if (!rawRefreshToken) {
      throw AppError.unauthorized('No refresh session present.');
    }
    const { user, tokens } = await authService.refresh(rawRefreshToken, requestMeta(req));
    setRefreshCookie(res, tokens);
    ok(res, toAuthResponse(user, tokens));
  },

  async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE_NAME];
    if (rawRefreshToken) {
      await authService.logout(rawRefreshToken);
    }
    clearRefreshCookie(res);
    ok(res, { loggedOut: true });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getById(req.user!.id);
    ok(res, user);
  },
};

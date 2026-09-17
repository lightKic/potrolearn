import { Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE_NAME = 'potrolearn_refresh';

/**
 * Configura la cookie HttpOnly con el Refresh Token en texto plano (RAW).
 * Duración configurada por REFRESH_TOKEN_TTL_DAYS (default 14 días).
 * Path limitado estrictamente a /api/auth.
 */
export function setRefreshCookie(res: Response, rawToken: string): void {
  const isProduction = env.nodeEnv === 'production';
  const maxAge = env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge,
  });
}

/**
 * Elimina la cookie HttpOnly de Refresh Token.
 */
export function clearRefreshCookie(res: Response): void {
  const isProduction = env.nodeEnv === 'production';

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
  });
}

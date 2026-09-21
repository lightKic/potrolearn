import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]')) {
  throw new Error(
    'DATABASE_URL environment variable is required and must contain a valid database password in backend/.env'
  );
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.trim() === '' || jwtSecret.includes('[YOUR-JWT-SECRET]')) {
  throw new Error(
    'JWT_SECRET environment variable is required and must be configured in backend/.env (cannot be empty or placeholder)'
  );
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
const refreshTokenTtlDays = process.env.REFRESH_TOKEN_TTL_DAYS
  ? parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10)
  : 14;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const nodeEnv = process.env.NODE_ENV || 'development';

const emailUser = process.env.EMAIL_USER || '';
const emailAppPassword = process.env.EMAIL_APP_PASSWORD || '';
const emailFrom = process.env.EMAIL_FROM || 'PotroLearn <noreply@potrolearn.edu.mx>';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOrigin = process.env.CORS_ORIGIN || frontendUrl;

const enableScheduledPublish = process.env.ENABLE_SCHEDULED_PUBLISH !== 'false';

export const env = {
  databaseUrl,
  jwtSecret,
  jwtExpiresIn,
  refreshTokenTtlDays,
  port,
  nodeEnv,
  emailUser,
  emailAppPassword,
  emailFrom,
  frontendUrl,
  corsOrigin,
  enableScheduledPublish,
} as const;

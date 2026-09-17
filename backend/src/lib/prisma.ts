import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../config/env';

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end();
};

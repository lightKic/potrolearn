import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function testConnection() {
  console.log('--- Iniciando prueba de conectividad de bajo impacto (PotroLearn) ---');

  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]')) {
    console.log('DATABASE_URL status: Configurada en backend/.env con el marcador [YOUR-PASSWORD]');
    console.log('Por favor reemplace [YOUR-PASSWORD] en backend/.env con su contraseña real de Supabase.');
    return;
  }

  console.log('DATABASE_URL loaded successfully');

  // 1. Prueba de DATABASE_URL (Pooler de transacciones en puerto 6543)
  const poolDb = new pg.Pool({ connectionString: databaseUrl });
  const adapterDb = new PrismaPg(poolDb);
  const prismaDb = new PrismaClient({ adapter: adapterDb });

  try {
    const resultDb = await prismaDb.$queryRaw`SELECT 1 as connected;`;
    if (resultDb) {
      console.log('DATABASE_URL connection: OK');
    }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('DATABASE_URL connection: FAILED');
    console.error('Error Code:', err.code || 'UNKNOWN');
    console.error('Sanitized Message:', err.message ? err.message.split('\n')[0] : 'Error de conexión');
  } finally {
    await prismaDb.$disconnect();
    await poolDb.end();
  }

  // 2. Prueba de DIRECT_URL (Pooler de sesión en puerto 5432)
  if (directUrl && !directUrl.includes('[YOUR-PASSWORD]')) {
    console.log('DIRECT_URL loaded successfully');
    const poolDirect = new pg.Pool({ connectionString: directUrl });
    const adapterDirect = new PrismaPg(poolDirect);
    const prismaDirect = new PrismaClient({ adapter: adapterDirect });

    try {
      const resultDirect = await prismaDirect.$queryRaw`SELECT 1 as connected;`;
      if (resultDirect) {
        console.log('DIRECT_URL connection: OK');
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('DIRECT_URL connection: FAILED');
      console.error('Error Code:', err.code || 'UNKNOWN');
      console.error('Sanitized Message:', err.message ? err.message.split('\n')[0] : 'Error de conexión');
    } finally {
      await prismaDirect.$disconnect();
      await poolDirect.end();
    }
  }
}

testConnection();

import app from './app';
import { env } from './config/env';
import { disconnectPrisma } from './lib/prisma';
import { Server } from 'http';

const port = env.port;

const server: Server = app.listen(port, () => {
  console.log(`====================================================`);
  console.log(`  PotroLearn Backend API corriendo en puerto ${port}`);
  console.log(`  Entorno: ${env.nodeEnv}`);
  console.log(`====================================================`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`\n[${signal}] Recibida señal de apagado. Cerrando servidor HTTP...`);

  server.close(async () => {
    console.log('[HTTP] Servidor HTTP cerrado correctamente.');

    try {
      console.log('[PRISMA] Desconectando Prisma Client y Pool de PostgreSQL...');
      await disconnectPrisma();
      console.log('[PRISMA] Desconexión completada con éxito.');
      process.exit(0);
    } catch (error) {
      console.error('[PRISMA] Error durante la desconexión:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[FORCE] Apagado forzado por tiempo de espera excedido (10s).');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

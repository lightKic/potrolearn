import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function inspectAuthDb() {
  console.log('--- Inspección Física de Metadatos Auth V1 en Supabase ---');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]')) {
    console.error('DATABASE_URL inválida');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Historial de Migraciones en _prisma_migrations
    const migrations = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`
      SELECT migration_name, finished_at, rolled_back_at 
      FROM "_prisma_migrations" 
      ORDER BY finished_at ASC;
    `;
    console.log('\n1. Historial en _prisma_migrations:');
    migrations.forEach((m) => {
      console.log(`- ${m.migration_name} | finished_at: ${m.finished_at} | rolled_back: ${m.rolled_back_at}`);
    });

    // 2. Columnas Auth en public.users
    const userColumns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>
    >`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('passwordHash', 'mustChangePassword', 'activatedAt', 'lastLoginAt');
    `;
    console.log('\n2. Columnas Auth en public.users:');
    userColumns.forEach((c) => {
      console.log(`- ${c.column_name}: ${c.data_type} | Nullable: ${c.is_nullable} | Default: ${c.column_default}`);
    });

    // 3. Estructura de public.auth_tokens
    const authTokenColumns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>
    >`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'auth_tokens'
      ORDER BY ordinal_position;
    `;
    console.log('\n3. Columnas de public.auth_tokens:');
    authTokenColumns.forEach((c) => {
      console.log(`- ${c.column_name}: ${c.data_type} | Nullable: ${c.is_nullable} | Default: ${c.column_default}`);
    });

    // 4. Valores del Enum TokenType
    const tokenTypeValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'TokenType'
      ORDER BY e.enumsortorder;
    `;
    console.log('\n4. Valores del Enum TokenType:');
    tokenTypeValues.forEach((e) => console.log(`- ${e.enumlabel}`));

    // 5. Restricciones e Índices en auth_tokens
    const constraints = await prisma.$queryRaw<
      Array<{ conname: string; contype: string; definition: string }>
    >`
      SELECT conname, contype::text as contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'auth_tokens'::regclass;
    `;
    console.log('\n5. Restricciones (PK, FK) en auth_tokens:');
    constraints.forEach((c) => console.log(`- ${c.conname} (${c.contype}): ${c.definition}`));

    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'auth_tokens';
    `;
    console.log('\n6. Índices en auth_tokens:');
    indexes.forEach((i) => console.log(`- ${i.indexname}: ${i.indexdef}`));

    // 7. Conteo de Tablas y Enums
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log(`\n7. Total tablas físicas en public: ${tables.length}`);
    tables.forEach((t) => console.log(`- ${t.table_name}`));

    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type WHERE typtype = 'e';
    `;
    console.log(`\n8. Total Enums en PostgreSQL: ${enums.length}`);
    enums.forEach((e) => console.log(`- ${e.typname}`));

    // 9. Conteo de Registros de Negocio
    const userCount = await prisma.user.count();
    const tokenCount = await prisma.authToken.count();
    console.log(`\n9. Registros de negocio: users=${userCount}, auth_tokens=${tokenCount}`);
  } catch (err: unknown) {
    console.error('Error durante la inspección:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

inspectAuthDb();

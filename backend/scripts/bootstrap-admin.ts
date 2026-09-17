import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PasswordService } from '../src/services/password.service';
import { env } from '../src/config/env';

async function bootstrapAdmin() {
  console.log('--- Iniciando Bootstrap ADMIN (PotroLearn) ---');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Administrador Inicial';

  if (!adminEmail || adminEmail.trim() === '') {
    console.error('ERROR: ADMIN_EMAIL no está configurada en las variables de entorno');
    process.exit(1);
  }

  if (!adminPassword) {
    console.error('ERROR: ADMIN_INITIAL_PASSWORD no está configurada en las variables de entorno');
    process.exit(1);
  }

  const normalizedEmail = adminEmail.trim().toLowerCase();

  const passwordValidation = PasswordService.validatePassword(adminPassword);
  if (!passwordValidation.valid) {
    console.error(`ERROR: Contraseña de administración inválida: ${passwordValidation.error}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: env.databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const existingAdminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });

    if (existingAdminCount > 0) {
      console.log('Bootstrap ADMIN: Ya existe al menos un usuario Administrador en el sistema. Se omite la creación.');
      return;
    }

    const passwordHash = await PasswordService.hashPassword(adminPassword);

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: adminName.trim(),
        role: Role.ADMIN,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });

    console.log(`Bootstrap ADMIN: Usuario Administrador (${normalizedEmail}) creado exitosamente.`);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('ERROR durante el bootstrap del Administrador:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

bootstrapAdmin();

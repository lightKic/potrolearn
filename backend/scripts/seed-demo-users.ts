import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PasswordService } from '../src/services/password.service';
import { env } from '../src/config/env';

async function seedDemoUsers() {
  console.log('--- Creando / Actualizando Usuarios Demo (ADMIN, TEACHER, STUDENT) ---');

  const pool = new pg.Pool({ connectionString: env.databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. ADMIN
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@potrolearn.edu.mx').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'AdminPassword123!';
    const adminName = process.env.ADMIN_NAME || 'Administrador PotroLearn';
    const adminHash = await PasswordService.hashPassword(adminPassword);

    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        role: Role.ADMIN,
        passwordHash: adminHash,
        isActive: true,
        mustChangePassword: false,
        activatedAt: new Date(),
      },
      create: {
        email: adminEmail,
        name: adminName,
        role: Role.ADMIN,
        passwordHash: adminHash,
        isActive: true,
        mustChangePassword: false,
        activatedAt: new Date(),
      },
    });
    console.log(`✅ [ADMIN]  ${adminUser.name} (${adminUser.email}) listo para iniciar sesión.`);

    // 2. TEACHER
    const teacherEmail = (process.env.TEACHER_EMAIL || 'maestro@potrolearn.edu.mx').trim().toLowerCase();
    const teacherPassword = process.env.TEACHER_PASSWORD || 'TeacherPassword123!';
    const teacherName = process.env.TEACHER_NAME || 'Profesor PotroLearn';
    const teacherHash = await PasswordService.hashPassword(teacherPassword);

    const teacherUser = await prisma.user.upsert({
      where: { email: teacherEmail },
      update: {
        name: teacherName,
        role: Role.TEACHER,
        passwordHash: teacherHash,
        isActive: true,
        mustChangePassword: false,
        activatedAt: new Date(),
      },
      create: {
        email: teacherEmail,
        name: teacherName,
        role: Role.TEACHER,
        passwordHash: teacherHash,
        isActive: true,
        mustChangePassword: false,
        activatedAt: new Date(),
      },
    });
    console.log(`✅ [TEACHER] ${teacherUser.name} (${teacherUser.email}) listo para iniciar sesión.`);

    // 3. STUDENT
    const studentEmail = (process.env.STUDENT_EMAIL || 'alumno@potrolearn.edu.mx').trim().toLowerCase();
    const studentPassword = process.env.STUDENT_PASSWORD || 'StudentPassword123!';
    const studentName = process.env.STUDENT_NAME || 'Alumno PotroLearn';
    const studentNumber = process.env.STUDENT_NUMBER || '20260001';
    const studentHash = await PasswordService.hashPassword(studentPassword);

    const studentUser = await prisma.user.upsert({
      where: { email: studentEmail },
      update: {
        name: studentName,
        role: Role.STUDENT,
        passwordHash: studentHash,
        isActive: true,
        mustChangePassword: false,
        activatedAt: new Date(),
      },
      create: {
        email: studentEmail,
        name: studentName,
        role: Role.STUDENT,
        passwordHash: studentHash,
        isActive: true,
        mustChangePassword: false,
        activatedAt: new Date(),
      },
    });

    // Ensure StudentProfile exists
    await prisma.studentProfile.upsert({
      where: { userId: studentUser.id },
      update: {
        studentNumber: studentNumber,
      },
      create: {
        userId: studentUser.id,
        studentNumber: studentNumber,
      },
    });

    console.log(`✅ [STUDENT] ${studentUser.name} (${studentUser.email}) [Matrícula: ${studentNumber}] listo para iniciar sesión.`);

    console.log('\n🎉 Todos los usuarios fueron creados/actualizados exitosamente en PostgreSQL.');
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ ERROR al sembrar usuarios demo:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedDemoUsers();

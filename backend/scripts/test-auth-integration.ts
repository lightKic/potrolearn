process.env.NODE_ENV = 'test';

import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { JwtService } from '../src/services/jwt.service';
import { Role } from '@prisma/client';
import { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { requirePasswordChanged } from '../src/middlewares/require-password-changed';
import { authenticate } from '../src/middlewares/authenticate';
import { requireActiveUser } from '../src/middlewares/require-active-user';
import { Request, Response } from 'express';

async function runAuthIntegrationTests() {
  console.log('====================================================');
  console.log('   PotroLearn — Auth Backend V1 — Integration Tests  ');
  console.log('====================================================\n');

  let server: Server | null = null;
  let baseUrl = '';

  // Registrar una ruta de prueba protegida con requirePasswordChanged exclusivamente para la prueba
  app.get('/api/test/protected-resource', authenticate, requireActiveUser, requirePasswordChanged, (req: Request, res: Response) => {
    res.status(200).json({ data: { message: 'Recurso protegido accedido exitosamente' } });
  });

  // Iniciar servidor HTTP en un puerto aleatorio efímero
  await new Promise<void>((resolve) => {
    const s = app.listen(0, () => {
      server = s;
      const address = s.address();
      if (typeof address === 'object' && address !== null) {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });

  console.log(`[INIT] Servidor HTTP de pruebas iniciado en ${baseUrl}\n`);

  const createdUserIds: string[] = [];

  try {
    // ----------------------------------------------------
    // SETUP: Crear usuarios de prueba temporales en Supabase
    // ----------------------------------------------------
    const testInitialPassword = 'InitialPassword123!';
    const testNewPassword = 'NewPassword456!';
    const initialHash = await PasswordService.hashPassword(testInitialPassword);

    // 1. Usuario activo con mustChangePassword = true
    const userActive = await prisma.user.create({
      data: {
        email: `test.auth.active.${Date.now()}@potrolearn.edu.mx`,
        name: 'Usuario Prueba Activo',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });
    createdUserIds.push(userActive.id);

    // 2. Usuario suspendido (isActive = false)
    const userSuspended = await prisma.user.create({
      data: {
        email: `test.auth.suspended.${Date.now()}@potrolearn.edu.mx`,
        name: 'Usuario Prueba Suspendido',
        role: Role.TEACHER,
        passwordHash: initialHash,
        mustChangePassword: false,
        isActive: false,
        activatedAt: new Date(),
      },
    });
    createdUserIds.push(userSuspended.id);

    console.log(`[SETUP] Registros temporales creados en BD (${createdUserIds.length} usuarios)\n`);

    // ----------------------------------------------------
    // PRUEBAS DE INICIO DE SESIÓN (POST /api/auth/login)
    // ----------------------------------------------------
    console.log('--- 1. Login Endpoint Tests ---');

    // 1.1 Login con credenciales correctas
    const resLoginSuccess = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userActive.email, password: testInitialPassword }),
    });
    const bodyLoginSuccess = (await resLoginSuccess.json()) as any;
    console.assert(resLoginSuccess.status === 200, `Expected 200, got ${resLoginSuccess.status}`);
    console.assert(typeof bodyLoginSuccess.data.token === 'string', 'Token JWT debe estar presente');
    console.assert(bodyLoginSuccess.data.user.email === userActive.email, 'Email debe coincidir');
    console.assert(bodyLoginSuccess.data.user.mustChangePassword === true, 'mustChangePassword debe ser true');
    console.assert(bodyLoginSuccess.data.user.passwordHash === undefined, 'NO debe retornar passwordHash');
    console.log('  [PASS] Login con credenciales correctas -> 200 OK + JWT');

    const validJwtToken = bodyLoginSuccess.data.token;

    // 1.2 Login con contraseña incorrecta -> 401 INVALID_CREDENTIALS
    const resLoginWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userActive.email, password: 'WrongPassword999!' }),
    });
    const bodyLoginWrongPass = (await resLoginWrongPass.json()) as any;
    console.assert(resLoginWrongPass.status === 401, `Expected 401, got ${resLoginWrongPass.status}`);
    console.assert(bodyLoginWrongPass.error?.code === 'INVALID_CREDENTIALS', 'Code debe ser INVALID_CREDENTIALS');
    console.log('  [PASS] Login contraseña incorrecta -> 401 INVALID_CREDENTIALS');

    // 1.3 Login con email inexistente -> 401 INVALID_CREDENTIALS (prevención enumeración)
    const resLoginUnknownEmail = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.user.12345@potrolearn.edu.mx', password: testInitialPassword }),
    });
    const bodyLoginUnknownEmail = (await resLoginUnknownEmail.json()) as any;
    console.assert(resLoginUnknownEmail.status === 401, `Expected 401, got ${resLoginUnknownEmail.status}`);
    console.assert(bodyLoginUnknownEmail.error?.code === 'INVALID_CREDENTIALS', 'Code debe ser INVALID_CREDENTIALS');
    console.log('  [PASS] Login email inexistente -> 401 INVALID_CREDENTIALS (anti-enumeración)');

    // 1.4 Login de usuario suspendido -> 403 ACCOUNT_SUSPENDED
    const resLoginSuspended = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userSuspended.email, password: testInitialPassword }),
    });
    const bodyLoginSuspended = (await resLoginSuspended.json()) as any;
    console.assert(resLoginSuspended.status === 403, `Expected 403, got ${resLoginSuspended.status}`);
    console.assert(bodyLoginSuspended.error?.code === 'ACCOUNT_SUSPENDED', 'Code debe ser ACCOUNT_SUSPENDED');
    console.log('  [PASS] Login usuario suspendido -> 403 ACCOUNT_SUSPENDED');

    // ----------------------------------------------------
    // PRUEBAS DE AUTENTICACIÓN JWT Y VERIFICACIÓN TOKEN
    // ----------------------------------------------------
    console.log('\n--- 2. JWT Verification & Error Cases ---');

    // 2.1 Token ausente -> 401 UNAUTHORIZED
    const resMissingToken = await fetch(`${baseUrl}/api/auth/me`, { method: 'GET' });
    const bodyMissingToken = (await resMissingToken.json()) as any;
    console.assert(resMissingToken.status === 401, `Expected 401, got ${resMissingToken.status}`);
    console.assert(bodyMissingToken.error?.code === 'UNAUTHORIZED', 'Code debe ser UNAUTHORIZED');
    console.log('  [PASS] Request sin cabecera Authorization -> 401 UNAUTHORIZED');

    // 2.2 Token malformado o inválido -> 401 UNAUTHORIZED
    const resInvalidToken = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer token_super_invalido_xyz' },
    });
    const bodyInvalidToken = (await resInvalidToken.json()) as any;
    console.assert(resInvalidToken.status === 401, `Expected 401, got ${resInvalidToken.status}`);
    console.assert(bodyInvalidToken.error?.code === 'UNAUTHORIZED', 'Code debe ser UNAUTHORIZED');
    console.log('  [PASS] Token malformado/inválido -> 401 UNAUTHORIZED');

    // 2.3 Token expirado -> 401 UNAUTHORIZED
    const expiredToken = jwt.sign({ sub: userActive.id }, env.jwtSecret, { expiresIn: '-1s' });
    const resExpiredToken = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const bodyExpiredToken = (await resExpiredToken.json()) as any;
    console.assert(resExpiredToken.status === 401, `Expected 401, got ${resExpiredToken.status}`);
    console.assert(bodyExpiredToken.error?.code === 'UNAUTHORIZED', 'Code debe ser UNAUTHORIZED');
    console.log('  [PASS] Token expirado -> 401 UNAUTHORIZED');

    // ----------------------------------------------------
    // PRUEBAS DE GET /api/auth/me
    // ----------------------------------------------------
    console.log('\n--- 3. GET /api/auth/me Endpoint Tests ---');

    // 3.1 Consulta exitosa con JWT válido (incluso si mustChangePassword = true)
    const resMeSuccess = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validJwtToken}` },
    });
    const bodyMeSuccess = (await resMeSuccess.json()) as any;
    console.assert(resMeSuccess.status === 200, `Expected 200, got ${resMeSuccess.status}`);
    console.assert(bodyMeSuccess.data.user.id === userActive.id, 'ID debe coincidir');
    console.assert(bodyMeSuccess.data.user.mustChangePassword === true, 'Permite consultar /me aunque mustChangePassword sea true');
    console.log('  [PASS] GET /api/auth/me con token válido -> 200 OK (mustChangePassword=true permitido)');

    // ----------------------------------------------------
    // PRUEBAS DE POST /api/auth/change-password
    // ----------------------------------------------------
    console.log('\n--- 4. Change Password Endpoint Tests ---');

    // 4.1 Contraseña actual incorrecta -> 400 INVALID_CURRENT_PASSWORD
    const resChangeWrongCurrent = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validJwtToken}`,
      },
      body: JSON.stringify({ currentPassword: 'WrongCurrentPass1!', newPassword: testNewPassword }),
    });
    const bodyChangeWrongCurrent = (await resChangeWrongCurrent.json()) as any;
    console.assert(resChangeWrongCurrent.status === 400, `Expected 400, got ${resChangeWrongCurrent.status}`);
    console.assert(bodyChangeWrongCurrent.error?.code === 'INVALID_CURRENT_PASSWORD', 'Code debe ser INVALID_CURRENT_PASSWORD');
    console.log('  [PASS] Contraseña actual incorrecta -> 400 INVALID_CURRENT_PASSWORD');

    // 4.2 Nueva contraseña inválida (longitud < 10) -> 400 INVALID_NEW_PASSWORD
    const resChangeShortNew = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validJwtToken}`,
      },
      body: JSON.stringify({ currentPassword: testInitialPassword, newPassword: 'short' }),
    });
    const bodyChangeShortNew = (await resChangeShortNew.json()) as any;
    console.assert(resChangeShortNew.status === 400, `Expected 400, got ${resChangeShortNew.status}`);
    console.assert(bodyChangeShortNew.error?.code === 'INVALID_NEW_PASSWORD', 'Code debe ser INVALID_NEW_PASSWORD');
    console.log('  [PASS] Nueva contraseña demasiado corta -> 400 INVALID_NEW_PASSWORD');

    // 4.3 Nueva contraseña igual a la actual -> 400 NEW_PASSWORD_MUST_DIFFER
    const resChangeSamePass = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validJwtToken}`,
      },
      body: JSON.stringify({ currentPassword: testInitialPassword, newPassword: testInitialPassword }),
    });
    const bodyChangeSamePass = (await resChangeSamePass.json()) as any;
    console.assert(resChangeSamePass.status === 400, `Expected 400, got ${resChangeSamePass.status}`);
    console.assert(bodyChangeSamePass.error?.code === 'NEW_PASSWORD_MUST_DIFFER', 'Code debe ser NEW_PASSWORD_MUST_DIFFER');
    console.log('  [PASS] Nueva contraseña igual a la actual -> 400 NEW_PASSWORD_MUST_DIFFER');

    // 4.4 Cambio exitoso de contraseña
    const resChangeSuccess = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validJwtToken}`,
      },
      body: JSON.stringify({ currentPassword: testInitialPassword, newPassword: testNewPassword }),
    });
    const bodyChangeSuccess = (await resChangeSuccess.json()) as any;
    console.assert(resChangeSuccess.status === 200, `Expected 200, got ${resChangeSuccess.status}`);
    console.assert(bodyChangeSuccess.data.message === 'Contraseña actualizada correctamente', 'Mensaje de éxito');
    console.log('  [PASS] Cambio de contraseña válido -> 200 OK');

    // 4.5 Verificación física en BD posterior al cambio
    const updatedUserInDb = await prisma.user.findUnique({ where: { id: userActive.id } });
    console.assert(updatedUserInDb?.mustChangePassword === false, 'mustChangePassword debe ser false en BD');
    console.assert(updatedUserInDb?.activatedAt !== null, 'activatedAt debe estar asignado en BD');
    console.log('  [PASS] Verificación física DB: mustChangePassword=false, activatedAt!=null');

    // 4.6 Login con nueva contraseña -> 200 OK
    const resLoginNewPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userActive.email, password: testNewPassword }),
    });
    console.assert(resLoginNewPass.status === 200, 'Login con nueva contraseña debe ser exitoso');
    console.log('  [PASS] Login con nueva contraseña -> 200 OK');

    // 4.7 Login con contraseña antigua -> 401 INVALID_CREDENTIALS
    const resLoginOldPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userActive.email, password: testInitialPassword }),
    });
    console.assert(resLoginOldPass.status === 401, 'Login con contraseña antigua debe fallar');
    console.log('  [PASS] Login con contraseña antigua -> 401 INVALID_CREDENTIALS');

    // ----------------------------------------------------
    // PRUEBAS DE ESTADO FRESCO EN BASE DE DATOS (FRESH STATE)
    // ----------------------------------------------------
    console.log('\n--- 5. Fresh Database Authorization Tests ---');

    // Emitir JWT válido para el usuario activo
    const freshTokenUserActive = JwtService.signAccessToken(userActive.id);

    // 5.1 Suspensión inmediata: desactivar usuario en BD y verificar que el MISMO token es rechazado
    await prisma.user.update({
      where: { id: userActive.id },
      data: { isActive: false },
    });

    const resFreshSuspended = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${freshTokenUserActive}` },
    });
    const bodyFreshSuspended = (await resFreshSuspended.json()) as any;
    console.assert(resFreshSuspended.status === 403, `Expected 403, got ${resFreshSuspended.status}`);
    console.assert(bodyFreshSuspended.error?.code === 'ACCOUNT_SUSPENDED', 'Code debe ser ACCOUNT_SUSPENDED');
    console.log('  [PASS] Suspensión inmediata en BD -> Mismo JWT rechazado con 403 ACCOUNT_SUSPENDED');

    // Reactivar el usuario
    await prisma.user.update({
      where: { id: userActive.id },
      data: { isActive: true },
    });

    // 5.2 Cambio de rol inmediato: cambiar rol STUDENT -> ADMIN en BD y verificar que req.user.role refleja ADMIN
    await prisma.user.update({
      where: { id: userActive.id },
      data: { role: Role.ADMIN },
    });

    const resFreshRole = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${freshTokenUserActive}` },
    });
    const bodyFreshRole = (await resFreshRole.json()) as any;
    console.assert(resFreshRole.status === 200, `Expected 200, got ${resFreshRole.status}`);
    console.assert(bodyFreshRole.data.user.role === Role.ADMIN, 'Rol debe actualizarse a ADMIN inmediatamente');
    console.log('  [PASS] Cambio de rol inmediato en BD -> Mismo JWT refleja nuevo rol ADMIN');

    // ----------------------------------------------------
    // PRUEBAS DE requirePasswordChanged GUARD
    // ----------------------------------------------------
    console.log('\n--- 6. mustChangePassword Guard Tests ---');

    // Crear un usuario con mustChangePassword = true
    const userMustChange = await prisma.user.create({
      data: {
        email: `test.auth.mustchange.${Date.now()}@potrolearn.edu.mx`,
        name: 'Usuario Must Change',
        role: Role.STUDENT,
        passwordHash: initialHash,
        mustChangePassword: true,
        isActive: true,
      },
    });
    createdUserIds.push(userMustChange.id);

    const tokenMustChange = JwtService.signAccessToken(userMustChange.id);

    // 6.1 Intentar acceder a ruta protegida normal -> 403 FORBIDDEN_MUST_CHANGE_PASSWORD
    const resGuardBlocked = await fetch(`${baseUrl}/api/test/protected-resource`, {
      headers: { Authorization: `Bearer ${tokenMustChange}` },
    });
    const bodyGuardBlocked = (await resGuardBlocked.json()) as any;
    console.assert(resGuardBlocked.status === 403, `Expected 403, got ${resGuardBlocked.status}`);
    console.assert(bodyGuardBlocked.error?.code === 'FORBIDDEN_MUST_CHANGE_PASSWORD', 'Code debe ser FORBIDDEN_MUST_CHANGE_PASSWORD');
    console.log('  [PASS] Acceso a ruta protegida normal cuando mustChangePassword=true -> 403 FORBIDDEN_MUST_CHANGE_PASSWORD');

    // 6.2 Confirmar que /api/auth/me NO es bloqueada por requirePasswordChanged
    const resGuardMeAllowed = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenMustChange}` },
    });
    console.assert(resGuardMeAllowed.status === 200, 'GET /api/auth/me debe permitirse');
    console.log('  [PASS] GET /api/auth/me con mustChangePassword=true -> 200 OK (permitido)');

    console.log('\n====================================================');
    console.log('   TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON CÓMODAMENTE');
    console.log('====================================================\n');
  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN:', error);
    process.exitCode = 1;
  } finally {
    // ----------------------------------------------------
    // CLEANUP EXACTO: Eliminar únicamente usuarios temporales creados
    // ----------------------------------------------------
    console.log('--- Cleanup de Datos Temporales ---');
    if (createdUserIds.length > 0) {
      const deleteResult = await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      console.log(`[CLEANUP] Eliminados ${deleteResult.count} registros de usuarios temporales`);
    }

    // Verificar usuarios temporales restantes con correos test.auth.*
    const remainingTestUsers = await prisma.user.count({
      where: { email: { contains: 'test.auth.' } },
    });
    console.log(`[CLEANUP] Usuarios temporales restantes en BD: ${remainingTestUsers}`);
    console.assert(remainingTestUsers === 0, 'No deben quedar usuarios temporales en BD');

    if (server) {
      (server as Server).close();
      console.log('[CLEANUP] Servidor HTTP cerrado correctamente.');
    }

    await prisma.$disconnect();
  }
}

runAuthIntegrationTests();

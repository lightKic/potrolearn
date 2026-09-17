process.env.NODE_ENV = 'test';

import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { AuthTokenService } from '../src/services/auth-token.service';
import { JwtService } from '../src/services/jwt.service';
import { Role, TokenType } from '@prisma/client';
import { Server } from 'node:http';
import { Request, Response } from 'express';

async function runActivationIntegrationTests() {
  console.log('================================================================');
  console.log('   PotroLearn — Auth Backend V1 — Fase 3A Integration Tests     ');
  console.log('================================================================\n');

  let server: Server | null = null;
  let baseUrl = '';

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
  const createdAuthTokenIds: string[] = [];

  let concurrentSuccesses = 0;
  let concurrentRejections = 0;

  try {
    // ----------------------------------------------------
    // 1. PRUEBAS UNITARIAS DE AuthTokenService
    // ----------------------------------------------------
    console.log('--- 1. AuthTokenService Unit Tests ---');
    const rawToken1 = AuthTokenService.generateRawToken();
    const rawToken2 = AuthTokenService.generateRawToken();

    console.assert(typeof rawToken1 === 'string' && rawToken1.length === 64, 'Raw token debe ser string hex de 64 caracteres');
    console.assert(rawToken1 !== rawToken2, 'Raw tokens deben ser aleatorios y no deterministas');

    const hash1a = AuthTokenService.hashToken(rawToken1);
    const hash1b = AuthTokenService.hashToken(rawToken1);
    const hash2 = AuthTokenService.hashToken(rawToken2);

    console.assert(hash1a === hash1b, 'Hash SHA-256 debe ser estable para la misma entrada');
    console.assert(hash1a !== hash2, 'Hashes SHA-256 deben ser diferentes para entradas diferentes');
    console.assert(rawToken1 !== hash1a, 'Raw token NO debe ser igual a su hash SHA-256');
    console.log('  [PASS] Generación CSPRNG, alta entropía y hashing SHA-256 verificado');

    // ----------------------------------------------------
    // SETUP DE DATOS EN BD DE PRUEBA
    // ----------------------------------------------------
    console.log('\n--- 2. Setup de Usuarios y Tokens de Prueba ---');
    const tempPassword = 'TempPassword123!';
    const newPassword = 'NewSecretPassword456!';
    const tempHash = await PasswordService.hashPassword(tempPassword);

    // Usuario 1: Pendiente de activación
    const userPending = await prisma.user.create({
      data: {
        email: `test.activation.pending.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Pendiente',
        role: Role.STUDENT,
        passwordHash: tempHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });
    createdUserIds.push(userPending.id);

    // Token 1: Válido para activación
    const tokenValid = await AuthTokenService.createToken({
      userId: userPending.id,
      type: TokenType.ACCOUNT_ACTIVATION,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(tokenValid.authToken.id);

    // Token 2: Expirado (-10 minutos)
    const tokenExpiredRaw = AuthTokenService.generateRawToken();
    const tokenExpiredHash = AuthTokenService.hashToken(tokenExpiredRaw);
    const tokenExpired = await prisma.authToken.create({
      data: {
        userId: userPending.id,
        type: TokenType.ACCOUNT_ACTIVATION,
        tokenHash: tokenExpiredHash,
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });
    createdAuthTokenIds.push(tokenExpired.id);

    // Token 3: Ya usado
    const tokenUsedRaw = AuthTokenService.generateRawToken();
    const tokenUsedHash = AuthTokenService.hashToken(tokenUsedRaw);
    const tokenUsed = await prisma.authToken.create({
      data: {
        userId: userPending.id,
        type: TokenType.ACCOUNT_ACTIVATION,
        tokenHash: tokenUsedHash,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        usedAt: new Date(),
      },
    });
    createdAuthTokenIds.push(tokenUsed.id);

    // Token 4: Revocado
    const tokenRevokedRaw = AuthTokenService.generateRawToken();
    const tokenRevokedHash = AuthTokenService.hashToken(tokenRevokedRaw);
    const tokenRevoked = await prisma.authToken.create({
      data: {
        userId: userPending.id,
        type: TokenType.ACCOUNT_ACTIVATION,
        tokenHash: tokenRevokedHash,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        revokedAt: new Date(),
      },
    });
    createdAuthTokenIds.push(tokenRevoked.id);

    // Token 5: Tipo PASSWORD_RESET
    const tokenResetRaw = AuthTokenService.generateRawToken();
    const tokenResetHash = AuthTokenService.hashToken(tokenResetRaw);
    const tokenReset = await prisma.authToken.create({
      data: {
        userId: userPending.id,
        type: TokenType.PASSWORD_RESET,
        tokenHash: tokenResetHash,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });
    createdAuthTokenIds.push(tokenReset.id);

    console.log(`[SETUP] Creado 1 usuario pendiente y 5 tokens de prueba (${createdAuthTokenIds.length} tokens registrados)`);

    // ----------------------------------------------------
    // 3. PRUEBAS DE POST /api/auth/validate-activation-token
    // ----------------------------------------------------
    console.log('\n--- 3. POST /api/auth/validate-activation-token Endpoint Tests ---');

    // 3.1 Token válido -> 200 OK valid=true
    const resValValid = await fetch(`${baseUrl}/api/auth/validate-activation-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenValid.rawToken }),
    });
    const bodyValValid = (await resValValid.json()) as any;
    console.assert(resValValid.status === 200, `Expected 200, got ${resValValid.status}`);
    console.assert(bodyValValid.data.valid === true, 'Token válido debe retornar valid=true');
    console.assert(bodyValValid.data.email === undefined, 'NO debe exponer email del usuario');
    console.assert(bodyValValid.data.tokenHash === undefined, 'NO debe exponer tokenHash');
    console.log('  [PASS] Token activo válido -> 200 OK { valid: true } sin datos sensibles');

    // 3.2 Token aleatorio inexistente -> 400 Bad Request
    const resValRandom = await fetch(`${baseUrl}/api/auth/validate-activation-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'random_nonexistent_token_1234567890' }),
    });
    const bodyValRandom = (await resValRandom.json()) as any;
    console.assert(resValRandom.status === 400, `Expected 400, got ${resValRandom.status}`);
    console.assert(bodyValRandom.error?.code === 'INVALID_OR_EXPIRED_TOKEN', 'Code debe ser INVALID_OR_EXPIRED_TOKEN');
    console.log('  [PASS] Token inexistente -> 400 INVALID_OR_EXPIRED_TOKEN');

    // 3.3 Token expirado -> 400 Bad Request
    const resValExpired = await fetch(`${baseUrl}/api/auth/validate-activation-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenExpiredRaw }),
    });
    console.assert(resValExpired.status === 400, 'Token expirado debe ser rechazado');
    console.log('  [PASS] Token expirado -> 400 INVALID_OR_EXPIRED_TOKEN');

    // 3.4 Token usado -> 400 Bad Request
    const resValUsed = await fetch(`${baseUrl}/api/auth/validate-activation-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenUsedRaw }),
    });
    console.assert(resValUsed.status === 400, 'Token usado debe ser rechazado');
    console.log('  [PASS] Token ya consumido -> 400 INVALID_OR_EXPIRED_TOKEN');

    // 3.5 Token revocado -> 400 Bad Request
    const resValRevoked = await fetch(`${baseUrl}/api/auth/validate-activation-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenRevokedRaw }),
    });
    console.assert(resValRevoked.status === 400, 'Token revocado debe ser rechazado');
    console.log('  [PASS] Token revocado -> 400 INVALID_OR_EXPIRED_TOKEN');

    // 3.6 Token de tipo PASSWORD_RESET -> 400 Bad Request
    const resValReset = await fetch(`${baseUrl}/api/auth/validate-activation-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenResetRaw }),
    });
    console.assert(resValReset.status === 400, 'Token PASSWORD_RESET no debe ser válido para activación');
    console.log('  [PASS] Token PASSWORD_RESET no permitido en activación -> 400 INVALID_OR_EXPIRED_TOKEN');

    // ----------------------------------------------------
    // 4. PRUEBAS NEGATIVAS DE POST /api/auth/activate
    // ----------------------------------------------------
    console.log('\n--- 4. POST /api/auth/activate Negative Tests ---');

    // 4.1 Email incorrecto
    const resActWrongEmail = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenValid.rawToken,
        email: 'email.incorrecto@potrolearn.edu.mx',
        temporaryPassword: tempPassword,
        newPassword: newPassword,
      }),
    });
    const bodyActWrongEmail = (await resActWrongEmail.json()) as any;
    console.assert(resActWrongEmail.status === 400, `Expected 400, got ${resActWrongEmail.status}`);
    console.assert(bodyActWrongEmail.error?.code === 'INVALID_OR_EXPIRED_TOKEN', 'Email incorrecto debe responder mensaje genérico');
    console.log('  [PASS] Email incorrecto -> 400 INVALID_OR_EXPIRED_TOKEN (anti-enumeración)');

    // 4.2 Contraseña temporal incorrecta
    const resActWrongTemp = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenValid.rawToken,
        email: userPending.email,
        temporaryPassword: 'WrongTempPassword999!',
        newPassword: newPassword,
      }),
    });
    console.assert(resActWrongTemp.status === 400, 'Contraseña temporal incorrecta debe rechazarse');
    console.log('  [PASS] Contraseña temporal incorrecta -> 400 INVALID_OR_EXPIRED_TOKEN');

    // 4.3 Nueva contraseña demasiado corta (<10 caracteres)
    const resActShortPass = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenValid.rawToken,
        email: userPending.email,
        temporaryPassword: tempPassword,
        newPassword: 'short',
      }),
    });
    const bodyActShortPass = (await resActShortPass.json()) as any;
    console.assert(resActShortPass.status === 400, `Expected 400, got ${resActShortPass.status}`);
    console.assert(bodyActShortPass.error?.code === 'INVALID_NEW_PASSWORD', 'Code debe ser INVALID_NEW_PASSWORD');
    console.log('  [PASS] Nueva contraseña demasiado corta -> 400 INVALID_NEW_PASSWORD');

    // 4.4 Nueva contraseña igual a la temporal
    const resActSamePass = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenValid.rawToken,
        email: userPending.email,
        temporaryPassword: tempPassword,
        newPassword: tempPassword,
      }),
    });
    const bodyActSamePass = (await resActSamePass.json()) as any;
    console.assert(resActSamePass.status === 400, `Expected 400, got ${resActSamePass.status}`);
    console.assert(bodyActSamePass.error?.code === 'NEW_PASSWORD_MUST_DIFFER', 'Code debe ser NEW_PASSWORD_MUST_DIFFER');
    console.log('  [PASS] Nueva contraseña igual a la temporal -> 400 NEW_PASSWORD_MUST_DIFFER');

    // ----------------------------------------------------
    // 5. PRUEBA DE ACTIVACIÓN EXITOSA (POST /api/auth/activate)
    // ----------------------------------------------------
    console.log('\n--- 5. POST /api/auth/activate Valid Activation Test ---');

    const resActivateSuccess = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenValid.rawToken,
        email: userPending.email,
        temporaryPassword: tempPassword,
        newPassword: newPassword,
      }),
    });
    const bodyActivateSuccess = (await resActivateSuccess.json()) as any;
    console.assert(resActivateSuccess.status === 200, `Expected 200, got ${resActivateSuccess.status}`);
    console.assert(bodyActivateSuccess.data.message === 'Cuenta activada correctamente', 'Mensaje de éxito');
    console.assert(typeof bodyActivateSuccess.data.token === 'string', 'JWT de acceso debe emitirse tras la activación');
    console.assert(bodyActivateSuccess.data.user.mustChangePassword === false, 'mustChangePassword debe ser false en la respuesta');
    console.assert(bodyActivateSuccess.data.user.activatedAt !== null, 'activatedAt debe estar asignado');
    console.log('  [PASS] Activación exitosa -> 200 OK + JWT + DTO actualizado');

    // 5.1 Verificación física en la Base de Datos
    const dbUserAfter = await prisma.user.findUnique({ where: { id: userPending.id } });
    const dbTokenAfter = await prisma.authToken.findUnique({ where: { id: tokenValid.authToken.id } });

    console.assert(dbUserAfter?.mustChangePassword === false, 'mustChangePassword debe ser false en BD');
    console.assert(dbUserAfter?.activatedAt !== null, 'activatedAt debe tener timestamp en BD');
    console.assert(dbTokenAfter?.usedAt !== null, 'AuthToken.usedAt debe marcarse con timestamp en BD');
    console.log('  [PASS] Verificación física DB: mustChangePassword=false, activatedAt!=null, AuthToken.usedAt!=null');

    // 5.2 Login con la nueva contraseña -> 200 OK
    const resLoginNewPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userPending.email, password: newPassword }),
    });
    console.assert(resLoginNewPass.status === 200, 'Login con la nueva contraseña debe funcionar');
    console.log('  [PASS] Login con la nueva contraseña asignada -> 200 OK');

    // 5.3 Login con la contraseña temporal antigua -> 401 INVALID_CREDENTIALS
    const resLoginTempPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userPending.email, password: tempPassword }),
    });
    console.assert(resLoginTempPass.status === 401, 'Login con contraseña temporal antigua debe ser rechazado');
    console.log('  [PASS] Login con contraseña temporal antigua -> 401 INVALID_CREDENTIALS');

    // ----------------------------------------------------
    // 6. PRUEBA DE REUTILIZACIÓN (SINGLE-USE ENFORCEMENT)
    // ----------------------------------------------------
    console.log('\n--- 6. Single-use Enforcement Test ---');

    const resReactivate = await fetch(`${baseUrl}/api/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenValid.rawToken,
        email: userPending.email,
        temporaryPassword: tempPassword,
        newPassword: 'AnotherPassword789!',
      }),
    });
    console.assert(resReactivate.status === 400, 'Segundo intento de activación con el mismo token debe fallar');
    console.log('  [PASS] Reutilización del mismo token de activación -> 400 INVALID_OR_EXPIRED_TOKEN');

    // ----------------------------------------------------
    // 7. PRUEBA DE CONCURRENCIA OBLIGATORIA (SINGLE-USE ATÓMICO)
    // ----------------------------------------------------
    console.log('\n--- 7. Mandatory Concurrent Activation Test ---');

    // Crear un nuevo usuario temporal y un nuevo token exclusivo para la prueba concurrente
    const userConcurrent = await prisma.user.create({
      data: {
        email: `test.activation.concurrent.${Date.now()}@potrolearn.edu.mx`,
        name: 'Alumno Concurrente',
        role: Role.STUDENT,
        passwordHash: tempHash,
        mustChangePassword: true,
        isActive: true,
        activatedAt: null,
      },
    });
    createdUserIds.push(userConcurrent.id);

    const tokenConcurrent = await AuthTokenService.createToken({
      userId: userConcurrent.id,
      type: TokenType.ACCOUNT_ACTIVATION,
      ttlHours: 2,
    });
    createdAuthTokenIds.push(tokenConcurrent.authToken.id);

    const activatePayload = JSON.stringify({
      token: tokenConcurrent.rawToken,
      email: userConcurrent.email,
      temporaryPassword: tempPassword,
      newPassword: 'ConcurrentNewPass123!',
    });

    // Lanzar dos solicitudes de activación simultáneas con el MISMO token
    const [resConcurrent1, resConcurrent2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: activatePayload,
      }),
      fetch(`${baseUrl}/api/auth/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: activatePayload,
      }),
    ]);

    const statuses = [resConcurrent1.status, resConcurrent2.status];
    concurrentSuccesses = statuses.filter((s) => s === 200).length;
    concurrentRejections = statuses.filter((s) => s === 400).length;

    console.log(`  Resultado concurrencia: ${concurrentSuccesses} exitosos, ${concurrentRejections} rechazados`);
    console.assert(concurrentSuccesses === 1, `Exactamente 1 solicitud debe tener éxito (got ${concurrentSuccesses})`);
    console.assert(concurrentRejections === 1, `Exactamente 1 solicitud debe ser rechazada (got ${concurrentRejections})`);
    console.log('  [PASS] Transacción atómica en concurrencia: EXACTAMENTE 1 SUCCESS y 1 REJECTED');

    console.log('\n================================================================');
    console.log('   TODAS LAS PRUEBAS DE LA FASE 3A PASARON EXITOSAMENTE');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ ERROR EN PRUEBAS DE INTEGRACIÓN FASE 3A:', error);
    process.exitCode = 1;
  } finally {
    // ----------------------------------------------------
    // CLEANUP ROBUSTO Y EXACTO
    // ----------------------------------------------------
    console.log('--- Cleanup de Datos Temporales de Prueba ---');

    if (createdAuthTokenIds.length > 0) {
      const deleteTokens = await prisma.authToken.deleteMany({
        where: { id: { in: createdAuthTokenIds } },
      });
      console.log(`[CLEANUP] Eliminados ${deleteTokens.count} registros de AuthToken de prueba`);
    }

    if (createdUserIds.length > 0) {
      const deleteUsers = await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      console.log(`[CLEANUP] Eliminados ${deleteUsers.count} registros de User de prueba`);
    }

    const remainingUsers = await prisma.user.count({
      where: { email: { contains: 'test.activation.' } },
    });

    const remainingTokens = await prisma.authToken.count({
      where: { id: { in: createdAuthTokenIds } },
    });

    console.log(`[CLEANUP] Usuarios de prueba restantes en BD: ${remainingUsers}`);
    console.log(`[CLEANUP] AuthTokens de prueba restantes en BD: ${remainingTokens}`);

    console.assert(remainingUsers === 0, 'No deben quedar usuarios de prueba en la BD');
    console.assert(remainingTokens === 0, 'No deben quedar AuthTokens de prueba en la BD');

    if (server) {
      (server as Server).close();
      console.log('[CLEANUP] Servidor HTTP cerrado correctamente.');
    }

    await prisma.$disconnect();
  }
}

runActivationIntegrationTests();

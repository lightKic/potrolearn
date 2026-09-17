process.env.NODE_ENV = 'test';
process.env.PORT = '3006';

import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { Role } from '@prisma/client';
import app from '../src/app';

const API_URL = 'http://localhost:3006/api';

async function runSessionPersistenceTests() {
  console.log('===========================================================');
  console.log('  POTROLEARN — PRUEBAS DE PERSISTENCIA DE SESIÓN (BUGFIX F5)');
  console.log('===========================================================\n');

  const server = app.listen(3006);
  console.log('✓ Servidor HTTP iniciado en http://localhost:3006/api\n');

  // Limpieza inicial
  await prisma.refreshSession.deleteMany({ where: { user: { email: { startsWith: 'persistence_test_' } } } });
  await prisma.authToken.deleteMany({ where: { user: { email: { startsWith: 'persistence_test_' } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'persistence_test_' } } });

  const testPassword = 'TestPassword123!';
  const passwordHash = await PasswordService.hashPassword(testPassword);

  const testUser = await prisma.user.create({
    data: {
      email: 'persistence_test_admin@potrolearn.edu.mx',
      name: 'Persistence Admin Test',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
      activatedAt: new Date(),
    },
  });

  try {
    // -------------------------------------------------------------
    // CASO 1: Login exitoso -> Access Token + Refresh Cookie + DB
    // -------------------------------------------------------------
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testPassword,
      }),
    });

    if (loginRes.status !== 200) {
      throw new Error(`CASO 1 FALLÓ: Esperado 200 OK en login, recibido: ${loginRes.status}`);
    }

    const setCookie1 = loginRes.headers.get('set-cookie');
    if (!setCookie1 || !setCookie1.includes('potrolearn_refresh=')) {
      throw new Error('CASO 1 FALLÓ: Cookie HttpOnly potrolearn_refresh no emitida en login');
    }

    const loginJson = (await loginRes.json()) as any;
    if (!loginJson.data?.token || !loginJson.data?.user) {
      throw new Error('CASO 1 FALLÓ: Access token o datos de usuario ausentes en JSON de login');
    }

    const cookieMatch1 = setCookie1.match(/potrolearn_refresh=([^;]+)/);
    const rawCookie1 = cookieMatch1 ? cookieMatch1[1] : '';
    const cookieHeader1 = `potrolearn_refresh=${rawCookie1}`;

    const dbSessions1 = await prisma.refreshSession.count({ where: { userId: testUser.id, revokedAt: null } });
    if (dbSessions1 !== 1) {
      throw new Error(`CASO 1 FALLÓ: Se esperaba 1 RefreshSession activa en DB, encontradas: ${dbSessions1}`);
    }

    console.log('🟢 CASO 1 PASS: Login exitoso -> Access token obtenido, cookie potrolearn_refresh emitida y RefreshSession en DB.');

    // -------------------------------------------------------------
    // CASO 2: Refresh válido vía cookie -> HTTP 200 + Nuevo Token + Rotación
    // -------------------------------------------------------------
    const refreshRes1 = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: cookieHeader1 },
    });

    if (refreshRes1.status !== 200) {
      throw new Error(`CASO 2 FALLÓ: Esperado 200 OK en refresh, recibido: ${refreshRes1.status}`);
    }

    const refreshJson1 = (await refreshRes1.json()) as any;
    if (!refreshJson1.data?.token || !refreshJson1.data?.user) {
      throw new Error('CASO 2 FALLÓ: Respuesta de refresh inválida');
    }

    const setCookie2 = refreshRes1.headers.get('set-cookie');
    if (!setCookie2 || !setCookie2.includes('potrolearn_refresh=')) {
      throw new Error('CASO 2 FALLÓ: Nueva cookie de refresh no rotada');
    }

    const cookieMatch2 = setCookie2.match(/potrolearn_refresh=([^;]+)/);
    const rawCookie2 = cookieMatch2 ? cookieMatch2[1] : '';
    const cookieHeader2 = `potrolearn_refresh=${rawCookie2}`;

    console.log('🟢 CASO 2 PASS: Refresh válido con cookie -> HTTP 200 OK, nuevo access token y cookie rotada.');

    // -------------------------------------------------------------
    // CASO 3: Refresh sin cookie -> HTTP 401
    // -------------------------------------------------------------
    const noCookieRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
    });

    if (noCookieRes.status !== 401) {
      throw new Error(`CASO 3 FALLÓ: Esperado 401 Unauthorized sin cookie, recibido: ${noCookieRes.status}`);
    }

    console.log('🟢 CASO 3 PASS: Petición /refresh sin cookie retorna HTTP 401.');

    // -------------------------------------------------------------
    // CASO 4: Refresh con cookie inválida -> HTTP 401
    // -------------------------------------------------------------
    const invalidCookieRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: 'potrolearn_refresh=invalid_garbage_token_string' },
    });

    if (invalidCookieRes.status !== 401) {
      throw new Error(`CASO 4 FALLÓ: Esperado 401 con cookie inválida, recibido: ${invalidCookieRes.status}`);
    }

    console.log('🟢 CASO 4 PASS: Petición /refresh con cookie inválida retorna HTTP 401.');

    // -------------------------------------------------------------
    // CASO 5: Refresh con token expirado/revocado -> HTTP 401
    // -------------------------------------------------------------
    // Creamos una sesión artificialmente revocada en la BD
    await prisma.refreshSession.create({
      data: {
        userId: testUser.id,
        tokenHash: 'dummy_revoked_hash_12345',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
      },
    });

    const revokedRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: 'potrolearn_refresh=dummy_revoked_hash_12345' },
    });

    if (revokedRes.status !== 401) {
      throw new Error(`CASO 5 FALLÓ: Esperado 401 con token revocado, recibido: ${revokedRes.status}`);
    }

    console.log('🟢 CASO 5 PASS: Petición /refresh con token revocado/expirado retorna HTTP 401.');

    // -------------------------------------------------------------
    // CASO 6: Rotation check (token anterior no reutilizable)
    // -------------------------------------------------------------
    const reuseOldTokenRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: cookieHeader1 },
    });

    if (reuseOldTokenRes.status !== 401) {
      throw new Error(`CASO 6 FALLÓ: Token anterior reutilizado no retornó 401, recibido: ${reuseOldTokenRes.status}`);
    }

    // Probar que la cookie nueva (cookie2) SÍ sigue siendo válida
    const useNewTokenRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: cookieHeader2 },
    });

    if (useNewTokenRes.status !== 200) {
      throw new Error(`CASO 6 FALLÓ: Nueva cookie rotada debería ser válida, recibido: ${useNewTokenRes.status}`);
    }

    const setCookie3 = useNewTokenRes.headers.get('set-cookie');
    const cookieMatch3 = setCookie3?.match(/potrolearn_refresh=([^;]+)/);
    const rawCookie3 = cookieMatch3 ? cookieMatch3[1] : '';
    const cookieHeader3 = `potrolearn_refresh=${rawCookie3}`;

    console.log('🟢 CASO 6 PASS: Token anterior no reutilizable (401), token nuevo válido.');

    // -------------------------------------------------------------
    // CASO 7: Logout -> Sesión revocada, refresh posterior da 401
    // -------------------------------------------------------------
    const logoutRes = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader3 },
    });

    if (logoutRes.status !== 200) {
      throw new Error(`CASO 7 FALLÓ: Esperado 200 en logout, recibido: ${logoutRes.status}`);
    }

    const postLogoutRefreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: cookieHeader3 },
    });

    if (postLogoutRefreshRes.status !== 401) {
      throw new Error(`CASO 7 FALLÓ: Refresh tras logout no retornó 401, recibido: ${postLogoutRefreshRes.status}`);
    }

    console.log('🟢 CASO 7 PASS: Logout revoca la sesión en BD y subsiguiente refresh retorna HTTP 401.');

    // -------------------------------------------------------------
    // CASO 8: Cambio de contraseña revoca sesiones anteriores
    // -------------------------------------------------------------
    // Nuevo login para obtener cookie4
    const loginForChangePassRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testPassword,
      }),
    });

    const setCookie4 = loginForChangePassRes.headers.get('set-cookie');
    const loginForChangePassJson = (await loginForChangePassRes.json()) as any;
    const activeToken = loginForChangePassJson.data?.token;
    const rawCookie4 = setCookie4?.match(/potrolearn_refresh=([^;]+)/)?.[1] || '';
    const cookieHeader4 = `potrolearn_refresh=${rawCookie4}`;

    // Cambiar contraseña
    const newTestPassword = 'NewTestPassword123!';
    const changePassRes = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: newTestPassword,
      }),
    });

    if (changePassRes.status !== 200) {
      throw new Error(`CASO 8 FALLÓ: Cambio de contraseña falló, recibido: ${changePassRes.status}`);
    }

    // Intentar refresco con la cookie4 anterior al cambio de contraseña
    const refreshWithOldPasswordCookie = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: cookieHeader4 },
    });

    if (refreshWithOldPasswordCookie.status !== 401) {
      throw new Error(`CASO 8 FALLÓ: Refresh con cookie previa al cambio de contraseña debería dar 401, recibido: ${refreshWithOldPasswordCookie.status}`);
    }

    console.log('🟢 CASO 8 PASS: Cambio de contraseña revoca las sesiones de refresh anteriores.');

    console.log('\n===========================================================');
    console.log('  ¡TODOS LOS 8 CASOS DE PERSISTENCIA DE SESIÓN PASARON! 🟢 ');
    console.log('===========================================================\n');
  } finally {
    // Cleanup
    await prisma.refreshSession.deleteMany({ where: { userId: testUser.id } });
    await prisma.authToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    server.close();
  }
}

runSessionPersistenceTests().catch((err) => {
  console.error('❌ ERROR EN PRUEBAS DE PERSISTENCIA DE SESIÓN:', err);
  process.exit(1);
});

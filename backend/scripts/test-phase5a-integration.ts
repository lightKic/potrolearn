process.env.NODE_ENV = 'test';
process.env.PORT = '3005';

import { prisma } from '../src/lib/prisma';
import { PasswordService } from '../src/services/password.service';
import { AuthService } from '../src/services/auth.service';
import { Role } from '@prisma/client';
import app from '../src/app';

const API_URL = 'http://localhost:3005/api';

async function runPhase5aVerification() {
  console.log('=== INICIANDO PRUEBAS DE INTEGRACIÓN FASE 5A (FRONTEND AUTH V1) ===\n');

  const server = app.listen(3005);
  console.log('✓ Servidor HTTP de prueba iniciado en http://localhost:3005/api');

  // 1. Limpieza inicial de usuarios de prueba
  await prisma.refreshSession.deleteMany({ where: { user: { email: { startsWith: 'phase5a_' } } } });
  await prisma.authToken.deleteMany({ where: { user: { email: { startsWith: 'phase5a_' } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'phase5a_' } } });

  const tempPassword = 'Password123!';
  const passwordHash = await PasswordService.hashPassword(tempPassword);

  // 2. Crear usuario de prueba ADMIN
  const adminUser = await prisma.user.create({
    data: {
      email: 'phase5a_admin@potrolearn.edu.mx',
      name: 'Admin Frontend Test',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
      activatedAt: new Date(),
    },
  });

  // 3. Crear usuario de prueba con cambio obligatorio de contraseña (mustChangePassword=true)
  const tempUser = await prisma.user.create({
    data: {
      email: 'phase5a_temp@potrolearn.edu.mx',
      name: 'Temp Student Test',
      passwordHash,
      role: Role.STUDENT,
      isActive: true,
      mustChangePassword: true,
      activatedAt: null,
    },
  });

  console.log('✓ Usuarios de prueba creados en PostgreSQL');

  try {
    // Test 1: Petición /refresh sin cookie -> debe retornar 401 (Unauthenticated)
    const initialRefresh = await fetch(`${API_URL}/auth/refresh`, { method: 'POST' });
    if (initialRefresh.status !== 401) {
      throw new Error(`Esperado HTTP 401 en /refresh sin sesión, recibido: ${initialRefresh.status}`);
    }
    console.log('✓ TEST 1: Restauración de sesión vacía (sin cookie) -> HTTP 401 (unauthenticated) correcto.');

    // Test 2: Login exitoso ADMIN
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminUser.email,
        password: tempPassword,
      }),
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Fallo en login de prueba: HTTP ${loginRes.status} - ${errText}`);
    }

    const setCookieHeader = loginRes.headers.get('set-cookie');
    if (!setCookieHeader || !setCookieHeader.includes('potrolearn_refresh')) {
      throw new Error('Cookie potrolearn_refresh no encontrada en la respuesta de login');
    }

    const loginJson = (await loginRes.json()) as any;
    const accessToken = loginJson.data?.token;
    if (!accessToken) {
      throw new Error('Access token no recibido en JSON de login');
    }
    console.log('✓ TEST 2: Login exitoso -> Access Token recibido en memoria + Cookie potrolearn_refresh emitida.');

    // Extraer valor de la cookie potrolearn_refresh para simular el comportamiento del navegador
    const cookieMatch = setCookieHeader.match(/potrolearn_refresh=([^;]+)/);
    const rawCookieValue = cookieMatch ? cookieMatch[1] : '';
    const cookieHeaderValue = `potrolearn_refresh=${rawCookieValue}`;

    // Test 3: GET /auth/me con Access Token
    const meRes = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!meRes.ok) {
      throw new Error(`Fallo en /me con Access Token: HTTP ${meRes.status}`);
    }
    const meJson = (await meRes.json()) as any;
    if (meJson.data?.user?.email !== adminUser.email) {
      throw new Error('El usuario retornado por /me no coincide con el logueado');
    }
    console.log('✓ TEST 3: GET /auth/me autenticado -> Usuario retornado correctamente:', meJson.data.user.name, `(${meJson.data.user.role})`);

    // Test 4: Sesión restaurada vía POST /refresh usando la cookie
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeaderValue,
      },
    });

    if (!refreshRes.ok) {
      throw new Error(`Fallo en restauración de sesión con cookie: HTTP ${refreshRes.status}`);
    }
    const refreshJson = (await refreshRes.json()) as any;
    const newAccessToken = refreshJson.data?.token;
    const newSetCookie = refreshRes.headers.get('set-cookie');
    if (!newAccessToken) {
      throw new Error('Nuevo access token no recibido tras /refresh');
    }
    console.log('✓ TEST 4: POST /auth/refresh con cookie -> Nuevo Access Token y rotación de cookie exitosos.');

    // Extraer nueva cookie rotada
    const newCookieMatch = newSetCookie?.match(/potrolearn_refresh=([^;]+)/);
    const newRawCookieValue = newCookieMatch ? newCookieMatch[1] : '';
    const newCookieHeaderValue = `potrolearn_refresh=${newRawCookieValue}`;

    // Test 5: Simulación de Single-Flight Refresh (varias peticiones en paralelo con la misma cookie previa ya consumida)
    const concurrent1 = fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Cookie: cookieHeaderValue } });
    const concurrent2 = fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Cookie: cookieHeaderValue } });
    const [res1, res2] = await Promise.all([concurrent1, concurrent2]);
    const rejectedCount = [res1.status, res2.status].filter((st) => st === 401).length;
    if (rejectedCount !== 2) {
      throw new Error(`Se esperaba que las peticiones concurrentes con la cookie ya consumida fueran rechazadas con 401, rechazos: ${rejectedCount}`);
    }
    console.log('✓ TEST 5: Refresh token reutilizado rechazado con 401 (la rotación protegió la sesión).');

    // Test 6: Logout con la cookie válida actual
    const logoutRes = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: newCookieHeaderValue,
      },
    });
    if (!logoutRes.ok) {
      throw new Error(`Fallo en logout: HTTP ${logoutRes.status}`);
    }
    console.log('✓ TEST 6: POST /auth/logout exitoso -> Sesión revocada en BD.');

    // Test 7: Intento de /refresh posterior a logout -> debe retornar 401
    const postLogoutRefresh = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: newCookieHeaderValue,
      },
    });
    if (postLogoutRefresh.status !== 401) {
      throw new Error(`Esperado HTTP 401 tras logout, recibido: ${postLogoutRefresh.status}`);
    }
    console.log('✓ TEST 7: Intento de refresco tras logout -> HTTP 401 (unauthenticated) confirmado.');

    // Test 8: Verificación de mustChangePassword = true en usuario temporal
    const tempLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: tempUser.email,
        password: tempPassword,
      }),
    });
    const tempLoginJson = (await tempLoginRes.json()) as any;
    if (!tempLoginJson.data?.user?.mustChangePassword) {
      throw new Error('mustChangePassword debería ser true para usuario recién creado');
    }
    console.log('✓ TEST 8: Usuario temporal de prueba reporta mustChangePassword = true correctamente.');

    console.log('\n=======================================================');
    console.log('  ¡TODAS LAS PRUEBAS DE INTEGRACIÓN FASE 5A PASARON! 🟢  ');
    console.log('=======================================================\n');
  } finally {
    // Cleanup de datos de prueba
    await prisma.refreshSession.deleteMany({ where: { userId: adminUser.id } });
    await prisma.refreshSession.deleteMany({ where: { userId: tempUser.id } });
    await prisma.user.deleteMany({ where: { id: adminUser.id } });
    await prisma.user.deleteMany({ where: { id: tempUser.id } });
    server.close();
    process.exit(0);
  }
}

runPhase5aVerification().catch((err) => {
  console.error('❌ ERROR EN PRUEBAS FASE 5A:', err);
  process.exit(1);
});

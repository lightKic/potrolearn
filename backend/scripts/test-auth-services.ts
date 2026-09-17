import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PasswordService } from '../src/services/password.service';
import { JwtService } from '../src/services/jwt.service';
import { env } from '../src/config/env';

async function testAuthServices() {
  console.log('--- Pruebas Unitarias de PasswordService y JwtService (Auth Backend V1) ---');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failedCount++;
    }
  }

  try {
    // ==========================================
    // 1. Pruebas de PasswordService
    // ==========================================
    console.log('\n--- Testing PasswordService ---');

    const plaintext = 'SuperSecret10!';
    const hash = await PasswordService.hashPassword(plaintext);

    assert(hash !== plaintext, 'hashPassword genera hash diferente al texto plano');
    assert(hash.startsWith('$2'), 'hashPassword genera hash en formato bcrypt ($2a/$2b)');

    const isMatch = await PasswordService.verifyPassword(plaintext, hash);
    assert(isMatch === true, 'verifyPassword retorna true para la contraseña correcta');

    const isWrongMatch = await PasswordService.verifyPassword('WrongPassword123', hash);
    assert(isWrongMatch === false, 'verifyPassword retorna false para contraseña incorrecta');

    // Validación de longitud y reglas
    assert(PasswordService.validatePassword('123456789').valid === false, '9 caracteres -> inválido (< 10)');
    assert(PasswordService.validatePassword('1234567890').valid === true, '10 caracteres -> válido (>= 10)');

    const max128 = 'a'.repeat(128);
    assert(PasswordService.validatePassword(max128).valid === true, '128 caracteres -> válido (<= 128)');

    const max129 = 'a'.repeat(129);
    assert(PasswordService.validatePassword(max129).valid === false, '129 caracteres -> inválido (> 128)');

    assert(PasswordService.validatePassword('          ').valid === false, 'Solo espacios -> inválido');

    // Contraseña temporal
    const tempPass1 = PasswordService.generateTemporaryPassword();
    const tempPass2 = PasswordService.generateTemporaryPassword();

    assert(tempPass1.length >= 12, 'generateTemporaryPassword genera contraseña >= 12 caracteres');
    assert(tempPass1 !== tempPass2, 'generateTemporaryPassword es no determinista (diferentes llamadas)');

    // ==========================================
    // 2. Pruebas de JwtService
    // ==========================================
    console.log('\n--- Testing JwtService ---');

    const testUserId = 'usr_uuid_test_123456';
    const token = JwtService.signAccessToken(testUserId);

    assert(typeof token === 'string' && token.split('.').length === 3, 'signAccessToken genera un JWT válido de 3 partes');

    const verified = JwtService.verifyAccessToken(token);
    assert(verified.sub === testUserId, 'verifyAccessToken retorna el sub (userId) correcto');

    // Token alterado
    let tamperedFailed = false;
    try {
      JwtService.verifyAccessToken(token + 'tampered');
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message.includes('inválido') || e.message.includes('malformado')) {
        tamperedFailed = true;
      }
    }
    assert(tamperedFailed === true, 'verifyAccessToken rechaza token alterado / firma inválida');

    // Token expirado
    let expiredFailed = false;
    const expiredToken = jwt.sign({ sub: testUserId }, env.jwtSecret, { expiresIn: -1 });
    try {
      JwtService.verifyAccessToken(expiredToken);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message.includes('expirado')) {
        expiredFailed = true;
      }
    }
    assert(expiredFailed === true, 'verifyAccessToken rechaza token expirado');

    // Token sin sub
    let missingSubFailed = false;
    const noSubToken = jwt.sign({ role: 'ADMIN' }, env.jwtSecret, { expiresIn: '1h' });
    try {
      JwtService.verifyAccessToken(noSubToken);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message.includes('Payload JWT inválido') || e.message.includes('sub')) {
        missingSubFailed = true;
      }
    }
    assert(missingSubFailed === true, 'verifyAccessToken rechaza token sin claim sub');

    console.log(`\n--- RESUMEN DE PRUEBAS ---`);
    console.log(`Passed: ${passedCount} | Failed: ${failedCount}`);

    if (failedCount > 0) {
      console.error('\nFAILURE: Una o más pruebas unitarias fallaron.');
      process.exit(1);
    } else {
      console.log('\nSUCCESS: Todas las pruebas unitarias de PasswordService y JwtService pasaron correctamente.');
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('ERROR inesperado durante las pruebas:', err.message);
    process.exit(1);
  }
}

testAuthServices();

import 'dotenv/config';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env';
import { gmailEmailService } from '../src/services/email/gmail-email.service';

async function runRealEmailSmokeTest() {
  console.log('====================================================');
  console.log('   PotroLearn — Diagnostic Real Email Smoke Test    ');
  console.log('====================================================\n');

  const emailUserConfigured = Boolean(env.emailUser && env.emailUser.trim().length > 0);
  const emailPassConfigured = Boolean(env.emailAppPassword && env.emailAppPassword.trim().length > 0);
  const emailFromConfigured = Boolean(env.emailFrom && env.emailFrom.trim().length > 0);
  const frontendUrlConfigured = Boolean(env.frontendUrl && env.frontendUrl.trim().length > 0);

  console.log('--- 1. Configuration Status ---');
  console.log(`  EMAIL_USER configured        : ${emailUserConfigured ? 'YES' : 'NO'}`);
  console.log(`  EMAIL_APP_PASSWORD configured: ${emailPassConfigured ? 'YES' : 'NO'}`);
  console.log(`  EMAIL_FROM configured        : ${emailFromConfigured ? 'YES' : 'NO'}`);
  console.log(`  FRONTEND_URL configured      : ${frontendUrlConfigured ? 'YES' : 'NO'}\n`);

  if (!emailUserConfigured || !emailPassConfigured) {
    console.log('SMTP authentication → FAIL (EMAIL_USER o EMAIL_APP_PASSWORD no están configurados en backend/.env)');
    console.log('Provider accepted test message → SKIPPED');
    console.log('Mailbox delivery → PENDING USER CONFIGURATION\n');
    return;
  }

  console.log('--- 2. SMTP Connection Diagnostics ---');
  const isSmtpAuthenticated = await gmailEmailService.verifyConnection();

  if (isSmtpAuthenticated) {
    console.log('  SMTP authentication → PASS\n');
  } else {
    console.log('  SMTP authentication → FAIL\n');
    console.log('Provider accepted test message → FAIL');
    console.log('Mailbox delivery → PENDING USER CONFIGURATION\n');
    return;
  }

  const testRecipient = process.env.EMAIL_TEST_RECIPIENT;

  if (!testRecipient || testRecipient.trim().length === 0) {
    console.log('--- 3. Smoke Test Delivery ---');
    console.log('  Provider accepted test message → SKIPPED (EMAIL_TEST_RECIPIENT no configurado en backend/.env)');
    console.log('  Mailbox delivery → PENDING USER CONFIGURATION\n');
    return;
  }

  console.log(`--- 3. Smoke Test Delivery (Destinatario: ${testRecipient.trim()}) ---`);

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.emailUser,
        pass: env.emailAppPassword,
      },
    });

    await transporter.sendMail({
      from: env.emailFrom,
      to: testRecipient.trim(),
      subject: 'PotroLearn SMTP Test',
      text: 'PotroLearn SMTP Test\n\nLa configuración de correo de PotroLearn funciona correctamente.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background-color: #ffffff;">
          <h3 style="color: #004691; margin-top: 0;">PotroLearn SMTP Test</h3>
          <p>La configuración de correo electrónico de PotroLearn funciona correctamente.</p>
          <p style="font-size: 12px; color: #6c757d;">Este es un mensaje automático de diagnóstico de infraestructura.</p>
        </div>
      `,
    });

    console.log('  Provider accepted test message → PASS');
    console.log('  Mailbox delivery → PENDING USER CONFIRMATION\n');
  } catch (error) {
    console.log('  Provider accepted test message → FAIL');
    console.error('  [SMTP ERROR]', error instanceof Error ? error.message : error);
    console.log('  Mailbox delivery → FAIL\n');
  }
}

runRealEmailSmokeTest();

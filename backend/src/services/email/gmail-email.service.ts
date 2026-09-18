import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { IEmailService, AccountInvitationEmailInput, PasswordResetEmailInput, CourseEnrollmentEmailInput } from './email.service.interface';

/**
 * Helper para escapar HTML dinámico e impedir inyección en clientes de correo.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class GmailEmailService implements IEmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') {
      return null;
    }
    if (this.transporter) return this.transporter;

    if (!env.emailUser || !env.emailAppPassword) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.emailUser,
        pass: env.emailAppPassword,
      },
    });

    return this.transporter;
  }

  /**
   * Verifica la conectividad SMTP con los servidores de Gmail.
   */
  public async verifyConnection(): Promise<boolean> {
    if (env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') {
      return true;
    }
    const transporter = this.getTransporter();

    if (!transporter) {
      console.error('[SMTP CONFIG ERROR] Conexión SMTP fallida: EMAIL_USER o EMAIL_APP_PASSWORD no están configurados en backend/.env');
      return false;
    }

    try {
      await transporter.verify();
      return true;
    } catch (error) {
      console.error('[SMTP VERIFY ERROR] Fallo al verificar autenticación SMTP con Gmail:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Envía el correo electrónico de invitación inicial o reenvío de invitación.
   */
  public async sendAccountInvitation(input: AccountInvitationEmailInput): Promise<boolean> {
    const { recipientEmail, recipientName, courseName, rawToken, temporaryPassword } = input;
    const transporter = this.getTransporter();

    if (!transporter) {
      if (env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') {
        console.log(`[SMTP MOCK] Correo de invitación simulado enviado a ${recipientEmail}`);
        return true;
      }
      console.error(`[SMTP CONFIG ERROR] No se envió el correo a ${recipientEmail}: Faltan EMAIL_USER o EMAIL_APP_PASSWORD en .env`);
      return false;
    }

    const activationUrl = `${env.frontendUrl}/activate?token=${encodeURIComponent(rawToken)}`;
    const safeName = escapeHtml(recipientName);
    const safeCourse = courseName ? escapeHtml(courseName) : undefined;
    const safeEmail = escapeHtml(recipientEmail);
    const safeTempPass = escapeHtml(temporaryPassword);

    const textContent = `PotroLearn — Invitación de Acceso

Hola ${recipientName},

Se ha creado o actualizado tu acceso a la plataforma PotroLearn${courseName ? ` para el curso "${courseName}"` : ''}.

Instrucciones de activación:
1. Ingresa al siguiente enlace de activación:
   ${activationUrl}

2. Utiliza las siguientes credenciales temporales:
   Usuario / Email: ${recipientEmail}
   Contraseña Temporal: ${temporaryPassword}

Este enlace expira en 2 horas por motivos de seguridad.

Si no solicitaste este acceso, por favor ignora este mensaje.
`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #004691; margin-top: 0;">PotroLearn — Invitación de Acceso</h2>
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Se ha creado o actualizado tu acceso a la plataforma académica <strong>PotroLearn</strong>${safeCourse ? ` para el curso <strong>${safeCourse}</strong>` : ''}.</p>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #004691; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0;"><strong>Usuario:</strong> ${safeEmail}</p>
          <p style="margin: 0;"><strong>Contraseña temporal:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${safeTempPass}</code></p>
        </div>

        <p style="margin-bottom: 24px;">Por favor haz clic en el siguiente botón para definir tu contraseña definitiva y activar tu cuenta:</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${activationUrl}" style="background-color: #004691; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activar Cuenta</a>
        </div>

        <p style="font-size: 12px; color: #6c757d; margin-top: 24px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
          El enlace expira en 2 horas. Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
          <a href="${activationUrl}" style="color: #004691;">${activationUrl}</a>
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: env.emailFrom,
        to: recipientEmail,
        subject: `PotroLearn — Invitación de Acceso`,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[SMTP GMAIL] Correo de invitación enviado exitosamente a ${recipientEmail}`);
      return true;
    } catch (error) {
      console.error(`[SMTP ERROR] Fallo al enviar correo de invitación a ${recipientEmail}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Envía el correo electrónico de restablecimiento de acceso.
   */
  public async sendPasswordReset(input: PasswordResetEmailInput): Promise<boolean> {
    const { recipientEmail, recipientName, rawToken, temporaryPassword } = input;
    const transporter = this.getTransporter();

    if (!transporter) {
      if (env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') {
        console.log(`[SMTP MOCK] Correo de restablecimiento simulado enviado a ${recipientEmail}`);
        return true;
      }
      console.error(`[SMTP CONFIG ERROR] No se envió el correo a ${recipientEmail}: Faltan EMAIL_USER o EMAIL_APP_PASSWORD en .env`);
      return false;
    }

    const resetUrl = `${env.frontendUrl}/reset-access?token=${encodeURIComponent(rawToken)}`;
    const safeName = escapeHtml(recipientName);
    const safeEmail = escapeHtml(recipientEmail);
    const safeTempPass = escapeHtml(temporaryPassword);

    const textContent = `PotroLearn — Restablecimiento de Acceso

Hola ${recipientName},

Se ha solicitado el restablecimiento de acceso a tu cuenta de PotroLearn.

Instrucciones:
1. Ingresa al siguiente enlace de restablecimiento:
   ${resetUrl}

2. Utiliza las siguientes credenciales temporales:
   Usuario / Email: ${recipientEmail}
   Contraseña Temporal: ${temporaryPassword}

Este enlace expira en 2 horas por motivos de seguridad.

Si no solicitaste este cambio, ponte en contacto de inmediato con la administración.
`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #d9534f; margin-top: 0;">PotroLearn — Restablecimiento de Acceso</h2>
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Un administrador o profesor ha iniciado el restablecimiento de acceso para tu cuenta en <strong>PotroLearn</strong>.</p>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #d9534f; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0;"><strong>Usuario:</strong> ${safeEmail}</p>
          <p style="margin: 0;"><strong>Contraseña temporal:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${safeTempPass}</code></p>
        </div>

        <p style="margin-bottom: 24px;">Por favor haz clic en el siguiente botón para asignar una nueva contraseña segura:</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #d9534f; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
        </div>

        <p style="font-size: 12px; color: #6c757d; margin-top: 24px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
          El enlace expira en 2 horas. Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
          <a href="${resetUrl}" style="color: #d9534f;">${resetUrl}</a>
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: env.emailFrom,
        to: recipientEmail,
        subject: `PotroLearn — Restablecimiento de Acceso`,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[SMTP GMAIL] Correo de restablecimiento enviado exitosamente a ${recipientEmail}`);
      return true;
    } catch (error) {
      console.error(`[SMTP ERROR] Fallo al enviar correo de restablecimiento a ${recipientEmail}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Envía el correo electrónico informativo a un alumno existente al ser agregado a un curso.
   */
  public async sendCourseEnrollmentNotification(input: CourseEnrollmentEmailInput): Promise<boolean> {
    const { recipientEmail, recipientName, courseName } = input;
    const transporter = this.getTransporter();

    if (!transporter) {
      if (env.nodeEnv === 'test' || process.env.NODE_ENV === 'test') {
        console.log(`[SMTP MOCK] Correo de inclusión a curso simulado enviado a ${recipientEmail}`);
        return true;
      }
      console.error(`[SMTP CONFIG ERROR] No se envió el correo a ${recipientEmail}: Faltan EMAIL_USER o EMAIL_APP_PASSWORD en .env`);
      return false;
    }

    const loginUrl = `${env.frontendUrl}`;
    const safeName = escapeHtml(recipientName);
    const safeCourse = escapeHtml(courseName);

    const textContent = `PotroLearn — Inclusión a Curso

Hola ${recipientName},

Has sido agregado al curso:

${courseName}

Ya puedes ingresar a PotroLearn con tu cuenta existente.

Enlace de acceso: ${loginUrl}

Si ya tienes una sesión iniciada, podrás acceder al curso desde tu panel de cursos.
`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #004691; margin-top: 0;">PotroLearn — Inclusión a Curso</h2>
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Has sido agregado exitosamente al curso <strong>${safeCourse}</strong> en la plataforma <strong>PotroLearn</strong>.</p>
        
        <p>Ya puedes ingresar a PotroLearn utilizando las credenciales de tu cuenta existente.</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="background-color: #004691; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ingresar a PotroLearn</a>
        </div>

        <p style="font-size: 13px; color: #6c757d; margin-top: 24px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
          Si ya tienes una sesión iniciada en tu navegador, podrás acceder al curso directamente desde tu panel de cursos.
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: env.emailFrom,
        to: recipientEmail,
        subject: `Has sido agregado a un curso en PotroLearn`,
        text: textContent,
        html: htmlContent,
      });
      console.log(`[SMTP GMAIL] Correo de inclusión a curso enviado exitosamente a ${recipientEmail}`);
      return true;
    } catch (error) {
      console.error(`[SMTP ERROR] Falló el envío del correo de inclusión a curso a ${recipientEmail}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }
}

export const gmailEmailService = new GmailEmailService();

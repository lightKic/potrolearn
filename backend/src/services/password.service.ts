import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export class PasswordService {
  private static readonly BCRYPT_SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 10;
  private static readonly MAX_PASSWORD_BYTES = 72;
  private static readonly MIN_TEMP_PASSWORD_LENGTH = 12;

  /**
   * Genera el hash bcrypt seguro de una contraseña con cost factor 12.
   */
  public static async hashPassword(password: string): Promise<string> {
    const validation = this.validatePassword(password);
    if (!validation.valid) {
      throw new Error(`Contraseña inválida: ${validation.error}`);
    }
    return bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS);
  }

  /**
   * Compara una contraseña en texto plano contra un hash bcrypt existente.
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
  }

  /**
   * Valida las reglas de la política de contraseñas de PotroLearn V1:
   * - Mínimo 10 caracteres.
   * - Máximo 72 bytes UTF-8 (límite efectivo de bcrypt).
   * - Rechaza contraseñas compuestas exclusivamente por espacios en blanco.
   * - No modifica ni hace .trim() sobre la contraseña.
   */
  public static validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'La contraseña es requerida' };
    }

    if (password.trim().length === 0) {
      return { valid: false, error: 'La contraseña no puede consistir exclusivamente en espacios en blanco' };
    }

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      return {
        valid: false,
        error: `La contraseña debe tener al menos ${this.MIN_PASSWORD_LENGTH} caracteres`,
      };
    }

    const byteLength = Buffer.byteLength(password, 'utf8');
    if (byteLength > this.MAX_PASSWORD_BYTES) {
      return {
        valid: false,
        error: `La contraseña no puede exceder ${this.MAX_PASSWORD_BYTES} bytes UTF-8`,
      };
    }

    return { valid: true };
  }

  /**
   * Genera una contraseña temporal aleatoria de alta entropía utilizando un CSPRNG nativo (node:crypto).
   * La contraseña generada cumple siempre la política de longitud mínima de 12 caracteres.
   */
  public static generateTemporaryPassword(length = 12): string {
    const targetLength = Math.max(length, this.MIN_TEMP_PASSWORD_LENGTH);
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    
    const randomBytes = crypto.randomBytes(targetLength);
    let result = '';

    for (let i = 0; i < targetLength; i++) {
      const randomIndex = randomBytes[i] % charset.length;
      result += charset[randomIndex];
    }

    return result;
  }
}

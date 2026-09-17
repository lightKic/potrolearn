import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export class JwtService {
  /**
   * Emite un Access Token JWT firmado con el payload mínimo { sub: userId } y expiración configurable (default 2h).
   */
  public static signAccessToken(userId: string): string {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('userId inválido para la emisión del token JWT');
    }

    const payload: TokenPayload = { sub: userId };

    const signOptions: SignOptions = {
      algorithm: 'HS256',
      expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    };

    return jwt.sign(payload, env.jwtSecret, signOptions);
  }

  /**
   * Verifica la firma y vencimiento de un Access Token JWT.
   * Devuelve el objeto { sub: userId } si el token es válido.
   * Lanza excepciones controladas si el token está vencido, malformado o es inválido.
   */
  public static verifyAccessToken(token: string): { sub: string } {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new Error('Token JWT no proporcionado');
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;

      if (!decoded || typeof decoded !== 'object' || !decoded.sub || typeof decoded.sub !== 'string') {
        throw new Error('Payload JWT inválido: falta la propiedad sub');
      }

      return { sub: decoded.sub };
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token JWT expirado');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Token JWT inválido o malformado');
      }
      throw error;
    }
  }
}

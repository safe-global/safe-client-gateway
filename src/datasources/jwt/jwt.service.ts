import { JwtClient } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/domain/interfaces/jwt-api.interface';
import { Inject, Injectable } from '@nestjs/common';

/**
 * A {@link IJwtService} implementation using the `jsonwebtoken` library
 */
@Injectable()
export class JwtService implements IJwtService {
  static readonly JWT_HEADER_TYPE = 'Bearer';

  constructor(
    @Inject('JwtClient')
    private readonly client: JwtClient,
  ) {}

  sign<T extends string | object>(
    payload: T,
    options?: { expiresIn?: number; notBefore?: number },
  ): string {
    return this.client.sign(payload, options);
  }

  verify<T extends string | object>(token: string): T {
    return this.client.verify<T>(token);
  }
}

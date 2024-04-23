import { JwtClient } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JwtService implements IJwtService {
  constructor(
    @Inject('JwtClient')
    private readonly client: JwtClient,
  ) {}

  sign<T extends object>(
    payload: T,
    options: { issuedAt?: number; expiresIn?: number; notBefore?: number } = {},
  ): string {
    return this.client.sign(payload, options);
  }

  verify<T extends object>(token: string): T {
    return this.client.verify(token);
  }

  decode<T extends object>(token: string): JwtPayloadWithClaims<T> {
    return this.client.decode(token);
  }
}

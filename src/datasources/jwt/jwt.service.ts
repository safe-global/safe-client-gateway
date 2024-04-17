import { IConfigurationService } from '@/config/configuration.service.interface';
import { JwtClient } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class JwtService implements IJwtService {
  private readonly issuer: string;
  private readonly secret: string;

  constructor(
    @Inject('JwtClient')
    private readonly client: JwtClient,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.issuer = this.configurationService.getOrThrow<string>('jwt.issuer');
    this.secret = this.configurationService.getOrThrow<string>('jwt.secret');
  }

  sign<T extends object>(
    payload: T,
    options: { expiresIn?: number; notBefore?: number } = {},
  ): string {
    return this.client.sign(payload, this.secret, {
      ...options,
      issuer: this.issuer,
    });
  }

  verify<T extends object>(token: string): T {
    return this.client.verify(token, this.secret, {
      issuer: this.issuer,
      // Return only payload without claims, e.g. no exp, nbf, etc.
      complete: false,
    }) as T;
  }

  decode<T extends object>(token: string): JwtPayloadWithClaims<T> {
    // Client has decode method but it does not verify signature so we use verify
    const { payload } = this.client.verify(token, this.secret, {
      issuer: this.issuer,
      // Return headers, payload (with claims) and signature
      complete: true,
    });

    return payload as JwtPayloadWithClaims<T>;
  }
}

import { IConfigurationService } from '@/config/configuration.service.interface';
import { JwtClient } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
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

  sign<T extends string | object>(
    payload: T,
    options: { expiresIn?: number; notBefore?: number } = {},
  ): string {
    return this.client.sign(payload, this.secret, {
      ...options,
      issuer: this.issuer,
    });
  }

  verify<T extends string | object>(token: string): T {
    return this.client.verify(token, this.secret, {
      issuer: this.issuer,
      // Return the content of the payload
      complete: false,
    }) as T;
  }
}

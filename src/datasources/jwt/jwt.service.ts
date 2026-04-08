// SPDX-License-Identifier: FSL-1.1-MIT
import type { JwtClient } from '@/datasources/jwt/jwt.module';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { Algorithm, JwtPayload } from 'jsonwebtoken';
import { JWT_ALGORITHM } from '@/datasources/jwt/jwt.constants';

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

  sign<
    T extends object & {
      iat?: Date;
      exp?: Date;
      nbf?: Date;
    },
  >(
    payload: T,
    options?: { secretOrPrivateKey: string; algorithm?: Algorithm },
  ): string {
    return this.client.sign(
      {
        iss: 'iss' in payload ? payload.iss : this.issuer,
        aud: 'aud' in payload ? payload.aud : this.issuer,
        ...payload,
      },
      {
        secretOrPrivateKey: options?.secretOrPrivateKey ?? this.secret,
        algorithm: options?.algorithm ?? JWT_ALGORITHM,
      },
    );
  }

  verify<T extends object>(
    token: string,
    options?: {
      issuer?: string;
      audience?: string;
      secretOrPrivateKey?: string;
      algorithms?: Array<Algorithm>;
    },
  ): T {
    return this.client.verify(token, {
      issuer: options?.issuer ?? this.issuer,
      audience: options?.audience ?? this.issuer,
      secretOrPrivateKey: options?.secretOrPrivateKey ?? this.secret,
      algorithms: options?.algorithms ?? [JWT_ALGORITHM],
    });
  }

  decode<T extends object>(
    token: string,
    options?: {
      issuer?: string;
      audience?: string;
      secretOrPrivateKey?: string;
      algorithms?: Array<Algorithm>;
    },
  ): JwtPayload & T {
    return this.client.decode(token, {
      issuer: options?.issuer ?? this.issuer,
      audience: options?.audience ?? this.issuer,
      secretOrPrivateKey: options?.secretOrPrivateKey ?? this.secret,
      algorithms: options?.algorithms ?? [JWT_ALGORITHM],
    });
  }

  decodeWithoutVerification<T extends object>(
    token: string,
  ): (JwtPayload & T) | null {
    return this.client.decodeWithoutVerification(token);
  }
}

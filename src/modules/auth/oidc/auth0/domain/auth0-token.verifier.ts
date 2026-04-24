// SPDX-License-Identifier: FSL-1.1-MIT
import { createPublicKey } from 'node:crypto';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AUTH0_ID_TOKEN_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import {
  NetworkService,
  type INetworkService,
} from '@/datasources/network/network.service.interface';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  type Auth0Jwk,
  type Auth0Jwks,
  Auth0JwksSchema,
} from '@/modules/auth/oidc/auth0/domain/entities/auth0-jwk.entity';
import type {
  Auth0Token,
  Auth0TokenHeader,
} from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import {
  Auth0TokenHeaderSchema,
  Auth0TokenSchema,
} from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError } from 'jsonwebtoken';

const AUTH0_ID_TOKEN_SIGNING_KEY_CACHE_TTL_MS = 60 * 60 * 1_000;

type CachedSigningKey = {
  publicKey: string;
  expiresAt: number;
};

type ResolvedSigningKey = {
  publicKey: string;
  fromCache: boolean;
};

@Injectable()
export class Auth0TokenVerifier {
  private readonly issuer: string;
  private readonly idTokenAudience: string;
  private readonly idTokenSigningKeys = new Map<string, CachedSigningKey>();

  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    const domain =
      this.configurationService.getOrThrow<string>('auth.auth0.domain');
    this.issuer = `https://${domain}/`;
    this.idTokenAudience = this.configurationService.getOrThrow<string>(
      'auth.auth0.clientId',
    );
  }

  public async verifyAndDecodeIdToken(idToken: string): Promise<Auth0Token> {
    const header = this.decodeIdTokenHeader(idToken);
    const signingKey = await this.getIdTokenSigningPublicKey(header);

    try {
      return this.verifyIdTokenWithSigningKey(idToken, signingKey.publicKey);
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        this.loggingService.debug(
          `Auth0: id token JWT verification failed: ${error.message}`,
        );

        if (!signingKey.fromCache) {
          throw new UnauthorizedException('Invalid id token');
        }

        const refreshedSigningPublicKey =
          await this.refreshIdTokenSigningPublicKey(header);

        try {
          return this.verifyIdTokenWithSigningKey(
            idToken,
            refreshedSigningPublicKey,
          );
        } catch (retryError) {
          if (retryError instanceof JsonWebTokenError) {
            this.loggingService.debug(
              `Auth0: id token JWT verification failed after JWKS refresh: ${retryError.message}`,
            );
            throw new UnauthorizedException('Invalid id token');
          }

          throw retryError;
        }
      }

      throw error;
    }
  }

  private async getIdTokenSigningPublicKey({
    kid,
    alg,
  }: Auth0TokenHeader): Promise<ResolvedSigningKey> {
    this.assertIdTokenAlgorithm(alg);
    const cachedKey = this.idTokenSigningKeys.get(kid);

    if (cachedKey && cachedKey.expiresAt > Date.now()) {
      this.loggingService.debug(
        `Auth0: using cached JWKS signing key for kid ${kid}`,
      );
      return { publicKey: cachedKey.publicKey, fromCache: true };
    }

    if (cachedKey) {
      this.idTokenSigningKeys.delete(kid);
    }

    return {
      publicKey: await this.refreshIdTokenSigningPublicKey({ kid, alg }),
      fromCache: false,
    };
  }

  private async refreshIdTokenSigningPublicKey({
    kid,
    alg,
  }: Auth0TokenHeader): Promise<string> {
    this.assertIdTokenAlgorithm(alg);
    const jwks = await this.fetchJsonWebKeySet();
    const jwk = jwks.keys.find((candidate) => candidate.kid === kid);
    if (!jwk) {
      throw new UnauthorizedException('Invalid id token');
    }

    const signingPublicKey = this.toPemPublicKey(jwk);
    this.idTokenSigningKeys.set(kid, {
      publicKey: signingPublicKey,
      expiresAt: Date.now() + AUTH0_ID_TOKEN_SIGNING_KEY_CACHE_TTL_MS,
    });
    this.loggingService.debug(
      `Auth0: resolved JWKS signing key for kid ${kid}`,
    );
    return signingPublicKey;
  }

  private assertIdTokenAlgorithm(alg: Auth0TokenHeader['alg']): void {
    if (alg !== AUTH0_ID_TOKEN_ALGORITHM) {
      throw new UnauthorizedException('Invalid id token');
    }
  }

  private verifyIdTokenWithSigningKey(
    idToken: string,
    signingPublicKey: string,
  ): Auth0Token {
    const decoded = this.jwtService.decode<{ sub: string }>(idToken, {
      issuer: this.issuer,
      audience: this.idTokenAudience,
      secretOrPrivateKey: signingPublicKey,
      algorithms: [AUTH0_ID_TOKEN_ALGORITHM],
    });
    this.loggingService.debug(
      `Auth0: id token verified successfully for sub ${decoded.sub}`,
    );
    return Auth0TokenSchema.parse(decoded);
  }

  private decodeIdTokenHeader(idToken: string): Auth0TokenHeader {
    const [encodedHeader] = idToken.split('.');

    if (!encodedHeader) {
      throw new UnauthorizedException('Invalid id token');
    }

    try {
      return Auth0TokenHeaderSchema.parse(
        JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')),
      );
    } catch {
      throw new UnauthorizedException('Invalid id token');
    }
  }

  private async fetchJsonWebKeySet(): Promise<Auth0Jwks> {
    const response = await this.networkService.get<unknown>({
      url: new URL('/.well-known/jwks.json', this.issuer).toString(),
    });

    return Auth0JwksSchema.parse(response.data);
  }

  private toPemPublicKey(jwk: Auth0Jwk): string {
    if (jwk.n && jwk.e) {
      return createPublicKey({
        key: {
          kty: 'RSA',
          n: jwk.n,
          e: jwk.e,
        },
        format: 'jwk',
      })
        .export({ format: 'pem', type: 'spki' })
        .toString();
    }

    const certificate = jwk.x5c?.[0];
    if (certificate) {
      const body = certificate.match(/.{1,64}/g)?.join('\n') ?? certificate;
      return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
    }

    throw new UnauthorizedException('Invalid id token');
  }
}

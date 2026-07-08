// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type {
  AuthorizeQuery,
  OidcSignInDto,
  TokenRequestDto,
} from '@/modules/auth/oidc-provider/routes/entities/oidc-provider.dto.entity';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';

type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  state?: string;
  oidcNonce?: string;
  siweNonce: string;
};

type AuthorizationCode = {
  clientId: string;
  oidcNonce?: string;
  address: Address;
  chainId: number;
  redirectUri: string;
};

type UserInfo = {
  sub: Address;
  address: Address;
  chain_id: number;
  preferred_username: Address;
};

/**
 * A minimal OAuth 2.0/OIDC provider backed by Sign-in with Ethereum,
 * modelled after {@link https://github.com/spruceid/siwe-oidc}.
 *
 * All signature/nonce validation is delegated to the existing
 * {@link ISiweRepository} — this service only adds the OAuth 2.0
 * authorization code flow around it.
 */
@Injectable()
export class OidcProviderService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUris: Array<string>;
  private readonly signInPageUrl: string;
  private readonly issuer: string;
  private readonly requestTtlInSeconds: number;
  private readonly codeTtlInSeconds: number;
  private readonly accessTokenTtlInSeconds: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
  ) {
    this.clientId = this.configurationService.getOrThrow(
      'auth.oidcProvider.clientId',
    );
    this.clientSecret = this.configurationService.getOrThrow(
      'auth.oidcProvider.clientSecret',
    );
    this.redirectUris = this.configurationService.getOrThrow(
      'auth.oidcProvider.redirectUris',
    );
    this.signInPageUrl = this.configurationService.getOrThrow(
      'auth.oidcProvider.signInPageUrl',
    );
    this.issuer = this.configurationService.getOrThrow(
      'auth.oidcProvider.issuer',
    );
    this.requestTtlInSeconds = this.configurationService.getOrThrow(
      'auth.nonceTtlSeconds',
    );
    this.codeTtlInSeconds = this.configurationService.getOrThrow(
      'auth.oidcProvider.authorizationCodeTtlSeconds',
    );
    this.accessTokenTtlInSeconds = this.configurationService.getOrThrow(
      'auth.oidcProvider.accessTokenTtlSeconds',
    );
  }

  /**
   * Validates the authorization request, generates a SiWe nonce and
   * redirects the user agent to the sign-in page where the SiWe message
   * is signed.
   */
  async createAuthorizationRequest(query: AuthorizeQuery): Promise<string> {
    if (query.client_id !== this.clientId) {
      throw new UnauthorizedException('Unknown client_id');
    }
    if (!this.redirectUris.includes(query.redirect_uri)) {
      throw new UnauthorizedException('redirect_uri is not allowed');
    }

    const { nonce } = await this.siweRepository.generateNonce();
    const requestId = randomBytes(32).toString('hex');
    const request: AuthorizationRequest = {
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      state: query.state,
      oidcNonce: query.nonce,
      siweNonce: nonce,
    };
    await this.cacheService.hSet(
      CacheRouter.getOidcProviderRequestCacheDir(requestId),
      JSON.stringify(request),
      this.requestTtlInSeconds,
    );

    const signInUrl = new URL(this.signInPageUrl);
    signInUrl.searchParams.set('request_id', requestId);
    signInUrl.searchParams.set('nonce', nonce);
    return signInUrl.toString();
  }

  /**
   * Verifies the signed SiWe message (nonce and signature validation is
   * the exact same code path as `/v1/auth/verify`), issues a single-use
   * authorization code and returns the redirect URL back to the client.
   */
  async signIn(dto: OidcSignInDto): Promise<{ redirect_url: string }> {
    const cacheDir = CacheRouter.getOidcProviderRequestCacheDir(dto.request_id);
    const cached = await this.cacheService.hGet(cacheDir);
    if (!cached) {
      throw new UnauthorizedException(
        'Unknown or expired authorization request',
      );
    }
    const request = JSON.parse(cached) as AuthorizationRequest;

    const { address, chainId, nonce } =
      await this.siweRepository.getValidatedSiweMessage({
        message: dto.message,
        signature: dto.signature,
      });
    if (nonce !== request.siweNonce) {
      throw new UnauthorizedException(
        'Nonce does not match authorization request',
      );
    }
    await this.cacheService.deleteByKey(cacheDir.key);

    const code = randomBytes(32).toString('base64url');
    const payload: AuthorizationCode = {
      clientId: request.clientId,
      oidcNonce: request.oidcNonce,
      address,
      chainId,
      redirectUri: request.redirectUri,
    };
    await this.cacheService.hSet(
      CacheRouter.getOidcProviderCodeCacheDir(code),
      JSON.stringify(payload),
      this.codeTtlInSeconds,
    );

    const redirectUrl = new URL(request.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (request.state) {
      redirectUrl.searchParams.set('state', request.state);
    }
    return { redirect_url: redirectUrl.toString() };
  }

  /**
   * Exchanges a single-use authorization code for tokens.
   * The access token is consumed by the userinfo endpoint, the ID token
   * is HS256-signed with the client secret as per OIDC Core 10.1.
   */
  async getToken(
    dto: TokenRequestDto,
    authorizationHeader?: string,
  ): Promise<{
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
    id_token: string;
  }> {
    this.assertClientCredentials(dto, authorizationHeader);

    const cacheDir = CacheRouter.getOidcProviderCodeCacheDir(dto.code);
    const cached = await this.cacheService.hGet(cacheDir);
    // Codes are single use, delete straight away
    await this.cacheService.deleteByKey(cacheDir.key);
    if (!cached) {
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'Unknown, expired or already used code',
      });
    }
    const code = JSON.parse(cached) as AuthorizationCode;
    if (dto.redirect_uri && dto.redirect_uri !== code.redirectUri) {
      throw new BadRequestException({
        error: 'invalid_grant',
        error_description: 'redirect_uri does not match',
      });
    }

    const iat = new Date();
    const exp = new Date(iat.getTime() + this.accessTokenTtlInSeconds * 1_000);
    const claims = {
      iss: this.issuer,
      aud: this.clientId,
      sub: code.address,
      address: code.address,
      chain_id: code.chainId,
      iat,
      exp,
    };
    const accessToken = this.jwtService.sign({ ...claims, scope: 'openid' });
    const idToken = this.jwtService.sign(
      { ...claims, ...(code.oidcNonce && { nonce: code.oidcNonce }) },
      // OIDC Core 10.1: symmetric signature using the client secret
      { secretOrPrivateKey: this.clientSecret },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTtlInSeconds,
      scope: 'openid',
      id_token: idToken,
    };
  }

  getUserInfo(authorizationHeader?: string): UserInfo {
    const [scheme, accessToken] = authorizationHeader?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !accessToken) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    try {
      const payload = this.jwtService.verify<{
        sub: Address;
        chain_id: number;
      }>(accessToken, { issuer: this.issuer, audience: this.clientId });
      return {
        sub: payload.sub,
        address: payload.sub,
        chain_id: payload.chain_id,
        preferred_username: payload.sub,
      };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  /**
   * OIDC discovery document.
   * @see https://openid.net/specs/openid-connect-discovery-1_0.html
   */
  getDiscoveryDocument(): Record<string, unknown> {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/v1/oauth2/authorize`,
      token_endpoint: `${this.issuer}/v1/oauth2/token`,
      userinfo_endpoint: `${this.issuer}/v1/oauth2/userinfo`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      scopes_supported: ['openid'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
      ],
    };
  }

  /**
   * Accepts client credentials via HTTP Basic auth or the request body.
   * @see https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1
   */
  private assertClientCredentials(
    dto: TokenRequestDto,
    authorizationHeader?: string,
  ): void {
    let clientId = dto.client_id;
    let clientSecret = dto.client_secret;

    if (authorizationHeader?.toLowerCase().startsWith('basic ')) {
      const decoded = Buffer.from(
        authorizationHeader.slice('basic '.length),
        'base64',
      ).toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex !== -1) {
        clientId = decodeURIComponent(decoded.slice(0, separatorIndex));
        clientSecret = decodeURIComponent(decoded.slice(separatorIndex + 1));
      }
    }

    const isValid =
      !!clientId &&
      !!clientSecret &&
      constantTimeEquals(clientId, this.clientId) &&
      constantTimeEquals(clientSecret, this.clientSecret);
    if (!isValid) {
      throw new UnauthorizedException({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
    }
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

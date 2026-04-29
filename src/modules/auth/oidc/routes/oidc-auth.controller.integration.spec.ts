// SPDX-License-Identifier: FSL-1.1-MIT
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import configuration from '@/config/entities/__tests__/configuration';
import { EmailModule } from '@/modules/email/email.module';
import { TestEmailApiModule } from '@/modules/email/datasources/__tests__/test.email-api.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { faker } from '@faker-js/faker';
import { getSecondsUntil } from '@/domain/common/utils/time';
import type { Server } from 'net';
import { sign } from 'jsonwebtoken';
import {
  type Auth0JwksFixture,
  getAuth0JwksFixture,
  mockAuth0Jwks,
  signAuth0Jwt,
} from '@/modules/auth/oidc/auth0/__tests__/auth0-jwks.helper';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { UsersModule } from '@/modules/users/users.module';
import { TestUsersModule } from '@/modules/users/__tests__/test.users.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  NetworkService,
  type INetworkService,
} from '@/datasources/network/network.service.interface';
import type { TestingModule } from '@nestjs/testing';
import { rawify } from '@/validation/entities/raw.entity';

describe('OidcAuthController', () => {
  let app: INestApplication<Server>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let jwtService: IJwtService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  let maxValidityPeriodInMs: number;
  let stateTtlMs: number;
  let auth0Config: {
    domain: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    audience: string;
    scope: string;
  };
  let auth0JwksFixture: Auth0JwksFixture;
  let postLoginRedirectUri: string;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  function signAuth0Token(claims: {
    sub: string;
    exp?: number;
    iat?: number;
    nbf?: number;
  }): string {
    return signAuth0Jwt({
      issuer: `https://${auth0Config.domain}/`,
      audience: auth0Config.clientId,
      kid: auth0JwksFixture.kid,
      privateKey: auth0JwksFixture.privateKey,
      payload: claims,
    });
  }

  async function initApp(config: typeof configuration): Promise<void> {
    await app?.close();
    const moduleFixture: TestingModule = await createTestModule({
      config,
      modules: [
        {
          originalModule: EmailModule,
          testModule: TestEmailApiModule,
        },
        {
          originalModule: UsersModule,
          testModule: TestUsersModule,
        },
      ],
    });

    networkService = moduleFixture.get(NetworkService);
    jwtService = moduleFixture.get(IJwtService);

    const configService: IConfigurationService = moduleFixture.get(
      IConfigurationService,
    );

    maxValidityPeriodInMs =
      configService.getOrThrow<number>('auth.maxValidityPeriodSeconds') * 1_000;
    postLoginRedirectUri = configService.getOrThrow<string>(
      'auth.postLoginRedirectUri',
    );
    stateTtlMs = configService.getOrThrow<number>('auth.stateTtlMs');
    auth0Config = {
      domain: configService.getOrThrow<string>('auth.auth0.domain'),
      clientId: configService.getOrThrow<string>('auth.auth0.clientId'),
      clientSecret: configService.getOrThrow<string>('auth.auth0.clientSecret'),
      redirectUri: configService.getOrThrow<string>('auth.auth0.redirectUri'),
      audience: configService.getOrThrow<string>('auth.auth0.audience'),
      scope: configService.getOrThrow<string>('auth.auth0.scope'),
    };
    auth0JwksFixture = getAuth0JwksFixture();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
    mockAuth0Jwks({
      fetchMock,
      issuer: `https://${auth0Config.domain}/`,
      publicJwk: auth0JwksFixture.publicJwk,
      kid: auth0JwksFixture.kid,
    });
  }

  describe('default configuration', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      jest.resetAllMocks();

      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        application: {
          ...defaultConfiguration.application,
          isProduction: true,
        },
        features: {
          ...defaultConfiguration.features,
          oidc_auth: true,
        },
      });

      await initApp(testConfiguration);
    });

    afterEach(async () => {
      jest.useRealTimers();
      await app?.close();
    });

    describe('GET /v1/auth/oidc/authorize', () => {
      it('should redirect to Auth0 authorization endpoint and set the state cookie', async () => {
        jest.setSystemTime(0);

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const location = new URL(response.headers.location);
        const stateMaxAge = Math.floor(stateTtlMs / 1_000);

        expect(location.origin).toBe(`https://${auth0Config.domain}`);
        expect(location.pathname).toBe('/authorize');
        expect(location.searchParams.get('response_type')).toBe('code');
        expect(location.searchParams.get('client_id')).toBe(
          auth0Config.clientId,
        );
        expect(location.searchParams.get('redirect_uri')).toBe(
          auth0Config.redirectUri,
        );
        expect(location.searchParams.get('scope')).toBe(auth0Config.scope);
        expect(location.searchParams.get('audience')).toBe(
          auth0Config.audience,
        );
        expect(location.searchParams.get('state')).toEqual(expect.any(String));

        expect(response.headers['set-cookie']).toEqual(
          expect.arrayContaining([
            expect.stringMatching(
              new RegExp(
                `^auth_state=.*; Max-Age=${stateMaxAge}; Path=/; Expires=.*; HttpOnly; Secure; SameSite=Lax$`,
              ),
            ),
          ]),
        );
      });

      it('should set SameSite=None on the state cookie if application.env is not production', async () => {
        jest.setSystemTime(0);

        const defaultConfiguration = configuration();
        const testConfiguration = (): typeof defaultConfiguration => ({
          ...defaultConfiguration,
          application: {
            ...defaultConfiguration.application,
            isProduction: false,
          },
          features: {
            ...defaultConfiguration.features,
            oidc_auth: true,
          },
        });

        await initApp(testConfiguration);
        const stateMaxAge = Math.floor(stateTtlMs / 1_000);

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        expect(response.headers['set-cookie']).toEqual(
          expect.arrayContaining([
            expect.stringMatching(
              new RegExp(
                `^auth_state=.*; Max-Age=${stateMaxAge}; Path=/; Expires=.*; HttpOnly; Secure; SameSite=None$`,
              ),
            ),
          ]),
        );
      });

      it('should generate a unique state on each call', async () => {
        const first = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const second = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const firstState = new URL(first.headers.location).searchParams.get(
          'state',
        );
        const secondState = new URL(second.headers.location).searchParams.get(
          'state',
        );

        expect(firstState).toEqual(expect.any(String));
        expect(secondState).toEqual(expect.any(String));
        expect(firstState).not.toBe(secondState);
      });

      it('should include connection=email in the Auth0 redirect URL', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize?connection=email')
          .expect(302);

        const location = new URL(response.headers.location);
        expect(location.searchParams.get('connection')).toBe('email');
      });

      it('should include connection=google-oauth2 in the Auth0 redirect URL', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize?connection=google-oauth2')
          .expect(302);

        const location = new URL(response.headers.location);
        expect(location.searchParams.get('connection')).toBe('google-oauth2');
      });

      it('should not include connection param when not provided', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const location = new URL(response.headers.location);
        expect(location.searchParams.has('connection')).toBe(false);
      });

      it('should return 422 for an invalid connection value', async () => {
        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize?connection=facebook')
          .expect(422);
      });

      it('should return 422 for an empty connection value', async () => {
        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize?connection=')
          .expect(422);
      });

      it('should return 400 when redirect_url is cross-origin', async () => {
        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: 'https://evil.com/phish' })
          .expect(400)
          .expect(({ body }) => {
            expect(body.message).toContain('Invalid redirect URL');
          });
      });

      it('should return 422 when redirect_url contains control characters', async () => {
        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: '/settings\r\nX-Injected: true' })
          .expect(422);
      });

      it('should return 422 when redirect_url exceeds max length', async () => {
        const longUrl = '/' + 'a'.repeat(2048);
        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: longUrl })
          .expect(422);
      });
    });

    describe('GET /v1/auth/oidc/callback', () => {
      function expectErrorRedirect(
        response: request.Response,
        expectedError: string,
        expectedBaseUrl?: string,
        expectedErrorDescription?: string,
      ): void {
        expect(response.status).toBe(302);
        const location = new URL(response.headers.location);
        const redirectBase = new URL(expectedBaseUrl ?? postLoginRedirectUri);

        expect(location.origin + location.pathname).toBe(
          redirectBase.origin + redirectBase.pathname,
        );
        expect(location.searchParams.get('error')).toBe(expectedError);
        if (expectedErrorDescription) {
          expect(location.searchParams.get('error_description')).toBe(
            expectedErrorDescription,
          );
        } else {
          expect(location.searchParams.has('error_description')).toBe(false);
        }
        // State cookie should always be cleared
        expect(response.headers['set-cookie']).toEqual(
          expect.arrayContaining([
            'auth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
          ]),
        );
      }

      it('should exchange the authorization code, check the state, set the access token cookie and redirect', async () => {
        jest.setSystemTime(0);

        const expirationTime = faker.date.between({
          from: new Date(),
          to: new Date(Date.now() + maxValidityPeriodInMs),
        });

        const auth0Token = signAuth0Token({
          sub: faker.string.uuid(),
          exp: Math.floor(expirationTime.getTime() / 1_000),
          iat: Math.floor(Date.now() / 1_000),
        });
        const maxAge = getSecondsUntil(expirationTime);

        networkService.postForm.mockResolvedValueOnce({
          status: 200,
          data: rawify({
            access_token: faker.string.alphanumeric(64),
            id_token: auth0Token,
            token_type: 'Bearer',
            scope: faker.lorem.words(),
          }),
        });

        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const state = new URL(
          authorizeResponse.headers.location,
        ).searchParams.get('state');
        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({
            code: 'auth-code',
            state,
          })
          .expect(302)
          .expect(({ headers }) => {
            expect(headers.location).toBe(postLoginRedirectUri);

            const setCookie = headers['set-cookie'] as unknown as Array<string>;
            const accessTokenCookieRegExp = new RegExp(
              `^access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expirationTime.toUTCString()}; HttpOnly; Secure; SameSite=Lax$`,
            );

            expect(setCookie).toEqual(
              expect.arrayContaining([
                expect.stringMatching(accessTokenCookieRegExp),
                'auth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
              ]),
            );

            const accessToken = setCookie
              .find((cookie) => cookie.startsWith('access_token='))
              ?.match(/^access_token=([^;]+)/)?.[1];

            expect(
              jwtService.verify<{ auth_method: string; sub: string }>(
                accessToken!,
              ),
            ).toMatchObject({
              auth_method: 'oidc',
              sub: '1',
            });
          });

        expect(networkService.postForm).toHaveBeenCalledWith({
          url: `https://${auth0Config.domain}/oauth/token`,
          data: {
            grant_type: 'authorization_code',
            client_id: auth0Config.clientId,
            client_secret: auth0Config.clientSecret,
            code: 'auth-code',
            redirect_uri: auth0Config.redirectUri,
          },
        });
      });

      it('should redirect with authentication_failed when the token verification fails', async () => {
        const invalidToken = sign(
          { sub: faker.string.uuid() },
          'wrong-signing-secret',
          { algorithm: 'HS256' },
        );

        networkService.postForm.mockResolvedValueOnce({
          status: 200,
          data: rawify({
            access_token: faker.string.alphanumeric(64),
            refresh_token: 'auth0-refresh-token',
            id_token: invalidToken,
            token_type: 'Bearer',
          }),
        });

        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const state = new URL(
          authorizeResponse.headers.location,
        ).searchParams.get('state');
        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({
            code: 'auth-code',
            state,
          });

        expectErrorRedirect(response, 'authentication_failed');
      });

      it('should redirect with error when the state does not match', async () => {
        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({
            code: 'auth-code',
            state: 'wrong-state',
          });

        expectErrorRedirect(response, 'invalid_request');
        expect(networkService.postForm).not.toHaveBeenCalled();
      });

      it('should redirect with error when code is missing', async () => {
        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        const state = new URL(
          authorizeResponse.headers.location,
        ).searchParams.get('state');

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({ state });

        expectErrorRedirect(response, 'invalid_request');
        expect(networkService.postForm).not.toHaveBeenCalled();
      });

      it('should redirect with error and error_description when the OIDC provider returns an error with description', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .query({
            error: 'access_denied',
            error_description: 'User denied access',
          });

        expectErrorRedirect(
          response,
          'access_denied',
          undefined,
          'User denied access',
        );
        expect(networkService.postForm).not.toHaveBeenCalled();
      });

      it('should redirect with authentication_failed when Auth0 token exp exceeds max validity', async () => {
        jest.setSystemTime(0);

        const farFutureExp =
          Math.floor(Date.now() / 1_000) + maxValidityPeriodInMs / 1_000 + 3600;
        const auth0Token = signAuth0Token({
          sub: faker.string.uuid(),
          exp: farFutureExp,
          iat: Math.floor(Date.now() / 1_000),
        });

        networkService.postForm.mockResolvedValueOnce({
          status: 200,
          data: rawify({
            access_token: faker.string.alphanumeric(64),
            id_token: auth0Token,
            token_type: 'Bearer',
          }),
        });

        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .expect(302);

        const state = new URL(
          authorizeResponse.headers.location,
        ).searchParams.get('state');
        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({
            code: 'auth-code',
            state,
          });

        expectErrorRedirect(response, 'authentication_failed');
      });

      it('should redirect to the custom redirect_url after login', async () => {
        jest.setSystemTime(0);

        const customRedirectUrl = new URL(
          `/${faker.word.noun()}`,
          postLoginRedirectUri,
        ).toString();
        const expirationTime = faker.date.between({
          from: new Date(),
          to: new Date(Date.now() + maxValidityPeriodInMs),
        });

        const auth0Token = signAuth0Token({
          sub: faker.string.uuid(),
          exp: Math.floor(expirationTime.getTime() / 1_000),
          iat: Math.floor(Date.now() / 1_000),
        });

        networkService.postForm.mockResolvedValueOnce({
          status: 200,
          data: rawify({
            access_token: faker.string.alphanumeric(64),
            id_token: auth0Token,
            token_type: 'Bearer',
            scope: faker.lorem.words(),
          }),
        });

        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: customRedirectUrl })
          .expect(302);

        const state = new URL(
          authorizeResponse.headers.location,
        ).searchParams.get('state');
        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({
            code: 'auth-code',
            state,
          })
          .expect(302)
          .expect(({ headers }) => {
            expect(headers.location).toBe(customRedirectUrl);
          });
      });

      it('should redirect errors to the custom redirect_url from state when provider returns error', async () => {
        const customRedirectUrl = new URL(
          `/${faker.word.noun()}`,
          postLoginRedirectUri,
        ).toString();

        const authorizeResponse = await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: customRedirectUrl })
          .expect(302);

        const stateCookie = (
          authorizeResponse.headers['set-cookie'] as unknown as Array<string>
        )
          .find((cookie) => cookie.startsWith('auth_state='))
          ?.split(';')[0];

        const response = await request(app.getHttpServer())
          .get('/v1/auth/oidc/callback')
          .set('Cookie', stateCookie!)
          .query({
            error: 'access_denied',
            error_description: 'User denied access',
          });

        expectErrorRedirect(
          response,
          'access_denied',
          customRedirectUrl,
          'User denied access',
        );
        expect(networkService.postForm).not.toHaveBeenCalled();
      });
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      jest.resetAllMocks();

      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        application: {
          ...defaultConfiguration.application,
          isProduction: true,
        },
        auth: {
          ...defaultConfiguration.auth,
          rateLimit: {
            max: 1,
            windowSeconds: 60,
          },
        },
        features: {
          ...defaultConfiguration.features,
          oidc_auth: true,
        },
      });

      await initApp(testConfiguration);
    });

    afterEach(async () => {
      await app?.close();
    });

    it('should return 429 when rate limit is exceeded on /v1/auth/oidc/authorize', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/oidc/authorize')
        .expect(302);

      await request(app.getHttpServer())
        .get('/v1/auth/oidc/authorize')
        .expect(429);
    });

    it('should return 429 when rate limit is exceeded on /v1/auth/oidc/callback', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .query({ error: 'access_denied' })
        .expect(302);

      await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .query({ error: 'access_denied' })
        .expect(429);
    });
  });

  describe('allowedRedirectDomain is present', () => {
    const allowedDomain = '5afe.dev';

    describe('non-production environment', () => {
      beforeEach(async () => {
        const defaultConfiguration = configuration();
        const testConfiguration = (): typeof defaultConfiguration => ({
          ...defaultConfiguration,
          application: {
            ...defaultConfiguration.application,
            isProduction: false,
          },
          auth: {
            ...defaultConfiguration.auth,
            postLoginRedirectUri: `https://app.${allowedDomain}/welcome`,
            allowedRedirectDomain: allowedDomain,
          },
          features: {
            ...defaultConfiguration.features,
            oidc_auth: true,
          },
        });

        await initApp(testConfiguration);
      });

      afterEach(async () => {
        jest.useRealTimers();
        await app?.close();
      });

      it('should accept a subdomain of the allowed domain', async () => {
        const redirectUrl = `https://preview.${allowedDomain}/settings`;

        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: redirectUrl })
          .expect(302);
      });

      it('should reject a different domain', async () => {
        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: 'https://evil.com/phish' })
          .expect(400)
          .expect(({ body }) => {
            expect(body.message).toContain('Invalid redirect URL');
          });
      });
    });

    describe('production environment', () => {
      afterEach(async () => {
        jest.useRealTimers();
        await app?.close();
      });

      it('should reject a domain of the allowed domain if not exact post-login url match', async () => {
        const defaultConfiguration = configuration();
        const testConfiguration = (): typeof defaultConfiguration => ({
          ...defaultConfiguration,
          application: {
            ...defaultConfiguration.application,
            isProduction: true,
          },
          auth: {
            ...defaultConfiguration.auth,
            postLoginRedirectUri: `https://app.${allowedDomain}/welcome`,
            allowedRedirectDomain: allowedDomain,
          },
          features: {
            ...defaultConfiguration.features,
            oidc_auth: true,
          },
        });

        await initApp(testConfiguration);
        const redirectUrl = `https://preview.${allowedDomain}/settings`;

        await request(app.getHttpServer())
          .get('/v1/auth/oidc/authorize')
          .query({ redirect_url: redirectUrl })
          .expect(400);
      });
    });
  });
});

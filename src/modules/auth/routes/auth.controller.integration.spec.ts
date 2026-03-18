// SPDX-License-Identifier: FSL-1.1-MIT
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import configuration from '@/config/entities/__tests__/configuration';
import { EmailModule } from '@/modules/email/email.module';
import { TestEmailApiModule } from '@/modules/email/datasources/__tests__/test.email-api.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { faker } from '@faker-js/faker';
import { createSiweMessage } from 'viem/siwe';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { getSecondsUntil } from '@/domain/common/utils/time';
import type { Server } from 'net';
import { sign } from 'jsonwebtoken';
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

describe('AuthController', () => {
  let app: INestApplication<Server>;
  let cacheService: FakeCacheService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let jwtService: IJwtService;

  let maxValidityPeriodInMs: number;
  let stateTtlMs: number;
  let auth0Config: {
    domain: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    audience: string;
    signingSecret: string;
    scope: string;
  };
  let postLoginRedirectUri: string;

  function signAuth0Token(claims: {
    sub: string;
    exp?: number;
    iat?: number;
    nbf?: number;
  }): string {
    return sign(claims, auth0Config.signingSecret, {
      algorithm: 'HS256',
      issuer: `https://${auth0Config.domain}/`,
      audience: auth0Config.audience,
      noTimestamp: true,
    });
  }

  async function initApp(config: typeof configuration): Promise<void> {
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

    cacheService = moduleFixture.get(CacheService);
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
      signingSecret: configService.getOrThrow<string>(
        'auth.auth0.signingSecret',
      ),
      scope: configService.getOrThrow<string>('auth.auth0.scope'),
    };

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  }

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
        auth: true,
      },
    });

    await initApp(testConfiguration);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('GET /v1/auth/nonce', () => {
    it('should return a nonce', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/nonce')
        .expect(200)
        .expect(async ({ body }) => {
          expect(body).toStrictEqual({
            nonce: expect.any(String),
          });

          const cacheDir = new CacheDir(`auth_nonce_${body.nonce}`, '');
          await expect(cacheService.hGet(cacheDir)).resolves.toBe(body.nonce);
        });
    });
  });

  describe('GET /v1/auth/oidc/authorize', () => {
    it('should redirect to Auth0 and set the state cookie', async () => {
      jest.setSystemTime(0);

      const response = await request(app.getHttpServer())
        .get('/v1/auth/oidc/authorize')
        .expect(302);

      const location = new URL(response.headers.location);
      const stateMaxAge = Math.floor(stateTtlMs / 1_000);

      expect(location.origin).toBe(`https://${auth0Config.domain}`);
      expect(location.pathname).toBe('/authorize');
      expect(location.searchParams.get('response_type')).toBe('code');
      expect(location.searchParams.get('client_id')).toBe(auth0Config.clientId);
      expect(location.searchParams.get('redirect_uri')).toBe(
        auth0Config.redirectUri,
      );
      expect(location.searchParams.get('scope')).toBe(auth0Config.scope);
      expect(location.searchParams.get('audience')).toBe(auth0Config.audience);
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
          auth: true,
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
  });

  describe('POST /v1/auth/verify', () => {
    it('should verify a signer', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
      jest.setSystemTime(0);

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      const maxAge = getSecondsUntil(expirationTime);

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          const setCookieRegExp = new RegExp(
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expirationTime.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
          );

          expect(setCookie).toHaveLength(1);
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should set SameSite=none if application.env is not production', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
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
          auth: true,
        },
      });

      await initApp(testConfiguration);

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      const maxAge = getSecondsUntil(expirationTime);

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );

      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          const setCookieRegExp = new RegExp(
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expirationTime.toUTCString()}; HttpOnly; Secure; SameSite=None`,
          );

          expect(setCookie).toHaveLength(1);
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not issue an access token if expirationTime is too high', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = faker.date.future({
        refDate: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(403)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Forbidden',
            message: `Cannot issue token for longer than ${maxValidityPeriodInMs / 1_000} seconds`,
            statusCode: 403,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if using an unsigned nonce', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const siweMessage = siweMessageBuilder()
        .with('address', signer.address)
        .with('expirationTime', expirationTime)
        .build();
      const message = createSiweMessage(siweMessage);
      const cacheDir = new CacheDir(`auth_nonce_${siweMessage.nonce}`, '');
      const signature = await signer.signMessage({
        message,
      });

      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid nonce',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if the nonce has expired', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      // Mimic ttl expiration
      await cacheService.deleteByKey(cacheDir.key);

      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .set(
          'Authorization',
          `${nonceResponse.body.tokenType} ${nonceResponse.body.accessToken}`,
        )
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid nonce',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if the signature is invalid', async () => {
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const nonce: string = nonceResponse.body.nonce;
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const signature = faker.string.hexadecimal({ length: 132 });

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid signature',
            statusCode: 401,
          });
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });

    it('should not verify a signer if the message has expired', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const expirationTime = new Date();
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(401)
        .expect(({ headers, body }) => {
          expect(headers['set-cookie']).toBeUndefined();

          expect(body).toStrictEqual({
            error: 'Unauthorized',
            message: 'Invalid message',
            statusCode: 401,
          });
        });
      // Nonce remains as SiWe message is expired, not the nonce
      await expect(cacheService.hGet(cacheDir)).resolves.toBe(nonce);
    });

    it('should get the max expirationTime if not specified on the SiWE message', async () => {
      // Fix "now" as it is otherwise to precisely expect expiration/maxAge
      jest.setSystemTime(0);

      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const cacheDir = new CacheDir(`auth_nonce_${nonce}`, '');
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', undefined)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });
      const expectedExpirationTime = new Date(
        Date.now() + maxValidityPeriodInMs,
      );
      const maxAge = getSecondsUntil(expectedExpirationTime);

      await expect(cacheService.hGet(cacheDir)).resolves.toBe(
        nonceResponse.body.nonce,
      );
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'];
          const setCookieRegExp = new RegExp(
            `access_token=([^;]*); Max-Age=${maxAge}; Path=/; Expires=${expectedExpirationTime.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
          );

          expect(setCookie).toHaveLength(1);
          expect(setCookie[0]).toMatch(setCookieRegExp);
        });
      // Nonce deleted
      await expect(cacheService.hGet(cacheDir)).resolves.toBeNull();
    });
  });

  describe('GET /v1/auth/oidc/callback', () => {
    function expectErrorRedirect(
      response: request.Response,
      expectedError: string,
      expectedBaseUrl?: string,
    ): void {
      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      const redirectBase = new URL(expectedBaseUrl ?? postLoginRedirectUri);
      expect(location.origin + location.pathname).toBe(
        redirectBase.origin + redirectBase.pathname,
      );
      expect(location.searchParams.get('error')).toBe(expectedError);
      // State cookie should always be cleared
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          'auth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
        ]),
      );
    }

    it('should exchange the authorization code, set the access token cookie and redirect', async () => {
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
          access_token: auth0Token,
          id_token: 'auth0-id-token',
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
          access_token: invalidToken,
          refresh_token: 'auth0-refresh-token',
          id_token: 'auth0-id-token',
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

    it('should redirect with error when no state cookie is present', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .query({
          code: 'auth-code',
          state: 'some-state',
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

    it('should redirect with error when state is missing', async () => {
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
        .query({ code: 'auth-code' });

      expectErrorRedirect(response, 'invalid_request');
      expect(networkService.postForm).not.toHaveBeenCalled();
    });

    it('should redirect with only error when the OIDC provider returns an error with description', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied access',
        });

      expectErrorRedirect(response, 'access_denied');
      expect(networkService.postForm).not.toHaveBeenCalled();
    });

    it('should redirect with error when the OIDC provider returns an error without description', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .query({
          error: 'access_denied',
        });

      expectErrorRedirect(response, 'access_denied');
      expect(networkService.postForm).not.toHaveBeenCalled();
    });

    it('should redirect with authentication_failed when the code exchange fails', async () => {
      networkService.postForm.mockRejectedValueOnce(new Error('Network error'));

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

    it('should redirect with authentication_failed when the Auth0 token has expired', async () => {
      const expiredToken = signAuth0Token({
        sub: faker.string.uuid(),
        exp: Math.floor(Date.now() / 1_000) - 60,
        iat: Math.floor(Date.now() / 1_000) - 120,
      });

      networkService.postForm.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          access_token: expiredToken,
          id_token: 'auth0-id-token',
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
          access_token: auth0Token,
          id_token: 'auth0-id-token',
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
          access_token: auth0Token,
          id_token: 'auth0-id-token',
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

      expectErrorRedirect(response, 'access_denied', customRedirectUrl);
      expect(networkService.postForm).not.toHaveBeenCalled();
    });

    it('should redirect errors to the custom redirect_url from state when authentication fails', async () => {
      const customRedirectUrl = new URL(
        `/${faker.word.noun()}`,
        postLoginRedirectUri,
      ).toString();

      const invalidToken = sign(
        { sub: faker.string.uuid() },
        'wrong-signing-secret',
        { algorithm: 'HS256' },
      );

      networkService.postForm.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          access_token: invalidToken,
          id_token: 'auth0-id-token',
          token_type: 'Bearer',
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

      const response = await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .set('Cookie', stateCookie!)
        .query({
          code: 'auth-code',
          state,
        });

      expectErrorRedirect(response, 'authentication_failed', customRedirectUrl);
    });

    it('should redirect errors to the custom redirect_url from state when code is missing', async () => {
      const customRedirectUrl = new URL(
        `/${faker.word.noun()}`,
        postLoginRedirectUri,
      ).toString();

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

      const response = await request(app.getHttpServer())
        .get('/v1/auth/oidc/callback')
        .set('Cookie', stateCookie!)
        .query({ state });

      expectErrorRedirect(response, 'invalid_request', customRedirectUrl);
      expect(networkService.postForm).not.toHaveBeenCalled();
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

  describe('POST /v1/auth/logout', () => {
    it('should log a signer out', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const nonceResponse = await request(app.getHttpServer()).get(
        '/v1/auth/nonce',
      );
      const nonce: string = nonceResponse.body.nonce;
      const expirationTime = faker.date.between({
        from: new Date(),
        to: new Date(Date.now() + maxValidityPeriodInMs),
      });
      const message = createSiweMessage(
        siweMessageBuilder()
          .with('address', signer.address)
          .with('nonce', nonce)
          .with('expirationTime', expirationTime)
          .build(),
      );
      const signature = await signer.signMessage({
        message,
      });

      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({
          message,
          signature,
        })
        .expect(200);
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .expect(200)
        .expect(({ headers }) => {
          const setCookie = headers['set-cookie'].toString();
          // access_token has no value and it is set to expire
          expect(setCookie).toBe(
            'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
          );
        });
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return 204 with a valid Siwe access token', async () => {
      const authPayloadDto = siweAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(204);
    });

    it('should return 204 with a valid OIDC access token', async () => {
      const authPayloadDto = oidcAuthPayloadDtoBuilder().build();
      const accessToken = jwtService.sign(authPayloadDto);

      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(204);
    });

    it('should return 403 without an access token', async () => {
      await request(app.getHttpServer()).get('/v1/auth/me').expect(403);
    });

    it('should return 403 with an invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Cookie', ['access_token=invalid-token'])
        .expect(403);
    });
  });
});
